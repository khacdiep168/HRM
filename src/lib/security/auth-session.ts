import { NextResponse } from "next/server";
import { getSupabaseAdminClient, MissingSupabaseConfigError } from "../supabase/admin";
import { getSupabaseServerSessionClient } from "../supabase/server";
import { AuthorizationError, type AuthContext, type RoleCode } from "./rbac";

/**
 * Resolves the current authenticated user, their active RBAC roles from `user_roles`,
 * and whether Supabase MFA (AAL2) has been satisfied.
 */
export async function resolveAuthContext(): Promise<AuthContext | null> {
  const supabase = await getSupabaseServerSessionClient();
  if (!supabase) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const mfaVerified = aalData?.currentLevel === "aal2";

  const admin = getSupabaseAdminClient();
  const { data: userRow } = await admin
    .from("users")
    .select("id, employee_id, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!userRow || userRow.status !== "ACTIVE") {
    return null;
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: roleRows } = await admin
    .from("user_roles")
    .select("effective_from, effective_to, roles(code)")
    .eq("user_id", user.id)
    .lte("effective_from", today);

  const roles: RoleCode[] = [];
  for (const row of roleRows ?? []) {
    if (row.effective_to && row.effective_to < today) continue;
    const roleObj = row.roles as unknown as { code?: string } | null;
    if (roleObj?.code) {
      roles.push(roleObj.code as RoleCode);
    }
  }

  if (roles.length === 0) {
    roles.push("EMPLOYEE");
  }

  return {
    userId: user.id,
    employeeId: userRow.employee_id ?? null,
    roles,
    mfaVerified,
  };
}

export function handleApiError(err: unknown) {
  if (err instanceof AuthorizationError) {
    const status =
      err.code === "UNAUTHENTICATED" || err.code === "MFA_REQUIRED" ? 401 : 403;
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status }
    );
  }
  if (err instanceof MissingSupabaseConfigError) {
    return NextResponse.json(
      { error: { code: "SUPABASE_NOT_CONFIGURED", message: err.message } },
      { status: 503 }
    );
  }
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err !== null && "message" in err
        ? String((err as { message: unknown }).message)
        : "Internal server error";
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message } },
    { status: 500 }
  );
}

