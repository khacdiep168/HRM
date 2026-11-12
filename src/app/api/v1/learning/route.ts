import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveAuthContext, handleApiError } from "@/lib/security/auth-session";
import { assertAuthorized } from "@/lib/security/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const createCourseSchema = z.object({
  entity: z.literal("course"),
  code: z.string().trim().min(2).max(40),
  title: z.string().trim().min(3).max(200),
  category: z.enum(["COMPLIANCE", "SAFETY", "OPERATIONS", "TECHNICAL", "SOFT_SKILLS"]),
  duration_hours: z.number().min(0.5).max(500).default(2),
  is_mandatory: z.boolean().default(false),
  validity_months: z.number().int().min(1).max(120).nullable().optional(),
});

const createEnrollmentSchema = z.object({
  entity: z.literal("enrollment").optional(),
  course_id: z.string().uuid(),
  employee_id: z.string().uuid(),
});

const patchEnrollmentSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["ENROLLED", "IN_PROGRESS", "COMPLETED", "FAILED"]),
  score: z.number().min(0).max(100).nullable().optional(),
});

async function getCompanyId(supabase: ReturnType<typeof getSupabaseAdminClient>) {
  const { data, error } = await supabase
    .from("companies")
    .select("id")
    .limit(1)
    .single();
  if (error || !data) throw new Error("Không tìm thấy pháp nhân.");
  return data.id;
}

export async function GET() {
  try {
    const auth = await resolveAuthContext();
    assertAuthorized(auth, "LEARNING", "READ");

    const supabase = getSupabaseAdminClient();
    const companyId = await getCompanyId(supabase);
    const isEmployeeOnly = !auth.roles.some((r) =>
      ["HR_ADMIN", "HR_STAFF", "DEPARTMENT_MANAGER", "DIRECTOR", "AUDITOR"].includes(r)
    );

    const coursesPromise = supabase
      .from("courses")
      .select(
        "id, code, title, category, duration_hours, is_mandatory, validity_months, is_active, created_at"
      )
      .eq("company_id", companyId)
      .order("is_mandatory", { ascending: false })
      .order("code", { ascending: true });

    let enrollmentsQuery = supabase
      .from("training_enrollments")
      .select(
        "id, course_id, employee_id, status, score, completed_at, certificate_expires_at, created_at, courses(id, code, title, category, is_mandatory, validity_months), employees(id, employee_code, full_name)"
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (isEmployeeOnly && auth.employeeId) {
      enrollmentsQuery = enrollmentsQuery.eq("employee_id", auth.employeeId);
    }

    const employeesPromise = supabase
      .from("employees")
      .select("id, employee_code, full_name")
      .eq("company_id", companyId)
      .neq("employment_status", "TERMINATED")
      .order("employee_code", { ascending: true });

    const [coursesRes, enrollmentsRes, employeesRes] = await Promise.all([
      coursesPromise,
      enrollmentsQuery,
      employeesPromise,
    ]);

    if (coursesRes.error) throw coursesRes.error;
    if (enrollmentsRes.error) throw enrollmentsRes.error;
    if (employeesRes.error) throw employeesRes.error;

    return NextResponse.json({
      courses: coursesRes.data ?? [],
      enrollments: enrollmentsRes.data ?? [],
      employees: employeesRes.data ?? [],
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await resolveAuthContext();
    const body = await req.json();
    const supabase = getSupabaseAdminClient();
    const companyId = await getCompanyId(supabase);
    const actorRole = auth?.roles[0] ?? "EMPLOYEE";
    const isEmployeeOnly = !auth?.roles.some((r) =>
      ["HR_ADMIN", "HR_STAFF", "DEPARTMENT_MANAGER", "DIRECTOR"].includes(r)
    );

    if (body?.entity === "course") {
      assertAuthorized(auth, "LEARNING", "APPROVE");
      const parsed = createCourseSchema.parse(body);

      const { data, error } = await supabase
        .from("courses")
        .insert({
          company_id: companyId,
          code: parsed.code,
          title: parsed.title,
          category: parsed.category,
          duration_hours: parsed.duration_hours,
          is_mandatory: parsed.is_mandatory,
          validity_months: parsed.validity_months ?? null,
          is_active: true,
        })
        .select("*")
        .single();
      if (error) throw error;

      await supabase.from("audit_events").insert({
        company_id: companyId,
        actor_user_id: auth.userId,
        actor_role: actorRole,
        action: "CREATE_COURSE",
        target_entity: "courses",
        target_id: data.id,
        after_data: data,
      });

      return NextResponse.json({ course: data }, { status: 201 });
    }

    assertAuthorized(auth, "LEARNING", "CREATE");
    const parsed = createEnrollmentSchema.parse(body);
    const employeeId =
      isEmployeeOnly && auth.employeeId ? auth.employeeId : parsed.employee_id;

    const { data, error } = await supabase
      .from("training_enrollments")
      .insert({
        company_id: companyId,
        course_id: parsed.course_id,
        employee_id: employeeId,
        status: "ENROLLED",
      })
      .select("*")
      .single();
    if (error) throw error;

    await supabase.from("audit_events").insert({
      company_id: companyId,
      actor_user_id: auth.userId,
      actor_role: actorRole,
      action: "ENROLL_TRAINING",
      target_entity: "training_enrollments",
      target_id: data.id,
      after_data: data,
    });

    return NextResponse.json({ enrollment: data }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await resolveAuthContext();
    assertAuthorized(auth, "LEARNING", "UPDATE");

    const body = await req.json();
    const parsed = patchEnrollmentSchema.parse(body);
    const supabase = getSupabaseAdminClient();
    const companyId = await getCompanyId(supabase);
    const actorRole = auth.roles[0] ?? "HR_ADMIN";

    const { data: existing, error: fetchErr } = await supabase
      .from("training_enrollments")
      .select("id, courses(validity_months)")
      .eq("id", parsed.id)
      .eq("company_id", companyId)
      .single();
    if (fetchErr) throw fetchErr;

    const courseRel = existing.courses as unknown as { validity_months?: number | null } | null;
    const now = new Date();
    let completedAt: string | null = null;
    let expiresAt: string | null = null;

    if (parsed.status === "COMPLETED") {
      completedAt = now.toISOString();
      if (courseRel?.validity_months) {
        const exp = new Date(now);
        exp.setMonth(exp.getMonth() + courseRel.validity_months);
        expiresAt = exp.toISOString().slice(0, 10);
      }
    }

    const { data, error } = await supabase
      .from("training_enrollments")
      .update({
        status: parsed.status,
        score: parsed.score ?? null,
        completed_at: completedAt,
        certificate_expires_at: expiresAt,
      })
      .eq("id", parsed.id)
      .eq("company_id", companyId)
      .select("*")
      .single();
    if (error) throw error;

    await supabase.from("audit_events").insert({
      company_id: companyId,
      actor_user_id: auth.userId,
      actor_role: actorRole,
      action: "UPDATE_TRAINING_ENROLLMENT",
      target_entity: "training_enrollments",
      target_id: data.id,
      after_data: data,
    });

    return NextResponse.json({ enrollment: data });
  } catch (err) {
    return handleApiError(err);
  }
}
