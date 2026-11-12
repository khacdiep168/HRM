import { NextResponse } from "next/server";
import { handleApiError, resolveAuthContext } from "@/lib/security/auth-session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerSessionClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await getSupabaseServerSessionClient();
    if (!supabase) {
      return NextResponse.json(
        {
          error: {
            code: "SUPABASE_NOT_CONFIGURED",
            message:
              "NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY chưa được cấu hình.",
          },
        },
        { status: 503 }
      );
    }

    const ctx = await resolveAuthContext();
    if (!ctx) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "Chưa đăng nhập hoặc tài khoản chưa được kích hoạt trong bảng users.",
          },
        },
        { status: 401 }
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let employeeProfile: {
      id: string;
      employee_code: string;
      full_name: string;
      work_email: string | null;
      employment_status: string;
    } | null = null;

    if (ctx.employeeId) {
      const admin = getSupabaseAdminClient();
      const { data: emp } = await admin
        .from("employees")
        .select("id, employee_code, full_name, work_email, employment_status")
        .eq("id", ctx.employeeId)
        .maybeSingle();
      employeeProfile = emp ?? null;
    }

    return NextResponse.json({
      data: {
        userId: ctx.userId,
        email: user?.email ?? null,
        employeeId: ctx.employeeId,
        employee: employeeProfile,
        roles: ctx.roles,
        mfaVerified: ctx.mfaVerified,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

