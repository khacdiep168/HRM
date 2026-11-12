import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, resolveAuthContext } from "@/lib/security/auth-session";
import { assertAuthorized } from "@/lib/security/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const consentSchema = z.object({
  purposeCode: z.enum([
    "HR_EMPLOYMENT",
    "PAYROLL_TAX_SI",
    "ATTENDANCE_GPS",
    "ATTENDANCE_BIOMETRIC_FACE_ID",
  ]),
  policyVersion: z.string().min(2).max(32).default("PDPL-TKV-2026.1"),
});

export async function GET() {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "ESS", "READ");
    if (!ctx.employeeId) {
      return NextResponse.json({ data: [] });
    }

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("consent_records")
      .select("id, purpose_code, policy_version, consent_method, consented_at, withdrawn_at")
      .eq("subject_type", "EMPLOYEE")
      .eq("subject_id", ctx.employeeId)
      .order("consented_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "ESS", "CREATE");
    if (!ctx.employeeId) {
      return NextResponse.json(
        { error: { code: "NO_EMPLOYEE_PROFILE", message: "Tài khoản chưa gắn hồ sơ nhân viên." } },
        { status: 400 }
      );
    }

    const body = consentSchema.parse(await req.json());
    const admin = getSupabaseAdminClient();

    const { data: company, error: compErr } = await admin
      .from("companies")
      .select("id")
      .limit(1)
      .single();
    if (compErr || !company) throw new Error("Không tìm thấy pháp nhân.");

    const { data: created, error } = await admin
      .from("consent_records")
      .insert({
        company_id: company.id,
        subject_type: "EMPLOYEE",
        subject_id: ctx.employeeId,
        purpose_code: body.purposeCode,
        policy_version: body.policyVersion,
        consent_method: "ESS_MODAL",
        user_agent: req.headers.get("user-agent"),
      })
      .select("id, purpose_code, policy_version, consented_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

