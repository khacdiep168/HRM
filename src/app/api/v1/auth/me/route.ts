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

    const admin = getSupabaseAdminClient();
    let employeeProfile: {
      id: string;
      employee_code: string;
      full_name: string;
      work_email: string | null;
      employment_status: string;
    } | null = null;

    let userAvatarUrl: string | null = null;

    // Fetch avatar registry from legal_rule_registry (safe database storage, never in JWT cookie)
    const { data: avatarRule } = await admin
      .from("legal_rule_registry")
      .select("parameters")
      .eq("rule_code", "EMPLOYEE_AVATARS")
      .maybeSingle();

    const avatarsMap = (avatarRule?.parameters as Record<string, string>) ?? {};

    // Check employee profile & avatar registry
    if (ctx.employeeId) {
      const { data: emp } = await admin
        .from("employees")
        .select("id, employee_code, full_name, work_email, employment_status")
        .eq("id", ctx.employeeId)
        .maybeSingle();

      employeeProfile = emp ?? null;
      userAvatarUrl = avatarsMap[ctx.employeeId] ?? null;
    }

    if (!userAvatarUrl && ctx.userId) {
      userAvatarUrl = avatarsMap[ctx.userId] ?? null;
    }

    // Get company logo and name for header/sidebar branding
    const { data: compRule } = await admin
      .from("legal_rule_registry")
      .select("parameters")
      .eq("rule_code", "COMPANY_PROFILE")
      .maybeSingle();
    const compExtra = (compRule?.parameters as Record<string, unknown>) ?? {};

    return NextResponse.json({
      data: {
        userId: ctx.userId,
        email: user?.email ?? null,
        employeeId: ctx.employeeId,
        employee: employeeProfile,
        avatarUrl: userAvatarUrl,
        roles: ctx.roles,
        mfaVerified: ctx.mfaVerified,
        company: {
          legalName: (compExtra.legalName as string) ?? "CÔNG TY TNHH TM THẾ KỶ VÀNG",
          logoUrl: (compExtra.logoUrl as string) ?? null,
        },
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

