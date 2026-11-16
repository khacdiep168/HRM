import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, resolveAuthContext } from "@/lib/security/auth-session";
import { assertAuthorized } from "@/lib/security/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const createUserSchema = z.object({
  email: z.string().email("Email không hợp lệ").trim().toLowerCase(),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
  employeeId: z.string().uuid().nullable().optional(),
  roleCodes: z.array(z.string()).min(1, "Vui lòng chọn ít nhất 1 vai trò"),
  status: z.enum(["ACTIVE", "LOCKED", "DISABLED"]).default("ACTIVE"),
});

const updateUserSchema = z.object({
  userId: z.string().uuid("User ID không hợp lệ"),
  roleCodes: z.array(z.string()).optional(),
  status: z.enum(["ACTIVE", "LOCKED", "DISABLED"]).optional(),
  newPassword: z.string().min(6, "Mật khẩu mới tối thiểu 6 ký tự").optional(),
});

export async function GET() {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "ADMIN_AUDIT", "READ");

    const admin = getSupabaseAdminClient();

    // 1. Fetch all roles
    const { data: roles, error: rolesErr } = await admin
      .from("roles")
      .select("id, code, name, description")
      .order("code");
    if (rolesErr) throw rolesErr;

    // 2. Fetch users
    const { data: users, error: usersErr } = await admin
      .from("users")
      .select("id, email, status, employee_id, mfa_required, mfa_enabled, last_login_at, created_at")
      .order("created_at", { ascending: false });
    if (usersErr) throw usersErr;

    // 3. Fetch user_roles
    const today = new Date().toISOString().slice(0, 10);
    const { data: userRoles, error: urErr } = await admin
      .from("user_roles")
      .select("id, user_id, role_id, effective_from, effective_to")
      .or(`effective_to.is.null,effective_to.gte.${today}`);
    if (urErr) throw urErr;

    // 4. Fetch employees
    const { data: employees, error: empErr } = await admin
      .from("employees")
      .select("id, employee_code, full_name, employment_status, org_assignments!org_assignments_employee_id_fkey(department_id, is_primary)")
      .order("employee_code");
    if (empErr) throw empErr;

    // 5. Fetch departments map
    const { data: depts } = await admin.from("departments").select("id, name");
    const deptMap = new Map<string, string>();
    (depts ?? []).forEach((d) => deptMap.set(d.id, d.name));

    const roleMap = new Map((roles ?? []).map((r) => [r.id, r]));
    const empMap = new Map(
      (employees ?? []).map((e) => {
        const prim = (e.org_assignments as Array<{ department_id: string; is_primary: boolean }> | null)?.find(
          (a) => a.is_primary
        ) ?? (e.org_assignments as Array<{ department_id: string }> | null)?.[0];
        const deptName = (prim && deptMap.get(prim.department_id)) || "Chưa phân bổ";
        return [
          e.id,
          {
            id: e.id,
            employeeCode: e.employee_code,
            fullName: e.full_name,
            status: e.employment_status,
            departmentName: deptName,
          },
        ];
      })
    );

    // Group roles by user_id
    const userRolesMap = new Map<string, Array<{ id: string; code: string; name: string }>>();
    (userRoles ?? []).forEach((ur) => {
      const r = roleMap.get(ur.role_id);
      if (r) {
        const list = userRolesMap.get(ur.user_id) ?? [];
        list.push({ id: r.id, code: r.code, name: r.name });
        userRolesMap.set(ur.user_id, list);
      }
    });

    const enrichedUsers = (users ?? []).map((u) => {
      const emp = u.employee_id ? empMap.get(u.employee_id) : null;
      const assignedRoles = userRolesMap.get(u.id) ?? [{ id: "default", code: "EMPLOYEE", name: "Nhân viên (ESS)" }];
      return {
        id: u.id,
        email: u.email,
        status: u.status,
        employeeId: u.employee_id,
        employeeCode: emp?.employeeCode ?? null,
        fullName: emp?.fullName ?? u.email.split("@")[0],
        departmentName: emp?.departmentName ?? "Hệ thống",
        roles: assignedRoles,
        createdAt: u.created_at,
        lastLoginAt: u.last_login_at,
      };
    });

    return NextResponse.json({
      data: {
        users: enrichedUsers,
        availableRoles: roles ?? [],
        employees: (employees ?? []).map((e) => ({
          id: e.id,
          employeeCode: e.employee_code,
          fullName: e.full_name,
          departmentName: empMap.get(e.id)?.departmentName ?? "Chưa phân bổ",
        })),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "ADMIN_AUDIT", "CREATE");

    const body = createUserSchema.parse(await req.json());
    const admin = getSupabaseAdminClient();

    // 1. Get default company
    const { data: comp } = await admin.from("companies").select("id").limit(1).single();
    const companyId = comp?.id ?? "10000000-0000-4000-8000-000000000001";

    // 2. Check if user already exists in public.users
    const { data: existingUser } = await admin
      .from("users")
      .select("id")
      .eq("email", body.email)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        { error: { code: "USER_EXISTS", message: `Email ${body.email} đã tồn tại trong hệ thống.` } },
        { status: 409 }
      );
    }

    // 3. Create user in Supabase Auth
    let authUserId: string;
    const { data: authCreated, error: authErr } = await admin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        employee_id: body.employeeId ?? undefined,
      },
    });

    if (authErr) {
      // If user exists in Auth but not in public.users, fetch auth user by email
      if (authErr.message?.includes("already been registered")) {
        const { data: userList } = await admin.auth.admin.listUsers();
        const found = userList.users.find((u) => u.email?.toLowerCase() === body.email);
        if (found) {
          authUserId = found.id;
          // Update password for existing auth user
          await admin.auth.admin.updateUserById(authUserId, { password: body.password });
        } else {
          return NextResponse.json(
            { error: { code: "AUTH_ERROR", message: authErr.message } },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          { error: { code: "AUTH_ERROR", message: authErr.message } },
          { status: 400 }
        );
      }
    } else {
      authUserId = authCreated.user.id;
    }

    // 4. Upsert into public.users
    const { error: insertUserErr } = await admin.from("users").upsert({
      id: authUserId,
      company_id: companyId,
      employee_id: body.employeeId || null,
      email: body.email,
      status: body.status,
    });
    if (insertUserErr) throw insertUserErr;

    // 5. Assign roles in public.user_roles
    const { data: allRoles } = await admin.from("roles").select("id, code");
    const roleIdByCode = new Map((allRoles ?? []).map((r) => [r.code, r.id]));

    const today = new Date().toISOString().slice(0, 10);
    const newRoleAssignments = body.roleCodes
      .map((code) => {
        const roleId = roleIdByCode.get(code);
        if (!roleId) return null;
        return {
          user_id: authUserId,
          role_id: roleId,
          effective_from: today,
          granted_by: ctx.userId,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (newRoleAssignments.length > 0) {
      // Remove any prior roles if any
      await admin.from("user_roles").delete().eq("user_id", authUserId);
      const { error: urInsertErr } = await admin.from("user_roles").insert(newRoleAssignments);
      if (urInsertErr) throw urInsertErr;
    }

    // 6. Log Audit
    await admin.from("audit_logs").insert({
      action: "CREATE_USER",
      entity_name: "users",
      record_id: authUserId,
      performed_by: ctx.userId,
      details: {
        email: body.email,
        employee_id: body.employeeId,
        roles: body.roleCodes,
        status: body.status,
      },
    });

    return NextResponse.json({
      data: {
        userId: authUserId,
        email: body.email,
        roles: body.roleCodes,
        status: body.status,
        message: "Tạo tài khoản người dùng và phân quyền thành công.",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "ADMIN_AUDIT", "UPDATE");

    const body = updateUserSchema.parse(await req.json());
    const admin = getSupabaseAdminClient();

    // 1. Update Password if provided
    if (body.newPassword) {
      const { error: pwdErr } = await admin.auth.admin.updateUserById(body.userId, {
        password: body.newPassword,
      });
      if (pwdErr) {
        return NextResponse.json(
          { error: { code: "PASSWORD_UPDATE_FAILED", message: pwdErr.message } },
          { status: 400 }
        );
      }
    }

    // 2. Update Status if provided
    if (body.status) {
      const { error: statusErr } = await admin
        .from("users")
        .update({ status: body.status })
        .eq("id", body.userId);
      if (statusErr) throw statusErr;
    }

    // 3. Update Roles if provided
    if (body.roleCodes) {
      const { data: allRoles } = await admin.from("roles").select("id, code");
      const roleIdByCode = new Map((allRoles ?? []).map((r) => [r.code, r.id]));

      const today = new Date().toISOString().slice(0, 10);
      const newRoleAssignments = body.roleCodes
        .map((code) => {
          const roleId = roleIdByCode.get(code);
          if (!roleId) return null;
          return {
            user_id: body.userId,
            role_id: roleId,
            effective_from: today,
            granted_by: ctx.userId,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      // Delete existing roles and re-insert
      await admin.from("user_roles").delete().eq("user_id", body.userId);
      if (newRoleAssignments.length > 0) {
        const { error: urInsertErr } = await admin.from("user_roles").insert(newRoleAssignments);
        if (urInsertErr) throw urInsertErr;
      }
    }

    // 4. Log Audit
    await admin.from("audit_logs").insert({
      action: "UPDATE_USER",
      entity_name: "users",
      record_id: body.userId,
      performed_by: ctx.userId,
      details: {
        updated_roles: body.roleCodes ?? null,
        updated_status: body.status ?? null,
        password_reset: Boolean(body.newPassword),
      },
    });

    return NextResponse.json({
      data: {
        userId: body.userId,
        message: "Cập nhật thông tin người dùng, phân quyền và mật khẩu thành công.",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
