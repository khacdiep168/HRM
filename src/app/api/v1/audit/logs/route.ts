import { NextResponse } from "next/server";
import { resolveAuthContext, handleApiError } from "@/lib/security/auth-session";
import { assertAuthorized } from "@/lib/security/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  try {
    const auth = await resolveAuthContext();
    assertAuthorized(auth, "ADMIN_AUDIT", "READ");

    const { searchParams } = new URL(req.url);
    const rawLimit = Number(searchParams.get("limit") ?? "50");
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(Math.trunc(rawLimit), 1), 200)
      : 50;

    const supabase = getSupabaseAdminClient();
    const { data: company, error: compErr } = await supabase
      .from("companies")
      .select("id")
      .limit(1)
      .single();
    if (compErr || !company) throw new Error("Không tìm thấy pháp nhân.");

    const [auditRes, accessRes, exportRes] = await Promise.all([
      supabase
        .from("audit_events")
        .select(
          "id, actor_user_id, actor_role, action, target_entity, target_id, after_data, created_at"
        )
        .eq("company_id", company.id)
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase
        .from("access_logs")
        .select(
          "id, actor_user_id, actor_role, access_type, target_entity, target_id, reason, created_at"
        )
        .eq("company_id", company.id)
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase
        .from("export_logs")
        .select(
          "id, actor_user_id, actor_role, module_code, export_format, row_count, file_sha256, created_at"
        )
        .eq("company_id", company.id)
        .order("created_at", { ascending: false })
        .limit(limit),
    ]);

    if (auditRes.error) throw auditRes.error;
    if (accessRes.error) throw accessRes.error;
    if (exportRes.error) throw exportRes.error;

    return NextResponse.json({
      auditEvents: auditRes.data ?? [],
      accessLogs: accessRes.data ?? [],
      exportLogs: exportRes.data ?? [],
    });
  } catch (err) {
    return handleApiError(err);
  }
}
