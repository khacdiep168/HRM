import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, resolveAuthContext } from "@/lib/security/auth-session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerSessionClient } from "@/lib/supabase/server";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại"),
  newPassword: z.string().min(6, "Mật khẩu mới tối thiểu 6 ký tự"),
});

export async function POST(req: Request) {
  try {
    const ctx = await resolveAuthContext();
    if (!ctx?.userId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập để đổi mật khẩu." } },
        { status: 401 }
      );
    }

    const body = changePasswordSchema.parse(await req.json());
    const admin = getSupabaseAdminClient();

    // 1. Get current user's email
    const { data: userRow, error: uErr } = await admin
      .from("users")
      .select("id, email")
      .eq("id", ctx.userId)
      .single();

    if (uErr || !userRow?.email) {
      return NextResponse.json(
        { error: { code: "USER_NOT_FOUND", message: "Không tìm thấy thông tin tài khoản." } },
        { status: 404 }
      );
    }

    // 2. Verify current password using Supabase Auth signIn
    const serverClient = await getSupabaseServerSessionClient();
    if (serverClient) {
      const { error: signInErr } = await serverClient.auth.signInWithPassword({
        email: userRow.email,
        password: body.currentPassword,
      });

      if (signInErr) {
        return NextResponse.json(
          {
            error: {
              code: "INVALID_CURRENT_PASSWORD",
              message: "Mật khẩu hiện tại không chính xác. Vui lòng kiểm tra lại.",
            },
          },
          { status: 400 }
        );
      }
    }

    // 3. Update to new password via Admin API
    const { error: updateErr } = await admin.auth.admin.updateUserById(ctx.userId, {
      password: body.newPassword,
    });

    if (updateErr) {
      return NextResponse.json(
        { error: { code: "PASSWORD_UPDATE_FAILED", message: updateErr.message } },
        { status: 400 }
      );
    }

    // 4. Log Audit
    await admin.from("audit_logs").insert({
      action: "CHANGE_OWN_PASSWORD",
      entity_name: "users",
      record_id: ctx.userId,
      performed_by: ctx.userId,
      details: {
        email: userRow.email,
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      data: {
        message: "Đổi mật khẩu thành công. Vui lòng ghi nhớ mật khẩu mới của bạn.",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
