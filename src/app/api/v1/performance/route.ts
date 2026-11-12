import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveAuthContext, handleApiError } from "@/lib/security/auth-session";
import { assertAuthorized, assertNotSelfApproval } from "@/lib/security/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const createCycleSchema = z.object({
  entity: z.literal("cycle"),
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(3).max(120),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["DRAFT", "OPEN", "CLOSED"]).default("OPEN"),
});

const createGoalSchema = z.object({
  entity: z.literal("goal").optional(),
  cycle_id: z.string().uuid(),
  employee_id: z.string().uuid(),
  title: z.string().trim().min(3).max(200),
  metric_target: z.string().trim().max(200).optional(),
  weight_percent: z.number().min(1).max(100).default(25),
});

const createReviewSchema = z.object({
  entity: z.literal("review"),
  cycle_id: z.string().uuid(),
  employee_id: z.string().uuid(),
  self_score: z.number().min(0).max(100).optional(),
  summary_note: z.string().trim().max(1000).optional(),
});

const patchGoalSchema = z.object({
  entity: z.literal("goal"),
  id: z.string().uuid(),
  progress_percent: z.number().min(0).max(100),
  status: z.enum(["DRAFT", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
});

const patchReviewSchema = z.object({
  entity: z.literal("review"),
  id: z.string().uuid(),
  self_score: z.number().min(0).max(100).optional(),
  manager_score: z.number().min(0).max(100).optional(),
  final_rating: z
    .enum(["A_OUTSTANDING", "B_EXCEEDS", "C_MEETS", "D_NEEDS_IMPROVEMENT"])
    .optional(),
  summary_note: z.string().trim().max(1000).optional(),
  status: z
    .enum(["SELF_REVIEW", "MANAGER_REVIEW", "CALIBRATED", "FINALIZED"])
    .optional(),
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
    assertAuthorized(auth, "PERFORMANCE", "READ");

    const supabase = getSupabaseAdminClient();
    const companyId = await getCompanyId(supabase);
    const isEmployeeOnly = !auth.roles.some((r) =>
      ["HR_ADMIN", "HR_STAFF", "DEPARTMENT_MANAGER", "DIRECTOR", "AUDITOR"].includes(r)
    );

    const cyclesPromise = supabase
      .from("performance_cycles")
      .select("id, code, name, start_date, end_date, status, created_at")
      .eq("company_id", companyId)
      .order("start_date", { ascending: false });

    let goalsQuery = supabase
      .from("goals")
      .select(
        "id, cycle_id, employee_id, title, metric_target, weight_percent, progress_percent, status, created_at, employees(id, employee_code, full_name), performance_cycles(id, code, name)"
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    let reviewsQuery = supabase
      .from("performance_reviews")
      .select(
        "id, cycle_id, employee_id, reviewer_user_id, self_score, manager_score, final_rating, summary_note, status, created_at, employees(id, employee_code, full_name), performance_cycles(id, code, name)"
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (isEmployeeOnly && auth.employeeId) {
      goalsQuery = goalsQuery.eq("employee_id", auth.employeeId);
      reviewsQuery = reviewsQuery.eq("employee_id", auth.employeeId);
    }

    const employeesPromise = supabase
      .from("employees")
      .select("id, employee_code, full_name")
      .eq("company_id", companyId)
      .neq("employment_status", "TERMINATED")
      .order("employee_code", { ascending: true });

    const [cyclesRes, goalsRes, reviewsRes, employeesRes] = await Promise.all([
      cyclesPromise,
      goalsQuery,
      reviewsQuery,
      employeesPromise,
    ]);

    if (cyclesRes.error) throw cyclesRes.error;
    if (goalsRes.error) throw goalsRes.error;
    if (reviewsRes.error) throw reviewsRes.error;
    if (employeesRes.error) throw employeesRes.error;

    return NextResponse.json({
      cycles: cyclesRes.data ?? [],
      goals: goalsRes.data ?? [],
      reviews: reviewsRes.data ?? [],
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

    if (body?.entity === "cycle") {
      assertAuthorized(auth, "PERFORMANCE", "APPROVE");
      const parsed = createCycleSchema.parse(body);
      const { data, error } = await supabase
        .from("performance_cycles")
        .insert({
          company_id: companyId,
          code: parsed.code,
          name: parsed.name,
          start_date: parsed.start_date,
          end_date: parsed.end_date,
          status: parsed.status,
        })
        .select("*")
        .single();
      if (error) throw error;

      await supabase.from("audit_events").insert({
        company_id: companyId,
        actor_user_id: auth.userId,
        actor_role: actorRole,
        action: "CREATE_PERFORMANCE_CYCLE",
        target_entity: "performance_cycles",
        target_id: data.id,
        after_data: data,
      });

      return NextResponse.json({ cycle: data }, { status: 201 });
    }

    if (body?.entity === "review") {
      assertAuthorized(auth, "PERFORMANCE", "CREATE");
      const parsed = createReviewSchema.parse(body);
      const employeeId =
        isEmployeeOnly && auth.employeeId ? auth.employeeId : parsed.employee_id;

      const { data, error } = await supabase
        .from("performance_reviews")
        .insert({
          company_id: companyId,
          cycle_id: parsed.cycle_id,
          employee_id: employeeId,
          self_score: parsed.self_score ?? null,
          summary_note: parsed.summary_note ?? null,
          status: "SELF_REVIEW",
        })
        .select("*")
        .single();
      if (error) throw error;

      await supabase.from("audit_events").insert({
        company_id: companyId,
        actor_user_id: auth.userId,
        actor_role: actorRole,
        action: "CREATE_PERFORMANCE_REVIEW",
        target_entity: "performance_reviews",
        target_id: data.id,
        after_data: data,
      });

      return NextResponse.json({ review: data }, { status: 201 });
    }

    assertAuthorized(auth, "PERFORMANCE", "CREATE");
    const parsed = createGoalSchema.parse(body);
    const employeeId =
      isEmployeeOnly && auth.employeeId ? auth.employeeId : parsed.employee_id;

    const { data, error } = await supabase
      .from("goals")
      .insert({
        company_id: companyId,
        cycle_id: parsed.cycle_id,
        employee_id: employeeId,
        title: parsed.title,
        metric_target: parsed.metric_target ?? null,
        weight_percent: parsed.weight_percent,
        status: "IN_PROGRESS",
      })
      .select("*")
      .single();
    if (error) throw error;

    await supabase.from("audit_events").insert({
      company_id: companyId,
      actor_user_id: auth.userId,
      actor_role: actorRole,
      action: "CREATE_GOAL",
      target_entity: "goals",
      target_id: data.id,
      after_data: data,
    });

    return NextResponse.json({ goal: data }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await resolveAuthContext();
    const body = await req.json();
    const supabase = getSupabaseAdminClient();
    const companyId = await getCompanyId(supabase);
    const actorRole = auth?.roles[0] ?? "EMPLOYEE";
    const isEmployeeOnly = !auth?.roles.some((r) =>
      ["HR_ADMIN", "HR_STAFF", "DEPARTMENT_MANAGER", "DIRECTOR"].includes(r)
    );

    if (body?.entity === "review") {
      const parsed = patchReviewSchema.parse(body);
      const isManagerAction =
        parsed.manager_score !== undefined ||
        parsed.final_rating !== undefined ||
        parsed.status === "CALIBRATED" ||
        parsed.status === "FINALIZED";

      if (isManagerAction) {
        assertAuthorized(auth, "PERFORMANCE", "APPROVE");
      } else {
        assertAuthorized(auth, "PERFORMANCE", "UPDATE");
      }

      const { data: existing, error: fetchErr } = await supabase
        .from("performance_reviews")
        .select("id, employee_id, employees(user_id)")
        .eq("id", parsed.id)
        .eq("company_id", companyId)
        .single();
      if (fetchErr) throw fetchErr;

      const empRel = existing.employees as unknown as { user_id?: string | null } | null;
      if (isManagerAction && empRel?.user_id) {
        assertNotSelfApproval(auth.userId, empRel.user_id);
      }

      const updatePayload: Record<string, unknown> = {};
      if (parsed.self_score !== undefined) updatePayload.self_score = parsed.self_score;
      if (parsed.manager_score !== undefined) {
        updatePayload.manager_score = parsed.manager_score;
        updatePayload.reviewer_user_id = auth.userId;
      }
      if (parsed.final_rating !== undefined) updatePayload.final_rating = parsed.final_rating;
      if (parsed.summary_note !== undefined) updatePayload.summary_note = parsed.summary_note;
      if (parsed.status !== undefined) updatePayload.status = parsed.status;

      const { data, error } = await supabase
        .from("performance_reviews")
        .update(updatePayload)
        .eq("id", parsed.id)
        .eq("company_id", companyId)
        .select("*")
        .single();
      if (error) throw error;

      await supabase.from("audit_events").insert({
        company_id: companyId,
        actor_user_id: auth.userId,
        actor_role: actorRole,
        action: isManagerAction ? "CALIBRATE_PERFORMANCE_REVIEW" : "UPDATE_PERFORMANCE_REVIEW",
        target_entity: "performance_reviews",
        target_id: data.id,
        after_data: data,
      });

      return NextResponse.json({ review: data });
    }

    assertAuthorized(auth, "PERFORMANCE", "UPDATE");
    const parsed = patchGoalSchema.parse(body);

    const statusValue =
      parsed.status ?? (parsed.progress_percent >= 100 ? "COMPLETED" : "IN_PROGRESS");

    let updateQuery = supabase
      .from("goals")
      .update({
        progress_percent: parsed.progress_percent,
        status: statusValue,
      })
      .eq("id", parsed.id)
      .eq("company_id", companyId);

    if (isEmployeeOnly && auth.employeeId) {
      updateQuery = updateQuery.eq("employee_id", auth.employeeId);
    }

    const { data, error } = await updateQuery.select("*").single();
    if (error) throw error;

    await supabase.from("audit_events").insert({
      company_id: companyId,
      actor_user_id: auth.userId,
      actor_role: actorRole,
      action: "UPDATE_GOAL_PROGRESS",
      target_entity: "goals",
      target_id: data.id,
      after_data: data,
    });

    return NextResponse.json({ goal: data });
  } catch (err) {
    return handleApiError(err);
  }
}
