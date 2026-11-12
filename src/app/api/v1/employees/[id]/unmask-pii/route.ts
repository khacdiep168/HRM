import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, resolveAuthContext } from "@/lib/security/auth-session";
import { decryptPii } from "@/lib/security/pii-crypto";
import { assertAuthorized } from "@/lib/security/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const unmaskSchema = z.object({
  reason: z.string().trim().min(8, "Phải nhập lý do xem CCCD tối thiểu 8 ký tự."),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "EMPLOYEE_SENSITIVE", "UNMASK_PII");

    const { id } = await context.params;
    const { reason } = unmaskSchema.parse(await req.json());
    const admin = getSupabaseAdminClient();

    const { data: emp, error } = await admin
      .from("employees")
      .select("id, company_id, employee_code, national_id_enc")
      .eq("id", id)
      .single();

    if (error || !emp) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Không tìm thấy nhân viên." } },
        { status: 404 }
      );
    }

    const aesKey = process.env.PII_ENCRYPTION_KEY_BASE64;
    if (!aesKey) {
      throw new Error("Thiếu PII_ENCRYPTION_KEY_BASE64 trên server.");
    }

    const nationalIdPlain = emp.national_id_enc
      ? decryptPii(emp.national_id_enc, aesKey)
      : null;

    // Mandatory PDPL audit trail in immutable access_logs
    await admin.from("access_logs").insert({
      company_id: emp.company_id,
      actor_user_id: ctx.userId,
      actor_role: ctx.roles[0],
      access_type: "UNMASK_PII",
      target_entity: "employees",
      target_id: emp.id,
      reason,
    });

    return NextResponse.json({
      data: {
        employeeId: emp.id,
        employeeCode: emp.employee_code,
        nationalId: nationalIdPlain,
        loggedToAccessLogs: true,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

