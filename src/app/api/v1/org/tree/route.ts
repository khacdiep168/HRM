import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, resolveAuthContext } from "@/lib/security/auth-session";
import { assertAuthorized } from "@/lib/security/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "ORGANIZATION", "READ");

    const admin = getSupabaseAdminClient();
    const [
      companiesRes,
      locationsRes,
      departmentsRes,
      costCentersRes,
      positionsRes,
      employeesRes,
      assignmentsRes,
    ] = await Promise.all([
      admin
        .from("companies")
        .select(
          "id, code, legal_name, english_name, tax_code, address, payroll_cutoff_day, payroll_advance_day"
        )
        .order("code"),
      admin
        .from("locations")
        .select("id, code, name, address, min_wage_region_code, latitude, longitude, geofence_radius_m, gps_required")
        .eq("is_active", true)
        .order("code"),
      admin
        .from("departments")
        .select("id, parent_id, code, name, cost_center_id, default_location_id, manager_employee_id, status")
        .order("code"),
      admin
        .from("cost_centers")
        .select("id, code, name, accounting_ref")
        .eq("is_active", true)
        .order("code"),
      admin
        .from("positions")
        .select("id, department_id, code, title, headcount_limit, allow_300h_ot")
        .eq("is_active", true)
        .order("code"),
      admin
        .from("employees")
        .select("id, employee_code, full_name, employment_status, hire_date, gender")
        .order("employee_code"),
      admin
        .from("org_assignments")
        .select("id, employee_id, department_id, position_id, is_primary")
        .eq("is_primary", true),
    ]);

    if (companiesRes.error) throw companiesRes.error;

    const employees = employeesRes.data ?? [];
    const empMap = new Map(employees.map((e) => [e.id, e]));
    const positions = positionsRes.data ?? [];
    const posMap = new Map(positions.map((p) => [p.id, p]));
    const assignments = assignmentsRes.data ?? [];

    // Map employees to departments
    const deptEmpMap = new Map<string, Array<{
      id: string;
      code: string;
      name: string;
      gender: string;
      status: string;
      hireDate: string;
      positionTitle: string;
      isManager: boolean;
      badge?: "Mới" | "Thử việc" | "Nghỉ thai sản" | "Đang làm";
    }>>();

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    for (const a of assignments) {
      if (!a.department_id) continue;
      const emp = empMap.get(a.employee_id);
      if (!emp) continue;
      const pos = a.position_id ? posMap.get(a.position_id) : null;

      let badge: "Mới" | "Thử việc" | "Nghỉ thai sản" | "Đang làm" = "Đang làm";
      if (emp.employment_status === "PROBATION") {
        badge = "Thử việc";
      } else if (emp.employment_status === "ON_LEAVE") {
        badge = "Nghỉ thai sản";
      } else if (emp.hire_date && new Date(emp.hire_date) >= thirtyDaysAgo) {
        badge = "Mới";
      }

      const list = deptEmpMap.get(a.department_id) ?? [];
      list.push({
        id: emp.id,
        code: emp.employee_code,
        name: emp.full_name,
        gender: emp.gender ?? "MALE",
        status: emp.employment_status,
        hireDate: emp.hire_date,
        positionTitle: pos?.title ?? "Nhân viên",
        isManager: false,
        badge,
      });
      deptEmpMap.set(a.department_id, list);
    }

    // Enrich departments with manager, headcounts, target
    const departments = (departmentsRes.data ?? []).map((d) => {
      const deptEmployees = deptEmpMap.get(d.id) ?? [];
      const manager = d.manager_employee_id ? empMap.get(d.manager_employee_id) : null;
      const deptPositions = positions.filter((p) => p.department_id === d.id);
      
      let targetHeadcount = deptPositions.reduce(
        (sum, p) => sum + (p.headcount_limit ?? 3),
        deptPositions.length > 0 ? 0 : 5
      );

      if (d.code === "DEPT-BOD") targetHeadcount = 1;
      else if (d.code === "DEPT-KT") targetHeadcount = 3;
      else if (d.code === "DEPT-HCNS") targetHeadcount = 3;
      else if (d.code === "DEPT-KD") targetHeadcount = 3;
      else if (d.code === "UNIT-KHO") targetHeadcount = 4;

      const activeEmployees = deptEmployees.filter((e) => e.status !== "TERMINATED");
      const onDutyEmployees = activeEmployees.filter((e) => e.status !== "ON_LEAVE");

      let managerTitle = "Quản lý / Trưởng bộ phận";
      if (d.code === "DEPT-BOD") managerTitle = "Giám đốc";
      else if (d.code === "DEPT-KT") managerTitle = "Kế toán trưởng (kiêm tài chính)";
      else if (d.code === "DEPT-HCNS") managerTitle = "Trưởng phòng HC-NS";
      else if (d.code === "DEPT-KD") managerTitle = "Trưởng phòng Kinh doanh";
      else if (d.code === "UNIT-KHO") managerTitle = "Quản lý Kho vận & Bãi xe";
      else if (manager) {
        const mAssign = assignments.find((a) => a.employee_id === manager.id);
        const mPos = mAssign?.position_id ? posMap.get(mAssign.position_id) : null;
        if (mPos?.title) managerTitle = mPos.title;
      }

      return {
        ...d,
        manager: manager
          ? {
              id: manager.id,
              code: manager.employee_code,
              name: manager.full_name,
              gender: manager.gender,
              title: managerTitle,
            }
          : null,
        employees: deptEmployees,
        activeHeadcount: activeEmployees.length,
        onDutyHeadcount: onDutyEmployees.length,
        targetHeadcount,
        isManagerMissing: !manager,
      };
    });

    return NextResponse.json({
      data: {
        companies: companiesRes.data ?? [],
        company: companiesRes.data?.[0] ?? null,
        locations: locationsRes.data ?? [],
        departments,
        costCenters: costCentersRes.data ?? [],
        positions,
        employees: employees.map((e) => ({
          id: e.id,
          code: e.employee_code,
          name: e.full_name,
          gender: e.gender,
          status: e.employment_status,
        })),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

const deptCreateSchema = z.object({
  companyId: z.string().uuid(),
  code: z.string().min(2).max(32),
  name: z.string().min(2).max(255),
  parentId: z.string().uuid().nullable().optional(),
  managerEmployeeId: z.string().uuid().nullable().optional(),
  costCenterId: z.string().uuid().nullable().optional(),
  defaultLocationId: z.string().uuid().nullable().optional(),
  targetHeadcount: z.number().int().min(1).max(500).optional(),
});

export async function POST(req: Request) {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "ORGANIZATION", "CREATE");

    const body = deptCreateSchema.parse(await req.json());
    const admin = getSupabaseAdminClient();

    const { data: created, error } = await admin
      .from("departments")
      .insert({
        company_id: body.companyId,
        code: body.code.toUpperCase().trim(),
        name: body.name.trim(),
        parent_id: body.parentId ?? null,
        manager_employee_id: body.managerEmployeeId ?? null,
        cost_center_id: body.costCenterId ?? null,
        default_location_id: body.defaultLocationId ?? null,
        status: "ACTIVE",
      })
      .select("id, code, name")
      .single();

    if (error) throw error;

    if (body.targetHeadcount && created) {
      await admin.from("positions").insert({
        company_id: body.companyId,
        department_id: created.id,
        code: `${created.code}-STAFF`,
        title: `Nhân viên ${created.name}`,
        headcount_limit: body.targetHeadcount,
      });
    }

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

const deptPatchSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(255).optional(),
  parentId: z.string().uuid().nullable().optional(),
  managerEmployeeId: z.string().uuid().nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export async function PATCH(req: Request) {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "ORGANIZATION", "UPDATE");

    const body = deptPatchSchema.parse(await req.json());
    const admin = getSupabaseAdminClient();

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.parentId !== undefined) updateData.parent_id = body.parentId;
    if (body.managerEmployeeId !== undefined) updateData.manager_employee_id = body.managerEmployeeId;
    if (body.status !== undefined) updateData.status = body.status;

    const { data: updated, error } = await admin
      .from("departments")
      .update(updateData)
      .eq("id", body.id)
      .select("id, code, name, parent_id, manager_employee_id, status")
      .single();

    if (error) throw error;

    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
