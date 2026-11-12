import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, resolveAuthContext } from "@/lib/security/auth-session";
import { assertAuthorized } from "@/lib/security/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const createPeriodSchema = z.object({
  periodYear: z.number().int().min(2025).max(2050),
  periodMonth: z.number().int().min(1).max(12),
  standardWorkDays: z.number().positive().max(31).default(22),
});

const upsertSalarySchema = z.object({
  employeeId: z.string().uuid(),
  baseSalary: z.number().positive(),
  siSalaryBase: z.number().nonnegative(),
  dependentsCount: z.number().int().min(0).max(20).default(0),
});

function buildPeriodDates(year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    periodCode: `${year}-${pad(month)}`,
    startDate: `${prevYear}-${pad(prevMonth)}-26`,
    endDate: `${year}-${pad(month)}-25`,
    cutoffDate: `${year}-${pad(month)}-25`,
    advancePayDate: `${year}-${pad(month)}-15`,
    settlementPayDate: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}

export async function GET() {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "PAYROLL", "READ");

    const admin = getSupabaseAdminClient();
    const isAdminOrExec = ctx.roles.some((r) =>
      ["HR_ADMIN", "HR_STAFF", "ACCOUNTANT", "DIRECTOR", "AUDITOR"].includes(r)
    );

    const [periodsRes, employeesRes, salariesRes, taxRes] = await Promise.all([
      admin
        .from("payroll_periods")
        .select("*")
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false }),
      isAdminOrExec
        ? admin
            .from("employees")
            .select("id, employee_code, full_name, employment_status, is_foreign_worker, org_assignments!org_assignments_employee_id_fkey(department_id, position_id, location_id, cost_center_id, is_primary)")
            .order("employee_code")
        : Promise.resolve({ data: [] }),
      isAdminOrExec
        ? admin
            .from("salary_assignments")
            .select("id, employee_id, pay_structure, base_salary, si_salary_base, effective_from")
            .order("effective_from", { ascending: false })
        : Promise.resolve({ data: [] }),
      isAdminOrExec
        ? admin
            .from("tax_profiles")
            .select("employee_id, dependent_count, pit_method")
        : Promise.resolve({ data: [] }),
    ]);

    if (periodsRes.error) throw periodsRes.error;

    return NextResponse.json({
      data: {
        periods: periodsRes.data ?? [],
        employees: employeesRes.data ?? [],
        salaryAssignments: salariesRes.data ?? [],
        taxProfiles: taxRes.data ?? [],
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "PAYROLL", "CREATE");

    const raw = await req.json();
    const admin = getSupabaseAdminClient();

    const { data: company, error: compErr } = await admin
      .from("companies")
      .select("id")
      .limit(1)
      .single();
    if (compErr || !company) throw new Error("Không tìm thấy pháp nhân.");

    if (raw && typeof raw === "object" && "employeeId" in raw) {
      const body = upsertSalarySchema.parse(raw);
      const { data: sal, error: salErr } = await admin
        .from("salary_assignments")
        .insert({
          company_id: company.id,
          employee_id: body.employeeId,
          pay_structure: "GROSS",
          base_salary: body.baseSalary,
          si_salary_base: body.siSalaryBase,
          effective_from: new Date().toISOString().slice(0, 10),
          approved_by: ctx.userId,
          approved_at: new Date().toISOString(),
        })
        .select("*")
        .single();
      if (salErr) throw salErr;

      await admin.from("tax_profiles").delete().eq("employee_id", body.employeeId);
      await admin.from("tax_profiles").insert({
        company_id: company.id,
        employee_id: body.employeeId,
        residency_status: "RESIDENT",
        pit_method: "PROGRESSIVE",
        self_deduction_eligible: true,
        dependent_count: body.dependentsCount,
      });

      return NextResponse.json({ data: sal }, { status: 201 });
    }

    const body = createPeriodSchema.parse(raw);
    const dates = buildPeriodDates(body.periodYear, body.periodMonth);

    const { data: created, error } = await admin
      .from("payroll_periods")
      .insert({
        company_id: company.id,
        period_code: dates.periodCode,
        period_month: body.periodMonth,
        period_year: body.periodYear,
        start_date: dates.startDate,
        end_date: dates.endDate,
        cutoff_date: dates.cutoffDate,
        advance_pay_date: dates.advancePayDate,
        settlement_pay_date: dates.settlementPayDate,
        standard_work_days: body.standardWorkDays,
        status: "OPEN",
      })
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

