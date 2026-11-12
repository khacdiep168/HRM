import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, resolveAuthContext } from "@/lib/security/auth-session";
import { assertAuthorized } from "@/lib/security/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const bulkRowSchema = z.object({
  employeeCode: z.string().min(2).max(32),
  fullName: z.string().min(2).max(255),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default("2026-01-01"),
  departmentCode: z.string().optional(),
  positionCode: z.string().optional(),
  baseSalary: z.number().nonnegative().optional(),
  siSalaryBase: z.number().nonnegative().optional(),
  dependentCount: z.number().int().min(0).max(20).optional(),
  phone: z.string().optional(),
  workEmail: z.string().optional(),
});

const bulkImportSchema = z.object({
  rows: z.array(bulkRowSchema).min(1).max(2000),
});

export async function POST(req: Request) {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "EMPLOYEE", "CREATE");

    const body = bulkImportSchema.parse(await req.json());
    const admin = getSupabaseAdminClient();

    const [
      { data: company },
      { data: departments },
      { data: positions },
      { data: locations },
      { data: costCenters },
    ] = await Promise.all([
      admin.from("companies").select("id").limit(1).single(),
      admin.from("departments").select("id, code, name"),
      admin.from("positions").select("id, code, name"),
      admin.from("locations").select("id, code, name").limit(1),
      admin.from("cost_centers").select("id, code, name").limit(1),
    ]);

    if (!company) {
      return NextResponse.json(
        { error: { code: "COMPANY_NOT_FOUND", message: "Không tìm thấy pháp nhân công ty." } },
        { status: 400 }
      );
    }

    const defaultDeptId = (departments ?? [])[0]?.id ?? null;
    const defaultPosId = (positions ?? [])[0]?.id ?? null;
    const defaultLocId = (locations ?? [])[0]?.id ?? null;
    const defaultCcId = (costCenters ?? [])[0]?.id ?? null;

    const deptByCode = new Map(
      (departments ?? []).map((d) => [d.code.trim().toUpperCase(), d.id])
    );
    const posByCode = new Map(
      (positions ?? []).map((p) => [p.code.trim().toUpperCase(), p.id])
    );

    const empPayload = body.rows.map((r) => ({
      company_id: company.id,
      employee_code: r.employeeCode.trim().toUpperCase(),
      full_name: r.fullName.trim(),
      hire_date: r.hireDate,
      employment_status: "ACTIVE",
      nationality: "VN",
      is_foreign_worker: false,
    }));

    const { data: upsertedEmps, error: empErr } = await admin
      .from("employees")
      .upsert(empPayload, { onConflict: "company_id,employee_code" })
      .select("id, employee_code");
    if (empErr) throw empErr;

    const empIdByCode = new Map(
      (upsertedEmps ?? []).map((e) => [e.employee_code.toUpperCase(), e.id])
    );

    const { data: existingOrgs } = await admin
      .from("org_assignments")
      .select("employee_id")
      .in(
        "employee_id",
        Array.from(empIdByCode.values())
      );
    const hasOrg = new Set((existingOrgs ?? []).map((o) => o.employee_id));

    const orgInserts: Array<Record<string, unknown>> = [];
    const salaryInserts: Array<Record<string, unknown>> = [];
    const taxUpserts: Array<Record<string, unknown>> = [];
    const contactUpserts: Array<Record<string, unknown>> = [];
    const today = new Date().toISOString().slice(0, 10);

    for (const r of body.rows) {
      const code = r.employeeCode.trim().toUpperCase();
      const empId = empIdByCode.get(code);
      if (!empId) continue;

      if (!hasOrg.has(empId) && defaultDeptId && defaultPosId && defaultLocId && defaultCcId) {
        orgInserts.push({
          employee_id: empId,
          department_id:
            (r.departmentCode && deptByCode.get(r.departmentCode.trim().toUpperCase())) ||
            defaultDeptId,
          position_id:
            (r.positionCode && posByCode.get(r.positionCode.trim().toUpperCase())) ||
            defaultPosId,
          location_id: defaultLocId,
          cost_center_id: defaultCcId,
          effective_from: r.hireDate,
          is_primary: true,
        });
      }

      if (r.baseSalary && r.baseSalary > 0) {
        salaryInserts.push({
          employee_id: empId,
          pay_structure: "GROSS",
          base_salary: r.baseSalary,
          si_salary_base: r.siSalaryBase && r.siSalaryBase > 0 ? r.siSalaryBase : r.baseSalary,
          effective_from: today,
          approved_by: ctx.userId,
        });
      }

      if (r.dependentCount !== undefined) {
        taxUpserts.push({
          employee_id: empId,
          dependent_count: r.dependentCount,
          pit_method: "PROGRESSIVE",
        });
      }

      if (r.phone || r.workEmail) {
        contactUpserts.push({
          employee_id: empId,
          phone: r.phone ?? null,
          work_email: r.workEmail ?? null,
        });
      }
    }

    await Promise.all([
      orgInserts.length > 0 ? admin.from("org_assignments").insert(orgInserts) : Promise.resolve(),
      salaryInserts.length > 0
        ? admin.from("salary_assignments").insert(salaryInserts)
        : Promise.resolve(),
      taxUpserts.length > 0
        ? admin.from("tax_profiles").upsert(taxUpserts, { onConflict: "employee_id" })
        : Promise.resolve(),
      contactUpserts.length > 0
        ? admin.from("employee_contacts").upsert(contactUpserts, { onConflict: "employee_id" })
        : Promise.resolve(),
    ]);

    return NextResponse.json(
      {
        data: {
          importedCount: upsertedEmps?.length ?? 0,
          salaryUpdatedCount: salaryInserts.length,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}

