import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveAuthContext, handleApiError } from "@/lib/security/auth-session";
import { assertAuthorized } from "@/lib/security/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const createAssetSchema = z.object({
  entity: z.literal("asset"),
  category_id: z.string().uuid(),
  asset_code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(160),
  serial_no: z.string().trim().max(100).optional(),
  purchase_value: z.number().min(0).default(0),
});

const assignAssetSchema = z.object({
  entity: z.literal("assign").optional(),
  asset_id: z.string().uuid(),
  employee_id: z.string().uuid(),
  handover_note: z.string().trim().max(500).optional(),
});

const returnAssetSchema = z.object({
  entity: z.literal("return"),
  assignment_id: z.string().uuid(),
  return_condition: z.enum(["GOOD", "DAMAGED", "LOST"]),
  handover_note: z.string().trim().max(500).optional(),
});

const assetStatusSchema = z.object({
  entity: z.literal("asset_status"),
  asset_id: z.string().uuid(),
  status: z.enum(["AVAILABLE", "ASSIGNED", "MAINTENANCE", "RETIRED"]),
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
    assertAuthorized(auth, "ASSETS", "READ");

    const supabase = getSupabaseAdminClient();
    const companyId = await getCompanyId(supabase);
    const isEmployeeOnly = !auth.roles.some((r) =>
      ["HR_ADMIN", "HR_STAFF", "DEPARTMENT_MANAGER", "ACCOUNTANT", "DIRECTOR", "AUDITOR"].includes(r)
    );

    const categoriesPromise = supabase
      .from("asset_categories")
      .select("id, code, name")
      .eq("company_id", companyId)
      .order("code", { ascending: true });

    const assetsPromise = supabase
      .from("assets")
      .select(
        "id, category_id, asset_code, name, serial_no, purchase_value, status, created_at, asset_categories(id, code, name)"
      )
      .eq("company_id", companyId)
      .order("asset_code", { ascending: true });

    let assignmentsQuery = supabase
      .from("asset_assignments")
      .select(
        "id, asset_id, employee_id, assigned_by, assigned_at, returned_at, return_condition, handover_note, status, assets(id, asset_code, name, serial_no), employees(id, employee_code, full_name)"
      )
      .eq("company_id", companyId)
      .order("assigned_at", { ascending: false });

    if (isEmployeeOnly && auth.employeeId) {
      assignmentsQuery = assignmentsQuery.eq("employee_id", auth.employeeId);
    }

    const employeesPromise = supabase
      .from("employees")
      .select("id, employee_code, full_name")
      .eq("company_id", companyId)
      .neq("employment_status", "TERMINATED")
      .order("employee_code", { ascending: true });

    const [categoriesRes, assetsRes, assignmentsRes, employeesRes] = await Promise.all([
      categoriesPromise,
      assetsPromise,
      assignmentsQuery,
      employeesPromise,
    ]);

    if (categoriesRes.error) throw categoriesRes.error;
    if (assetsRes.error) throw assetsRes.error;
    if (assignmentsRes.error) throw assignmentsRes.error;
    if (employeesRes.error) throw employeesRes.error;

    return NextResponse.json({
      categories: categoriesRes.data ?? [],
      assets: assetsRes.data ?? [],
      assignments: assignmentsRes.data ?? [],
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
    const actorRole = auth?.roles[0] ?? "HR_ADMIN";

    if (body?.entity === "asset") {
      assertAuthorized(auth, "ASSETS", "CREATE");
      const parsed = createAssetSchema.parse(body);

      const { data, error } = await supabase
        .from("assets")
        .insert({
          company_id: companyId,
          category_id: parsed.category_id,
          asset_code: parsed.asset_code,
          name: parsed.name,
          serial_no: parsed.serial_no ?? null,
          purchase_value: parsed.purchase_value,
          status: "AVAILABLE",
        })
        .select("*")
        .single();
      if (error) throw error;

      await supabase.from("audit_events").insert({
        company_id: companyId,
        actor_user_id: auth.userId,
        actor_role: actorRole,
        action: "CREATE_ASSET",
        target_entity: "assets",
        target_id: data.id,
        after_data: data,
      });

      return NextResponse.json({ asset: data }, { status: 201 });
    }

    assertAuthorized(auth, "ASSETS", "UPDATE");
    const parsed = assignAssetSchema.parse(body);

    const { data: asset, error: assetErr } = await supabase
      .from("assets")
      .select("id, status")
      .eq("id", parsed.asset_id)
      .eq("company_id", companyId)
      .single();
    if (assetErr) throw assetErr;

    if (asset.status !== "AVAILABLE") {
      return NextResponse.json(
        { error: "Tài sản hiện không ở trạng thái AVAILABLE để bàn giao" },
        { status: 400 }
      );
    }

    const { data: assignment, error: assignErr } = await supabase
      .from("asset_assignments")
      .insert({
        company_id: companyId,
        asset_id: parsed.asset_id,
        employee_id: parsed.employee_id,
        assigned_by: auth.userId,
        handover_note: parsed.handover_note ?? null,
        status: "ACTIVE",
      })
      .select("*")
      .single();
    if (assignErr) throw assignErr;

    const { error: updateAssetErr } = await supabase
      .from("assets")
      .update({ status: "ASSIGNED" })
      .eq("id", parsed.asset_id)
      .eq("company_id", companyId);
    if (updateAssetErr) throw updateAssetErr;

    await supabase.from("audit_events").insert({
      company_id: companyId,
      actor_user_id: auth.userId,
      actor_role: actorRole,
      action: "ASSIGN_ASSET",
      target_entity: "asset_assignments",
      target_id: assignment.id,
      after_data: assignment,
    });

    return NextResponse.json({ assignment }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await resolveAuthContext();
    assertAuthorized(auth, "ASSETS", "UPDATE");

    const body = await req.json();
    const supabase = getSupabaseAdminClient();
    const companyId = await getCompanyId(supabase);
    const actorRole = auth.roles[0] ?? "HR_ADMIN";

    if (body?.entity === "asset_status") {
      const parsed = assetStatusSchema.parse(body);
      const { data, error } = await supabase
        .from("assets")
        .update({ status: parsed.status })
        .eq("id", parsed.asset_id)
        .eq("company_id", companyId)
        .select("*")
        .single();
      if (error) throw error;

      await supabase.from("audit_events").insert({
        company_id: companyId,
        actor_user_id: auth.userId,
        actor_role: actorRole,
        action: "UPDATE_ASSET_STATUS",
        target_entity: "assets",
        target_id: data.id,
        after_data: data,
      });

      return NextResponse.json({ asset: data });
    }

    const parsed = returnAssetSchema.parse(body);

    const { data: assignment, error: assignFetchErr } = await supabase
      .from("asset_assignments")
      .select("id, asset_id, status")
      .eq("id", parsed.assignment_id)
      .eq("company_id", companyId)
      .single();
    if (assignFetchErr) throw assignFetchErr;

    if (assignment.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Phiếu bàn giao này đã được thu hồi trước đó" },
        { status: 400 }
      );
    }

    const { data: updatedAssignment, error: returnErr } = await supabase
      .from("asset_assignments")
      .update({
        status: "RETURNED",
        returned_at: new Date().toISOString(),
        return_condition: parsed.return_condition,
        handover_note: parsed.handover_note ?? null,
      })
      .eq("id", parsed.assignment_id)
      .eq("company_id", companyId)
      .select("*")
      .single();
    if (returnErr) throw returnErr;

    const nextAssetStatus =
      parsed.return_condition === "GOOD"
        ? "AVAILABLE"
        : parsed.return_condition === "DAMAGED"
          ? "MAINTENANCE"
          : "RETIRED";

    const { error: assetErr } = await supabase
      .from("assets")
      .update({ status: nextAssetStatus })
      .eq("id", assignment.asset_id)
      .eq("company_id", companyId);
    if (assetErr) throw assetErr;

    await supabase.from("audit_events").insert({
      company_id: companyId,
      actor_user_id: auth.userId,
      actor_role: actorRole,
      action: "RETURN_ASSET",
      target_entity: "asset_assignments",
      target_id: updatedAssignment.id,
      after_data: updatedAssignment,
    });

    return NextResponse.json({ assignment: updatedAssignment });
  } catch (err) {
    return handleApiError(err);
  }
}
