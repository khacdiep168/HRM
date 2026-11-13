import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, resolveAuthContext } from "@/lib/security/auth-session";
import { computePiiBlindIndex, encryptPii } from "@/lib/security/pii-crypto";
import { assertAuthorized, hasPermission } from "@/lib/security/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const createEmployeeSchema = z.object({
  employeeCode: z.string().min(2).max(32),
  fullName: z.string().min(2).max(255),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  nationality: z.string().default("VN"),
  isForeignWorker: z.boolean().default(false),
  nationalId: z.string().min(9).max(20).optional(),
  phone: z.string().min(8).max(20).optional(),
  workEmail: z.string().email().optional(),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  employmentStatus: z
    .enum(["ONBOARDING", "PROBATION", "ACTIVE", "ON_LEAVE", "TERMINATED"])
    .default("ACTIVE"),
  departmentId: z.string().uuid(),
  positionId: z.string().uuid(),
  locationId: z.string().uuid(),
  costCenterId: z.string().uuid(),
});

export async function GET() {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "EMPLOYEE", "READ");

    const admin = getSupabaseAdminClient();
    const isCompanyWideHrOrExec =
      ctx.roles.some((r) => ["HR_ADMIN", "HR_STAFF", "DIRECTOR", "AUDITOR", "ACCOUNTANT"].includes(r)) ||
      hasPermission(ctx.roles, "EMPLOYEE", "EXPORT");

    let query = admin
      .from("employees")
      .select(
        "*, org_assignments!org_assignments_employee_id_fkey(department_id, position_id, location_id, cost_center_id, is_primary)"
      )
      .order("employee_code");

    if (!isCompanyWideHrOrExec) {
      if (!ctx.employeeId) {
        return NextResponse.json({ data: [], meta: { total: 0 } });
      }
      query = query.eq("id", ctx.employeeId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const empIds = (data ?? []).map((e) => e.id);
    const [contactsRes, contractsRes, salariesRes, taxRes, banksRes] =
      empIds.length > 0
        ? await Promise.all([
            admin
              .from("employee_contacts")
              .select("employee_id, phone_last4, personal_email, emergency_contact_name")
              .in("employee_id", empIds),
            admin
              .from("contracts")
              .select("employee_id, contract_no, contract_type, effective_from, effective_to, status")
              .in("employee_id", empIds)
              .eq("status", "ACTIVE"),
            admin
              .from("salary_assignments")
              .select("employee_id, base_salary, si_salary_base, effective_from")
              .in("employee_id", empIds)
              .order("effective_from", { ascending: false }),
            admin
              .from("tax_profiles")
              .select("employee_id, dependent_count, pit_method")
              .in("employee_id", empIds),
            admin
              .from("employee_bank_accounts")
              .select("employee_id, bank_name, account_last4")
              .in("employee_id", empIds)
              .eq("is_primary", true),
          ])
        : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

    const contactMap = new Map((contactsRes.data ?? []).map((c) => [c.employee_id, c]));
    const contractMap = new Map((contractsRes.data ?? []).map((c) => [c.employee_id, c]));
    const salaryMap = new Map<string, { base_salary: number; si_salary_base: number }>();
    for (const s of salariesRes.data ?? []) {
      if (!salaryMap.has(s.employee_id)) salaryMap.set(s.employee_id, s);
    }
    const taxMap = new Map((taxRes.data ?? []).map((t) => [t.employee_id, t]));
    const bankMap = new Map((banksRes.data ?? []).map((b) => [b.employee_id, b]));

    const enrichedRows = (data ?? []).map((emp) => {
      const contact = contactMap.get(emp.id);
      const contract = contractMap.get(emp.id);
      const salary = salaryMap.get(emp.id);
      const tax = taxMap.get(emp.id);
      const bank = bankMap.get(emp.id);

      const safeEmp = { ...emp };
      delete (safeEmp as Record<string, unknown>).national_id_enc;
      delete (safeEmp as Record<string, unknown>).national_id_hash;
      delete (safeEmp as Record<string, unknown>).tax_code_enc;

      return {
        ...safeEmp,
        national_id_masked: emp.national_id_last4 ? `********${emp.national_id_last4}` : "—",
        phone_masked: contact?.phone_last4 ? `******${contact.phone_last4}` : "—",
        personal_email: contact?.personal_email ?? null,
        emergency_contact_name: contact?.emergency_contact_name ?? null,
        active_contract: contract ?? null,
        salary_info: salary ?? null,
        dependent_count: tax?.dependent_count ?? 0,
        bank_info: bank ?? null,
      };
    });

    return NextResponse.json({
      data: enrichedRows,
      meta: { total: enrichedRows.length },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "EMPLOYEE", "CREATE");

    const body = createEmployeeSchema.parse(await req.json());
    const admin = getSupabaseAdminClient();

    const { data: company, error: compErr } = await admin
      .from("companies")
      .select("id")
      .limit(1)
      .single();
    if (compErr || !company) throw new Error("Không tìm thấy pháp nhân công ty.");

    let nationalIdEnc: string | null = null;
    let nationalIdHash: string | null = null;
    let nationalIdLast4: string | null = null;

    if (body.nationalId) {
      const aesKey = process.env.PII_ENCRYPTION_KEY_BASE64;
      const hmacKey = process.env.PII_HMAC_KEY_BASE64;
      if (!aesKey || !hmacKey) {
        throw new Error("Thiếu PII_ENCRYPTION_KEY_BASE64 hoặc PII_HMAC_KEY_BASE64 để mã hóa CCCD.");
      }
      nationalIdEnc = encryptPii(body.nationalId.trim(), aesKey);
      nationalIdHash = computePiiBlindIndex(body.nationalId, hmacKey);
      nationalIdLast4 = body.nationalId.trim().slice(-4);
    }

    const { data: created, error: insertErr } = await admin
      .from("employees")
      .insert({
        company_id: company.id,
        employee_code: body.employeeCode.trim(),
        full_name: body.fullName.trim(),
        dob: body.dob ?? null,
        gender: body.gender ?? null,
        nationality: body.nationality,
        is_foreign_worker: body.isForeignWorker,
        national_id_enc: nationalIdEnc,
        national_id_hash: nationalIdHash,
        national_id_last4: nationalIdLast4,
        work_email: body.workEmail ?? null,
        employment_status: body.employmentStatus,
        hire_date: body.hireDate,
      })
      .select("id, employee_code, full_name, employment_status")
      .single();

    if (insertErr) throw insertErr;

    await admin.from("org_assignments").insert({
      company_id: company.id,
      employee_id: created.id,
      department_id: body.departmentId,
      position_id: body.positionId,
      location_id: body.locationId,
      cost_center_id: body.costCenterId,
      is_primary: true,
      effective_from: body.hireDate,
    });

    if (body.phone) {
      const aesKey = process.env.PII_ENCRYPTION_KEY_BASE64;
      await admin.from("employee_contacts").upsert({
        company_id: company.id,
        employee_id: created.id,
        phone_enc: aesKey ? encryptPii(body.phone.trim(), aesKey) : null,
        phone_last4: body.phone.trim().slice(-4),
      });
    }

    await admin.from("audit_events").insert({
      company_id: company.id,
      actor_user_id: ctx.userId,
      actor_role: ctx.roles[0],
      action: "CREATE_EMPLOYEE",
      target_entity: "employees",
      target_id: created.id,
      after_data: {
        employee_code: created.employee_code,
        full_name: created.full_name,
        department_id: body.departmentId,
      },
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

const updateEmployeeSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().min(2).max(255).optional(),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).nullable().optional(),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  workEmail: z.string().email().nullable().optional(),
  employmentStatus: z
    .enum(["ONBOARDING", "PROBATION", "ACTIVE", "ON_LEAVE", "TERMINATED"])
    .optional(),
  phone: z.string().min(8).max(20).optional(),
  personalEmail: z.string().email().nullable().optional(),
  socialInsuranceNo: z.string().max(20).nullable().optional(),
  healthInsuranceNo: z.string().max(20).nullable().optional(),
  pitTaxCode: z.string().max(20).nullable().optional(),
  baseSalary: z.number().nonnegative().optional(),
  siSalaryBase: z.number().nonnegative().optional(),
  dependentCount: z.number().int().min(0).max(20).optional(),
  departmentId: z.string().uuid().optional(),
  positionId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  costCenterId: z.string().uuid().optional(),
});

export async function PATCH(req: Request) {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "EMPLOYEE", "UPDATE");

    const body = updateEmployeeSchema.parse(await req.json());
    const admin = getSupabaseAdminClient();

    const { data: company } = await admin
      .from("companies")
      .select("id")
      .limit(1)
      .single();
    if (!company) throw new Error("Không tìm thấy pháp nhân.");

    const empUpdate: Record<string, unknown> = {};
    if (body.fullName !== undefined) empUpdate.full_name = body.fullName.trim();
    if (body.dob !== undefined) empUpdate.dob = body.dob;
    if (body.gender !== undefined) empUpdate.gender = body.gender;
    if (body.hireDate !== undefined) empUpdate.hire_date = body.hireDate;
    if (body.workEmail !== undefined) empUpdate.work_email = body.workEmail;
    if (body.employmentStatus !== undefined)
      empUpdate.employment_status = body.employmentStatus;
    if (body.socialInsuranceNo !== undefined)
      empUpdate.social_insurance_no = body.socialInsuranceNo;
    if (body.healthInsuranceNo !== undefined)
      empUpdate.health_insurance_no = body.healthInsuranceNo;
    if (body.pitTaxCode !== undefined) empUpdate.pit_tax_code = body.pitTaxCode;

    if (Object.keys(empUpdate).length > 0) {
      const { error: updErr } = await admin
        .from("employees")
        .update(empUpdate)
        .eq("id", body.id)
        .eq("company_id", company.id);
      if (updErr) throw updErr;
    }

    if (body.phone !== undefined || body.personalEmail !== undefined) {
      const aesKey = process.env.PII_ENCRYPTION_KEY_BASE64;
      const contactPayload: Record<string, unknown> = {
        company_id: company.id,
        employee_id: body.id,
      };
      if (body.phone) {
        contactPayload.phone_enc = aesKey ? encryptPii(body.phone.trim(), aesKey) : null;
        contactPayload.phone_last4 = body.phone.trim().slice(-4);
      }
      if (body.personalEmail !== undefined) {
        contactPayload.personal_email = body.personalEmail;
      }
      await admin
        .from("employee_contacts")
        .upsert(contactPayload, { onConflict: "employee_id" });
    }

    if (body.departmentId || body.positionId || body.locationId || body.costCenterId) {
      const orgUpdate: Record<string, unknown> = {};
      if (body.departmentId) orgUpdate.department_id = body.departmentId;
      if (body.positionId) orgUpdate.position_id = body.positionId;
      if (body.locationId) orgUpdate.location_id = body.locationId;
      if (body.costCenterId) orgUpdate.cost_center_id = body.costCenterId;

      const { data: existingOrg } = await admin
        .from("org_assignments")
        .select("id")
        .eq("employee_id", body.id)
        .eq("company_id", company.id)
        .eq("is_primary", true)
        .limit(1);

      if (existingOrg && existingOrg.length > 0) {
        await admin
          .from("org_assignments")
          .update(orgUpdate)
          .eq("id", existingOrg[0].id);
      } else {
        await admin.from("org_assignments").insert({
          company_id: company.id,
          employee_id: body.id,
          department_id: body.departmentId ?? null,
          position_id: body.positionId ?? null,
          location_id: body.locationId ?? null,
          cost_center_id: body.costCenterId ?? null,
          is_primary: true,
          effective_from: new Date().toISOString().slice(0, 10),
        });
      }
    }

    if (body.baseSalary !== undefined || body.siSalaryBase !== undefined) {
      const { data: prevSal } = await admin
        .from("salary_assignments")
        .select("base_salary, si_salary_base")
        .eq("employee_id", body.id)
        .order("effective_from", { ascending: false })
        .limit(1)
        .single();

      const { error: salErr } = await admin.from("salary_assignments").insert({
        company_id: company.id,
        employee_id: body.id,
        pay_structure: "GROSS",
        base_salary: body.baseSalary ?? prevSal?.base_salary ?? 0,
        si_salary_base: body.siSalaryBase ?? prevSal?.si_salary_base ?? 0,
        effective_from: new Date().toISOString().slice(0, 10),
        created_by: ctx.userId,
        approved_by: ctx.userId,
        approved_at: new Date().toISOString(),
      });
      if (salErr) throw salErr;
    }

    if (body.dependentCount !== undefined) {
      await admin.from("tax_profiles").delete().eq("employee_id", body.id);
      await admin.from("tax_profiles").insert({
        company_id: company.id,
        employee_id: body.id,
        residency_status: "RESIDENT",
        pit_method: "PROGRESSIVE",
        self_deduction_eligible: true,
        dependent_count: body.dependentCount,
      });
    }

    await admin.from("audit_events").insert({
      company_id: company.id,
      actor_user_id: ctx.userId,
      actor_role: ctx.roles[0],
      action: "UPDATE_EMPLOYEE",
      target_entity: "employees",
      target_id: body.id,
      after_data: body,
    });

    return NextResponse.json({ data: { id: body.id, updated: true } });
  } catch (err) {
    return handleApiError(err);
  }
}
