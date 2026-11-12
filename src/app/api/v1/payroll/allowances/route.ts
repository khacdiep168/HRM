import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, resolveAuthContext } from "@/lib/security/auth-session";
import { assertAuthorized } from "@/lib/security/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const upsertAllowanceSchema = z.discriminatedUnion("tier", [
  z.object({
    tier: z.literal("DEPARTMENT_POLICY"),
    departmentId: z.string().uuid(),
    positionId: z.string().uuid().nullable().optional(),
    salaryComponentId: z.string().uuid(),
    defaultAmount: z.number().min(0),
    calcMode: z.enum(["FIXED_MONTHLY", "PER_WORKDAY", "VARIABLE_INPUT"]),
  }),
  z.object({
    tier: z.literal("EMPLOYEE_OVERRIDE"),
    employeeId: z.string().uuid(),
    salaryComponentId: z.string().uuid(),
    overrideAmount: z.number().min(0),
    calcMode: z.enum(["FIXED_MONTHLY", "PER_WORKDAY", "VARIABLE_INPUT"]),
    reason: z.string().min(4).max(300),
  }),
  z.object({
    tier: z.literal("PERIOD_VARIABLE"),
    payrollPeriodId: z.string().uuid(),
    employeeId: z.string().uuid(),
    salaryComponentId: z.string().uuid(),
    amount: z.number(),
    quantity: z.number().positive().default(1),
    note: z.string().max(300).optional(),
  }),
  z.object({
    tier: z.literal("COMPONENT"),
    code: z.string().min(2).max(40),
    name: z.string().min(2).max(120),
    category: z.enum(["ALLOWANCE", "BONUS"]).default("ALLOWANCE"),
    calcMode: z.enum(["FIXED_MONTHLY", "PER_WORKDAY", "VARIABLE_INPUT"]).default("VARIABLE_INPUT"),
    isTaxable: z.boolean().default(true),
    taxExemptCap: z.number().min(0).default(0),
  }),
  z.object({
    tier: z.literal("AUTO_YEAR_END"),
    mode: z.enum(["BONUS_13", "BONUS_14", "SENIORITY"]),
    payrollPeriodId: z.string().uuid().optional(),
    seniorityPerYear: z.number().min(0).default(300000),
  }),
  z.object({
    tier: z.literal("BULK_RULE"),
    payrollPeriodId: z.string().uuid(),
    salaryComponentId: z.string().uuid(),
    departmentId: z.string().default("ALL"),
    formulaType: z.enum(["FIXED_AMOUNT", "PERCENT_OF_BASE_SALARY"]),
    value: z.number().positive(),
    note: z.string().max(300).optional(),
  }),
  z.object({
    tier: z.literal("BULK_CSV_PERIOD"),
    payrollPeriodId: z.string().uuid(),
    salaryComponentId: z.string().uuid(),
    items: z
      .array(
        z.object({
          employeeCode: z.string().min(1),
          amount: z.number(),
          note: z.string().max(300).optional(),
        })
      )
      .min(1)
      .max(5000),
  }),
]);

export async function GET() {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "PAYROLL", "READ");

    const admin = getSupabaseAdminClient();
    const isPayrollAdminOrAcct = ctx.roles.some((r) =>
      ["HR_ADMIN", "HR_STAFF", "ACCOUNTANT", "DIRECTOR", "AUDITOR"].includes(r)
    );

    if (!isPayrollAdminOrAcct) {
      // Non-privileged roles only receive component metadata + their own overrides
      const [compRes, overrideRes] = await Promise.all([
        admin.from("salary_components").select("id, code, name, category, calc_mode, is_taxable, tax_exempt_cap").order("code"),
        ctx.employeeId
          ? admin
              .from("employee_allowance_overrides")
              .select("id, employee_id, salary_component_id, override_amount, calc_mode, reason")
              .eq("employee_id", ctx.employeeId)
          : Promise.resolve({ data: [] }),
      ]);
      return NextResponse.json({
        data: {
          components: compRes.data ?? [],
          departmentPolicies: [],
          employeeOverrides: overrideRes.data ?? [],
          periodVariables: [],
          departments: [],
          employees: [],
          periods: [],
        },
      });
    }

    const [compRes, deptPolRes, empOverRes, periodVarRes, deptRes, empRes, periodRes] =
      await Promise.all([
        admin
          .from("salary_components")
          .select("id, code, name, category, calc_mode, is_taxable, tax_exempt_rule_code, tax_exempt_cap")
          .eq("is_active", true)
          .order("code"),
        admin
          .from("department_allowance_policies")
          .select("id, department_id, position_id, salary_component_id, default_amount, calc_mode, departments(code, name), salary_components(code, name)")
          .order("created_at", { ascending: false }),
        admin
          .from("employee_allowance_overrides")
          .select("id, employee_id, salary_component_id, override_amount, calc_mode, reason, employees(employee_code, full_name), salary_components(code, name)")
          .order("created_at", { ascending: false }),
        admin
          .from("payroll_period_variables")
          .select("id, payroll_period_id, employee_id, salary_component_id, amount, quantity, source, note, employees(employee_code, full_name), salary_components(code, name), payroll_periods(period_code)")
          .order("created_at", { ascending: false }),
        admin.from("departments").select("id, code, name").eq("status", "ACTIVE").order("code"),
        admin.from("employees").select("id, employee_code, full_name").order("employee_code"),
        admin
          .from("payroll_periods")
          .select("id, period_code, cutoff_date, advance_pay_date, settlement_pay_date, status")
          .order("period_year", { ascending: false })
          .order("period_month", { ascending: false }),
      ]);

    if (compRes.error) throw compRes.error;

    return NextResponse.json({
      data: {
        components: compRes.data ?? [],
        departmentPolicies: deptPolRes.data ?? [],
        employeeOverrides: empOverRes.data ?? [],
        periodVariables: periodVarRes.data ?? [],
        departments: deptRes.data ?? [],
        employees: empRes.data ?? [],
        periods: periodRes.data ?? [],
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "PAYROLL", "UPDATE");

    const body = upsertAllowanceSchema.parse(await req.json());
    const admin = getSupabaseAdminClient();

    const { data: company, error: compErr } = await admin
      .from("companies")
      .select("id")
      .limit(1)
      .single();
    if (compErr || !company) throw new Error("Không tìm thấy pháp nhân công ty.");

    if (body.tier === "DEPARTMENT_POLICY") {
      const { data, error } = await admin
        .from("department_allowance_policies")
        .insert({
          company_id: company.id,
          department_id: body.departmentId,
          position_id: body.positionId ?? null,
          salary_component_id: body.salaryComponentId,
          default_amount: body.defaultAmount,
          calc_mode: body.calcMode,
        })
        .select("*")
        .single();
      if (error) throw error;
      return NextResponse.json({ data }, { status: 201 });
    }

    if (body.tier === "EMPLOYEE_OVERRIDE") {
      const { data, error } = await admin
        .from("employee_allowance_overrides")
        .insert({
          company_id: company.id,
          employee_id: body.employeeId,
          salary_component_id: body.salaryComponentId,
          override_amount: body.overrideAmount,
          calc_mode: body.calcMode,
          reason: body.reason,
          approved_by: ctx.userId,
        })
        .select("*")
        .single();
      if (error) throw error;
      return NextResponse.json({ data }, { status: 201 });
    }

    if (body.tier === "COMPONENT") {
      const normalizedCode = body.code
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_]+/g, "_");
      const { data, error } = await admin
        .from("salary_components")
        .upsert(
          {
            company_id: company.id,
            code: normalizedCode,
            name: body.name.trim(),
            category: body.category,
            calc_mode: body.calcMode,
            is_taxable: body.isTaxable,
            tax_exempt_cap: body.taxExemptCap,
            is_active: true,
          },
          { onConflict: "company_id,code" }
        )
        .select("*")
        .single();
      if (error) throw error;
      return NextResponse.json({ data }, { status: 201 });
    }

    if (body.tier === "AUTO_YEAR_END") {
      const targetCode =
        body.mode === "BONUS_13"
          ? "BONUS_MONTH_13"
          : body.mode === "BONUS_14"
            ? "BONUS_MONTH_14"
            : "SENIORITY_ALLOWANCE";

      const { data: compRow } = await admin
        .from("salary_components")
        .select("id, name")
        .eq("company_id", company.id)
        .eq("code", targetCode)
        .single();
      if (!compRow) {
        return NextResponse.json(
          {
            error: {
              code: "COMPONENT_MISSING",
              message: `Chưa có khoản mục ${targetCode} trong danh mục.`,
            },
          },
          { status: 400 }
        );
      }

      if ((body.mode === "BONUS_13" || body.mode === "BONUS_14") && !body.payrollPeriodId) {
        return NextResponse.json(
          { error: { code: "PERIOD_REQUIRED", message: "Vui lòng chọn kỳ lương để ghi nhận thưởng." } },
          { status: 400 }
        );
      }

      const [{ data: emps }, { data: salaries }] = await Promise.all([
        admin
          .from("employees")
          .select("id, employee_code, full_name, hire_date, employment_status")
          .neq("employment_status", "TERMINATED"),
        admin
          .from("salary_assignments")
          .select("employee_id, base_salary, effective_from")
          .order("effective_from", { ascending: false }),
      ]);

      const now = new Date();
      let appliedCount = 0;

      for (const emp of emps ?? []) {
        const hireDate = emp.hire_date ? new Date(emp.hire_date) : now;
        const monthsWorked = Math.max(
          0,
          (now.getFullYear() - hireDate.getFullYear()) * 12 + (now.getMonth() - hireDate.getMonth())
        );

        if (body.mode === "SENIORITY") {
          const yearsWorked = Math.floor(monthsWorked / 12);
          if (yearsWorked < 1) continue;
          const amount = yearsWorked * body.seniorityPerYear;
          await admin
            .from("employee_allowance_overrides")
            .delete()
            .eq("employee_id", emp.id)
            .eq("salary_component_id", compRow.id);
          await admin.from("employee_allowance_overrides").insert({
            company_id: company.id,
            employee_id: emp.id,
            salary_component_id: compRow.id,
            override_amount: amount,
            calc_mode: "FIXED_MONTHLY",
            reason: `Phụ cấp thâm niên tự động (${yearsWorked} năm công tác × ${body.seniorityPerYear.toLocaleString("vi-VN")}đ)`,
            approved_by: ctx.userId,
          });
          appliedCount += 1;
        } else {
          const sal = (salaries ?? []).find((s) => s.employee_id === emp.id);
          if (!sal) continue;
          const base = Number(sal.base_salary);
          const monthsInYear = Math.min(12, Math.max(1, monthsWorked));
          const bonusAmount = Math.round((base * monthsInYear) / 12);
          await admin.from("payroll_period_variables").upsert(
            {
              company_id: company.id,
              payroll_period_id: body.payrollPeriodId!,
              employee_id: emp.id,
              salary_component_id: compRow.id,
              amount: bonusAmount,
              quantity: 1,
              source: "AUTO_YEAR_END",
              note: `Tự động tính ${compRow.name} (${monthsInYear}/12 tháng làm việc)`,
              approved_by: ctx.userId,
            },
            { onConflict: "payroll_period_id,employee_id,salary_component_id" }
          );
          appliedCount += 1;
        }
      }

      return NextResponse.json(
        {
          data: {
            appliedCount,
            componentName: compRow.name,
            mode: body.mode,
          },
        },
        { status: 201 }
      );
    }

    if (body.tier === "BULK_RULE") {
      const [{ data: emps }, { data: orgs }, { data: salaries }] = await Promise.all([
        admin
          .from("employees")
          .select("id")
          .neq("employment_status", "TERMINATED"),
        admin
          .from("org_assignments")
          .select("employee_id, department_id")
          .eq("is_primary", true),
        admin
          .from("salary_assignments")
          .select("employee_id, base_salary, effective_from")
          .order("effective_from", { ascending: false }),
      ]);

      const deptByEmp = new Map((orgs ?? []).map((o) => [o.employee_id, o.department_id]));
      const salaryByEmp = new Map<string, number>();
      for (const s of salaries ?? []) {
        if (!salaryByEmp.has(s.employee_id)) {
          salaryByEmp.set(s.employee_id, Number(s.base_salary));
        }
      }

      const targetEmps = (emps ?? []).filter(
        (e) => body.departmentId === "ALL" || deptByEmp.get(e.id) === body.departmentId
      );

      const upsertBatch = targetEmps
        .map((e) => {
          const base = salaryByEmp.get(e.id) ?? 0;
          const amount =
            body.formulaType === "PERCENT_OF_BASE_SALARY"
              ? Math.round((base * body.value) / 100)
              : Math.round(body.value);
          if (amount <= 0) return null;
          return {
            company_id: company.id,
            payroll_period_id: body.payrollPeriodId,
            employee_id: e.id,
            salary_component_id: body.salaryComponentId,
            amount,
            quantity: 1,
            source: "BULK_RULE",
            note:
              body.note ||
              (body.formulaType === "PERCENT_OF_BASE_SALARY"
                ? `Áp dụng hàng loạt (${body.value}% Lương cơ bản)`
                : `Áp dụng hàng loạt (${amount.toLocaleString("vi-VN")} đ)`),
            approved_by: ctx.userId,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      if (upsertBatch.length > 0) {
        const { error: upErr } = await admin
          .from("payroll_period_variables")
          .upsert(upsertBatch, { onConflict: "payroll_period_id,employee_id,salary_component_id" });
        if (upErr) throw upErr;
      }

      return NextResponse.json(
        { data: { appliedCount: upsertBatch.length } },
        { status: 201 }
      );
    }

    if (body.tier === "BULK_CSV_PERIOD") {
      const { data: emps } = await admin
        .from("employees")
        .select("id, employee_code")
        .neq("employment_status", "TERMINATED");

      const empIdByCode = new Map(
        (emps ?? []).map((e) => [e.employee_code.trim().toUpperCase(), e.id])
      );

      const upsertBatch: Array<Record<string, unknown>> = [];
      let skipped = 0;

      for (const item of body.items) {
        const empId = empIdByCode.get(item.employeeCode.trim().toUpperCase());
        if (!empId) {
          skipped += 1;
          continue;
        }
        upsertBatch.push({
          company_id: company.id,
          payroll_period_id: body.payrollPeriodId,
          employee_id: empId,
          salary_component_id: body.salaryComponentId,
          amount: Math.round(item.amount),
          quantity: 1,
          source: "BULK_CSV",
          note: item.note ?? "Import hàng loạt từ Excel/CSV",
          approved_by: ctx.userId,
        });
      }

      if (upsertBatch.length > 0) {
        const { error: upErr } = await admin
          .from("payroll_period_variables")
          .upsert(upsertBatch, { onConflict: "payroll_period_id,employee_id,salary_component_id" });
        if (upErr) throw upErr;
      }

      return NextResponse.json(
        { data: { appliedCount: upsertBatch.length, skipped } },
        { status: 201 }
      );
    }

    const { data, error } = await admin
      .from("payroll_period_variables")
      .upsert(
        {
          company_id: company.id,
          payroll_period_id: body.payrollPeriodId,
          employee_id: body.employeeId,
          salary_component_id: body.salaryComponentId,
          amount: body.amount,
          quantity: body.quantity,
          source: "MANUAL",
          note: body.note ?? null,
          approved_by: ctx.userId,
        },
        { onConflict: "payroll_period_id,employee_id,salary_component_id" }
      )
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "PAYROLL", "UPDATE");

    const { searchParams } = new URL(req.url);
    const tier = searchParams.get("tier");
    const id = searchParams.get("id");
    if (!tier || !id) {
      return NextResponse.json(
        { error: { code: "INVALID_PARAMS", message: "Thiếu tier hoặc id cần xóa." } },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdminClient();
    const table =
      tier === "DEPARTMENT_POLICY"
        ? "department_allowance_policies"
        : tier === "EMPLOYEE_OVERRIDE"
          ? "employee_allowance_overrides"
          : tier === "PERIOD_VARIABLE"
            ? "payroll_period_variables"
            : null;

    if (!table) {
      return NextResponse.json(
        { error: { code: "INVALID_TIER", message: "Loại cấu hình không hợp lệ." } },
        { status: 400 }
      );
    }

    const { error } = await admin.from(table).delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ data: { deleted: true, id } });
  } catch (err) {
    return handleApiError(err);
  }
}

