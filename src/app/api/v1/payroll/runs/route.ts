import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  resolveEmployeeAllowances,
  type AllowanceCalcMode,
} from "@/lib/payroll/allowance-resolver";
import {
  calcMidMonthAdvance,
  calcOvertimePay,
  calculateGrossPayroll,
  solveNetToGross,
  type RegionCode,
} from "@/lib/payroll/decimal-engine";
import { loadLegalRulesForDate } from "@/lib/payroll/legal-rule-loader";
import { handleApiError, resolveAuthContext } from "@/lib/security/auth-session";
import { assertAuthorized } from "@/lib/security/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const createRunSchema = z.object({
  payrollPeriodId: z.string().uuid(),
  runType: z.enum(["MID_MONTH_ADVANCE", "END_MONTH_SETTLEMENT"]),
  employeeId: z.string().uuid().optional(),
  isSimulation: z.boolean().optional(),
});

export async function GET(req: Request) {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "PAYROLL", "READ");

    const { searchParams } = new URL(req.url);
    const periodId = searchParams.get("payrollPeriodId");
    const admin = getSupabaseAdminClient();

    const isPayrollViewer = ctx.roles.some((r) =>
      ["HR_ADMIN", "HR_STAFF", "ACCOUNTANT", "DIRECTOR", "AUDITOR"].includes(r)
    );

    let runsQuery = admin
      .from("payroll_runs")
      .select(
        "*, payroll_periods(period_code, cutoff_date, advance_pay_date, settlement_pay_date, standard_work_days)"
      )
      .order("created_at", { ascending: false });

    if (periodId) {
      runsQuery = runsQuery.eq("payroll_period_id", periodId);
    }

    const { data: runs, error: runsErr } = await runsQuery;
    if (runsErr) throw runsErr;

    const runIds = (runs ?? []).map((r) => r.id);
    let results: Array<Record<string, unknown>> = [];

    if (runIds.length > 0) {
      let resQuery = admin
        .from("payroll_results")
        .select(
          "*, employees(employee_code, full_name), payroll_items(id, component_code, category, tier_source, quantity, rate, amount, tax_exempt_amount, explanation_text)"
        )
        .in("payroll_run_id", runIds);

      if (!isPayrollViewer && ctx.employeeId) {
        resQuery = resQuery.eq("employee_id", ctx.employeeId);
      }

      const periodIds = Array.from(
        new Set((runs ?? []).map((r) => r.payroll_period_id).filter(Boolean))
      );

      const [{ data: resRows, error: resErr }, { data: attRows }, { data: balRows }] =
        await Promise.all([
          resQuery,
          periodIds.length > 0
            ? admin
                .from("attendance_summaries")
                .select(
                  "payroll_period_id, employee_id, standard_days, actual_work_days, paid_leave_days, unpaid_leave_days, paid_days"
                )
                .in("payroll_period_id", periodIds)
            : Promise.resolve({ data: [] }),
          admin
            .from("leave_balances")
            .select(
              "employee_id, year, entitled_days, carried_over_days, used_days, pending_days, leave_types(code)"
            ),
        ]);

      if (resErr) throw resErr;

      const runPeriodMap = new Map(
        (runs ?? []).map((r) => [
          r.id,
          {
            periodId: r.payroll_period_id,
            stdDays:
              (r.payroll_periods as { standard_work_days?: number } | null)
                ?.standard_work_days ?? 22,
            year: Number(
              String(
                (r.payroll_periods as { period_code?: string } | null)?.period_code ?? "2026"
              ).slice(0, 4)
            ),
          },
        ])
      );

      const attMap = new Map(
        (attRows ?? []).map((a) => [`${a.payroll_period_id}:${a.employee_id}`, a])
      );

      const balMap = new Map<string, number>();
      for (const b of balRows ?? []) {
        const code = (b.leave_types as { code?: string } | null)?.code;
        if (code && code !== "ANNUAL") continue;
        const rem = Math.max(
          0,
          Number(b.entitled_days ?? 12) +
            Number(b.carried_over_days ?? 0) -
            Number(b.used_days ?? 0) -
            Number(b.pending_days ?? 0)
        );
        balMap.set(`${b.year}:${b.employee_id}`, rem);
      }

      results = (resRows ?? []).map((row) => {
        const meta = runPeriodMap.get(row.payroll_run_id);
        const att = meta ? attMap.get(`${meta.periodId}:${row.employee_id}`) : undefined;
        const stdDays = Number(att?.standard_days ?? meta?.stdDays ?? 22);
        const actualWorkDays = Number(
          att?.actual_work_days ??
            (row.explanation_json as { workedDays?: number } | null)?.workedDays ??
            stdDays
        );
        const paidLeaveDays = Number(att?.paid_leave_days ?? 0);
        const unpaidLeaveDays = Number(att?.unpaid_leave_days ?? 0);
        const paidDays = Number(att?.paid_days ?? actualWorkDays + paidLeaveDays);
        const remainingAnnualLeave =
          balMap.get(`${meta?.year ?? 2026}:${row.employee_id}`) ?? 12;

        return {
          ...row,
          attendance_leave_summary: {
            standard_days: stdDays,
            actual_work_days: actualWorkDays,
            paid_leave_days: paidLeaveDays,
            unpaid_leave_days: unpaidLeaveDays,
            paid_days: paidDays,
            remaining_annual_leave: remainingAnnualLeave,
          },
        };
      });
    }

    return NextResponse.json({ data: { runs: runs ?? [], results } });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "PAYROLL", "CREATE");

    const body = createRunSchema.parse(await req.json());
    const admin = getSupabaseAdminClient();

    const { data: period, error: pErr } = await admin
      .from("payroll_periods")
      .select("*")
      .eq("id", body.payrollPeriodId)
      .single();
    if (pErr || !period) {
      return NextResponse.json(
        { error: { code: "PERIOD_NOT_FOUND", message: "Không tìm thấy kỳ lương." } },
        { status: 404 }
      );
    }

    // Determine next run_version for this period + runType
    const { data: existingRuns } = await admin
      .from("payroll_runs")
      .select("id, run_version, status")
      .eq("payroll_period_id", period.id)
      .eq("run_type", body.runType)
      .order("run_version", { ascending: false });

    const lockedExists = (existingRuns ?? []).some(
      (r) => r.status === "LOCKED" || r.status === "PAID"
    );
    if (lockedExists) {
      return NextResponse.json(
        {
          error: {
            code: "PAYROLL_PERIOD_LOCKED",
            message: `Đợt ${body.runType} của kỳ ${period.period_code} đã khóa/chi trả, không thể tính lại.`,
          },
        },
        { status: 409 }
      );
    }

    const nextVersion = ((existingRuns ?? [])[0]?.run_version ?? 0) + 1;

    // Load active employees, salary assignments, org assignments, tax/insurance, and 3-tier allowance sources
    const [
      { data: employees },
      { data: salaryAssignments },
      { data: orgAssignments },
      { data: attSummaries },
      { data: taxProfiles },
      { data: insProfiles },
      { data: components },
      { data: deptPolicies },
      { data: empOverrides },
      { data: periodVariables },
      { data: advanceRuns },
    ] = await Promise.all([
      admin
        .from("employees")
        .select("id, employee_code, full_name, is_foreign_worker, employment_status")
        .neq("employment_status", "TERMINATED"),
      admin
        .from("salary_assignments")
        .select("*")
        .order("effective_from", { ascending: false }),
      admin
        .from("org_assignments")
        .select("employee_id, department_id, position_id, location_id, cost_center_id, is_primary")
        .eq("is_primary", true),
      admin
        .from("attendance_summaries")
        .select("*")
        .eq("payroll_period_id", period.id),
      admin.from("tax_profiles").select("*"),
      admin.from("insurance_profiles").select("*"),
      admin.from("salary_components").select("*").eq("is_active", true),
      admin.from("department_allowance_policies").select("*"),
      admin.from("employee_allowance_overrides").select("*"),
      admin
        .from("payroll_period_variables")
        .select("*")
        .eq("payroll_period_id", period.id),
      body.runType === "END_MONTH_SETTLEMENT"
        ? admin
            .from("payroll_runs")
            .select("id, status, run_version")
            .eq("payroll_period_id", period.id)
            .eq("run_type", "MID_MONTH_ADVANCE")
            .order("run_version", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

    const latestAdvanceRun = (advanceRuns ?? []).find((r) => r.status !== "DRAFT");
    const advancePaidByEmployee = new Map<string, number>();
    if (latestAdvanceRun) {
      const { data: advResults } = await admin
        .from("payroll_results")
        .select("employee_id, net_payable")
        .eq("payroll_run_id", latestAdvanceRun.id);
      for (const ar of advResults ?? []) {
        advancePaidByEmployee.set(ar.employee_id, Number(ar.net_payable));
      }
    }

    const targetEmployees = body.employeeId
      ? (employees ?? []).filter((e) => e.id === body.employeeId)
      : (employees ?? []);

    if (body.employeeId) {
      if (targetEmployees.length === 0) {
        return NextResponse.json(
          { error: { code: "EMPLOYEE_NOT_FOUND", message: "Không tìm thấy nhân viên đang hoạt động." } },
          { status: 404 }
        );
      }
      const hasSal = (salaryAssignments ?? []).some((s) => s.employee_id === body.employeeId);
      if (!hasSal) {
        return NextResponse.json(
          {
            error: {
              code: "NO_SALARY_ASSIGNED",
              message:
                "Nhân viên này chưa được gán mức lương hợp đồng. Vui lòng nhập lương cơ bản trước khi tính.",
            },
          },
          { status: 400 }
        );
      }
    }

    const rules = await loadLegalRulesForDate(admin, period.company_id, period.cutoff_date);

    // Load previous period settlement results for OBD-06 variance check (>20%)
    const prevGrossByEmp = new Map<string, number>();
    const { data: prevResults } = await admin
      .from("payroll_results")
      .select("employee_id, gross_income, payroll_runs!inner(payroll_period_id, run_type)")
      .neq("payroll_runs.payroll_period_id", period.id)
      .eq("payroll_runs.run_type", "END_MONTH_SETTLEMENT")
      .limit(500);
    for (const pr of prevResults ?? []) {
      if (!prevGrossByEmp.has(pr.employee_id)) {
        prevGrossByEmp.set(pr.employee_id, Number(pr.gross_income || 0));
      }
    }

    const editableRun = body.employeeId
      ? (existingRuns ?? []).find((r) => r.status === "CALCULATED" || r.status === "DRAFT")
      : undefined;

    let createdRun: { id: string };
    if (editableRun) {
      createdRun = editableRun;
      await admin
        .from("payroll_results")
        .delete()
        .eq("payroll_run_id", editableRun.id)
        .eq("employee_id", body.employeeId!);
    } else {
      const { data: insertedRun, error: runErr } = await admin
        .from("payroll_runs")
        .insert({
          company_id: period.company_id,
          payroll_period_id: period.id,
          run_type: body.runType,
          run_version: nextVersion,
          status: body.isSimulation ? "DRAFT" : "CALCULATED",
          legal_rule_snapshot: {
            ruleVersion: rules.ruleVersion,
            isSimulation: Boolean(body.isSimulation),
            cutoffDay: 25,
            advanceDay: 15,
          },
          created_by: ctx.userId,
        })
        .select("*")
        .single();
      if (runErr || !insertedRun) throw runErr;
      createdRun = insertedRun;
    }

    let totalGross = new Decimal(0);
    let totalNet = new Decimal(0);
    let computedCount = 0;

    for (const emp of targetEmployees) {
      const sal = (salaryAssignments ?? []).find((s) => s.employee_id === emp.id);
      if (!sal) continue;

      const org = (orgAssignments ?? []).find((o) => o.employee_id === emp.id);
      const att = (attSummaries ?? []).find((a) => a.employee_id === emp.id);
      const tax = (taxProfiles ?? []).find((t) => t.employee_id === emp.id);
      const ins = (insProfiles ?? []).find((i) => i.employee_id === emp.id);

      const baseSalary = Number(sal.base_salary);
      const siSalaryBase = Number(sal.si_salary_base);

      if (body.runType === "MID_MONTH_ADVANCE") {
        // Đợt 1 (ngày 15): ứng 50% lương cơ bản, chưa cộng phụ cấp, chưa trừ BHXH/Thuế
        const advAmount = calcMidMonthAdvance(baseSalary);
        const { data: resRow, error: resErr } = await admin
          .from("payroll_results")
          .insert({
            payroll_run_id: createdRun.id,
            employee_id: emp.id,
            cost_center_id: org?.cost_center_id ?? null,
            base_salary_snapshot: baseSalary,
            gross_income: advAmount.toNumber(),
            full_month_net: 0,
            mid_month_advance_paid: advAmount.toNumber(),
            net_payable: advAmount.toNumber(),
            explanation_json: {
              runType: "MID_MONTH_ADVANCE",
              formula: "50% × Lương cơ bản hợp đồng (chưa tính phụ cấp/khấu trừ)",
            },
          })
          .select("id")
          .single();
        if (resErr) throw resErr;

        await admin.from("payroll_items").insert({
          payroll_result_id: resRow.id,
          component_code: "MID_MONTH_ADVANCE_50",
          category: "EARNING",
          tier_source: "CONTRACT_BASE",
          quantity: 0.5,
          rate: baseSalary,
          amount: advAmount.toNumber(),
          tax_exempt_amount: 0,
          explanation_text: "Tạm ứng đợt 1 ngày 15 (50% lương cơ bản)",
        });

        totalGross = totalGross.plus(advAmount);
        totalNet = totalNet.plus(advAmount);
        computedCount += 1;
        continue;
      }

      // Đợt 2 (cuối tháng): quyết toán cả tháng trừ đi tạm ứng ngày 15
      const stdDays = Number(att?.standard_days ?? period.standard_work_days ?? 22);
      const paidDays = Number(att?.paid_days ?? stdDays);
      const proratedBase = new Decimal(baseSalary)
        .times(paidDays)
        .div(stdDays)
        .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

      const resolvedAllowances = resolveEmployeeAllowances({
        employeeId: emp.id,
        departmentId: org?.department_id ?? null,
        positionId: org?.position_id ?? null,
        paidWorkDays: paidDays,
        components: (components ?? []).map((c) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          category: c.category,
          calcMode: c.calc_mode,
          isTaxable: c.is_taxable,
          taxExemptRuleCode: c.tax_exempt_rule_code,
          taxExemptCap: Number(c.tax_exempt_cap ?? 0),
        })),
        deptPolicies: (deptPolicies ?? []).map((p) => ({
          departmentId: p.department_id,
          positionId: p.position_id,
          salaryComponentId: p.salary_component_id,
          defaultAmount: Number(p.default_amount),
          calcMode: p.calc_mode as AllowanceCalcMode,
        })),
        empOverrides: (empOverrides ?? []).map((o) => ({
          employeeId: o.employee_id,
          salaryComponentId: o.salary_component_id,
          overrideAmount: Number(o.override_amount),
          calcMode: o.calc_mode as AllowanceCalcMode,
        })),
        periodVariables: (periodVariables ?? []).map((v) => ({
          employeeId: v.employee_id,
          salaryComponentId: v.salary_component_id,
          amount: Number(v.amount),
          quantity: Number(v.quantity),
        })),
      });

      const midMonthAdvancePaid =
        advancePaidByEmployee.get(emp.id) ?? calcMidMonthAdvance(baseSalary).toNumber();

      // Calculate OT Pay from attendance_summaries (Art. 98 Labor Code 2019 & OBD-03)
      const otWeekdayHours = Number(att?.ot_hours_weekday ?? 0);
      const otWeekendHours = Number(att?.ot_hours_weekend ?? 0);
      const otHolidayHours = Number(att?.ot_hours_holiday ?? 0);
      const nightHours = Number(att?.night_hours ?? 0);
      const otPay = calcOvertimePay({
        baseSalary,
        standardWorkDays: stdDays,
        otWeekdayHours,
        otWeekendHours,
        otHolidayHours,
        nightHours,
      });

      const isNetContract = sal.pay_structure === "NET";
      const commonInput = {
        regionCode: ((ins?.region_code as RegionCode) ?? "III"),
        dependentsCount: Number(tax?.dependent_count ?? 0),
        isForeignWorker: Boolean(emp.is_foreign_worker),
        isProbationFlat10: tax?.pit_method === "FLAT_10",
        lunchCashAllowance: resolvedAllowances.lunchCashAllowance,
        taxableAllowancesAndBonuses: new Decimal(
          resolvedAllowances.taxableAllowancesAndBonuses
        ).plus(otPay.totalOtPay),
        midMonthAdvancePaid,
        isUnionMember: emp.employment_status === "ACTIVE",
        rules,
      };

      const calc = isNetContract
        ? solveNetToGross(proratedBase, commonInput).result
        : calculateGrossPayroll({
            ...commonInput,
            baseSalaryPaid: proratedBase,
            siSalaryBase,
          });

      const fullMonthWithNonTax = calc.fullMonthNet.plus(
        resolvedAllowances.otherNonTaxableAllowances
      );
      const diff = fullMonthWithNonTax.minus(midMonthAdvancePaid);
      const endPayable = diff.gt(0) ? diff : new Decimal(0);
      const carryover = diff.lt(0) ? diff.abs() : new Decimal(0);
      const grossWithNonTax = calc.grossTotal.plus(
        resolvedAllowances.otherNonTaxableAllowances
      );

      // OBD-04 & OBD-06 Automated Audit Warnings
      const warnings: string[] = [];
      if (paidDays < 14) {
        warnings.push("BHXH_EXEMPT_MONTH (< 14 ngày công hưởng lương)");
      }
      const prevGross = prevGrossByEmp.get(emp.id);
      if (prevGross && prevGross > 0) {
        const varianceRatio = Math.abs(grossWithNonTax.toNumber() - prevGross) / prevGross;
        if (varianceRatio > 0.2) {
          warnings.push(`VARIANCE_OVER_20% (${Math.round(varianceRatio * 100)}%)`);
        }
      }

      const { data: resRow, error: resErr } = await admin
        .from("payroll_results")
        .insert({
          payroll_run_id: createdRun.id,
          employee_id: emp.id,
          cost_center_id: org?.cost_center_id ?? null,
          base_salary_snapshot: baseSalary,
          gross_income: grossWithNonTax.toNumber(),
          si_base_bhxh: calc.bhxhBase.toNumber(),
          si_base_bhtn: calc.bhtnBase.toNumber(),
          ee_insurance_total: calc.eeInsuranceTotal.toNumber(),
          er_insurance_total: calc.erInsuranceTotal.toNumber(),
          tax_exempt_income: calc.taxExemptIncome
            .plus(resolvedAllowances.otherNonTaxableAllowances)
            .toNumber(),
          assessable_income: calc.assessableIncome.toNumber(),
          personal_deduction:
            tax?.self_deduction_eligible === false ? 0 : rules.selfDeduction.toNumber(),
          dependent_deduction:
            Number(tax?.dependent_count ?? 0) * rules.dependentDeduction.toNumber(),
          taxable_income: calc.taxableIncome.toNumber(),
          pit_amount: calc.pitAmount.toNumber(),
          other_deductions: calc.eeUnionDues.toNumber(),
          full_month_net: fullMonthWithNonTax.toNumber(),
          mid_month_advance_paid: midMonthAdvancePaid,
          net_payable: endPayable.toNumber(),
          negative_balance_carryover: carryover.toNumber(),
          employer_total_cost: calc.employerTotalCost
            .plus(resolvedAllowances.otherNonTaxableAllowances)
            .plus(calc.erUnionFee)
            .toNumber(),
          explanation_json: {
            runType: "END_MONTH_SETTLEMENT",
            ruleVersion: rules.ruleVersion,
            payStructure: sal.pay_structure,
            isSimulation: Boolean(body.isSimulation),
            paidDays,
            stdDays,
            workedDays: paidDays,
            standardDays: stdDays,
            otPay: otPay.totalOtPay.toNumber(),
            eeUnionDues: calc.eeUnionDues.toNumber(),
            unionFeeEr: calc.erUnionFee.toNumber(),
            warnings,
            allowanceTiers: resolvedAllowances.lines.map((l) => ({
              code: l.componentCode,
              tier: l.tierSource,
              amount: l.totalAmount,
            })),
          },
        })
        .select("id")
        .single();
      if (resErr) throw resErr;

      const itemsToInsert = [
        {
          payroll_result_id: resRow.id,
          component_code: "BASE_SALARY",
          category: "EARNING",
          tier_source: "CONTRACT_BASE",
          quantity: paidDays,
          rate: baseSalary / stdDays,
          amount: proratedBase.toNumber(),
          tax_exempt_amount: 0,
          explanation_text: `Lương cơ bản ${paidDays}/${stdDays} công`,
        },
        ...resolvedAllowances.lines.map((line) => ({
          payroll_result_id: resRow.id,
          salary_component_id: line.salaryComponentId,
          component_code: line.componentCode,
          category: line.category,
          tier_source: line.tierSource,
          quantity: line.quantity,
          rate: line.rate,
          amount: line.totalAmount,
          tax_exempt_amount: line.taxExemptAmount,
          explanation_text: `${line.componentName} (${line.tierSource})`,
        })),
        ...(otPay.totalOtPay.gt(0)
          ? [
              {
                payroll_result_id: resRow.id,
                component_code: "OVERTIME_PAY",
                category: "EARNING",
                tier_source: "STATUTORY_OT",
                quantity:
                  otWeekdayHours + otWeekendHours + otHolidayHours + nightHours,
                rate: otPay.hourlyRate.toNumber(),
                amount: otPay.totalOtPay.toNumber(),
                tax_exempt_amount: Decimal.max(
                  0,
                  otPay.totalOtPay.minus(
                    otPay.hourlyRate.times(
                      otWeekdayHours + otWeekendHours + otHolidayHours,
                    ),
                  ),
                ).toNumber(),
                explanation_text: `Làm thêm giờ (T:${otWeekdayHours}h/N:${otWeekendHours}h/L:${otHolidayHours}h/Đêm:${nightHours}h)`,
              },
            ]
          : []),
      ];
      await admin.from("payroll_items").insert(itemsToInsert);

      totalGross = totalGross.plus(grossWithNonTax);
      totalNet = totalNet.plus(endPayable);
      computedCount += 1;
    }

    let finalTotalEmployees = computedCount;
    let finalTotalGross = totalGross.toNumber();
    let finalTotalNet = totalNet.toNumber();

    if (editableRun) {
      const { data: allRunResults } = await admin
        .from("payroll_results")
        .select("gross_income, net_payable")
        .eq("payroll_run_id", createdRun.id);
      const rows = allRunResults ?? [];
      finalTotalEmployees = rows.length;
      finalTotalGross = rows.reduce((acc, r) => acc + Number(r.gross_income || 0), 0);
      finalTotalNet = rows.reduce((acc, r) => acc + Number(r.net_payable || 0), 0);
    }

    const { data: updatedRun } = await admin
      .from("payroll_runs")
      .update({
        total_employees: finalTotalEmployees,
        total_gross_amount: finalTotalGross,
        total_net_payable: finalTotalNet,
      })
      .eq("id", createdRun.id)
      .select("*")
      .single();

    let employeeResult: Record<string, unknown> | null = null;
    if (body.employeeId) {
      const { data: singleRes } = await admin
        .from("payroll_results")
        .select(
          "*, employees(employee_code, full_name), payroll_items(id, component_code, category, tier_source, quantity, rate, amount, tax_exempt_amount, explanation_text)"
        )
        .eq("payroll_run_id", createdRun.id)
        .eq("employee_id", body.employeeId)
        .single();
      employeeResult = singleRes ?? null;
    }

    await admin.from("audit_events").insert({
      company_id: period.company_id,
      actor_user_id: ctx.userId,
      actor_role: ctx.roles[0],
      action: body.employeeId ? "PAYROLL_SINGLE_EMPLOYEE_CALCULATE" : "PAYROLL_RUN_CALCULATE",
      target_entity: "payroll_runs",
      target_id: createdRun.id,
      after_data: {
        runType: body.runType,
        employeeId: body.employeeId ?? null,
        totalEmployees: finalTotalEmployees,
        totalNetPayable: finalTotalNet,
      },
    });

    return NextResponse.json(
      { data: { ...updatedRun, employeeResult } },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}

