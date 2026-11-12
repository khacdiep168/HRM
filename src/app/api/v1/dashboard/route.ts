import { NextResponse } from "next/server";
import { handleApiError, resolveAuthContext } from "@/lib/security/auth-session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const auth = await resolveAuthContext();
    if (!auth) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Chưa đăng nhập" } }, { status: 401 });
    }

    const admin = getSupabaseAdminClient();
    const { data: company } = await admin
      .from("companies")
      .select("id, legal_name, tax_code")
      .limit(1)
      .single();

    if (!company) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Không tìm thấy công ty" } }, { status: 404 });
    }

    const [
      employeesRes,
      orgRes,
      leavePendingRes,
      otPendingRes,
      contractsRes,
      payrollRes,
      assetsRes,
      coursesRes,
      enrollmentsRes,
      auditRes,
      locationsRes,
    ] = await Promise.all([
      admin
        .from("employees")
        .select("id, employment_status")
        .eq("company_id", company.id),
      admin
        .from("org_assignments")
        .select("employee_id, departments(id, code, name)")
        .eq("company_id", company.id)
        .eq("is_primary", true),
      admin
        .from("leave_requests")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id)
        .eq("status", "PENDING"),
      admin
        .from("overtime_requests")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id)
        .eq("status", "PENDING"),
      admin
        .from("contracts")
        .select("id, contract_no, effective_to, status, employees(employee_code, full_name)")
        .eq("company_id", company.id)
        .eq("status", "ACTIVE"),
      admin
        .from("payroll_runs")
        .select("id, run_type, status, total_employees, total_net_payable, payroll_periods(period_code)")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false })
        .limit(1),
      admin
        .from("assets")
        .select("id, status")
        .eq("company_id", company.id),
      admin
        .from("courses")
        .select("id")
        .eq("company_id", company.id)
        .eq("is_mandatory", true),
      admin
        .from("training_enrollments")
        .select("id, status")
        .eq("company_id", company.id),
      admin
        .from("audit_events")
        .select("id, actor_role, action, target_entity, created_at")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false })
        .limit(6),
      admin
        .from("locations")
        .select("id, code, name, address, geofence_radius_m")
        .eq("company_id", company.id)
        .order("code", { ascending: true }),
    ]);

    const employees = employeesRes.data ?? [];
    const activeCount = employees.filter((e) => e.employment_status === "ACTIVE").length;
    const probationCount = employees.filter((e) => e.employment_status === "PROBATION").length;
    const totalCount = employees.filter((e) => e.employment_status !== "TERMINATED").length;

    // Department headcount aggregation
    const deptMap = new Map<string, { name: string; count: number }>();
    for (const row of orgRes.data ?? []) {
      const dept = row.departments as unknown as { id: string; code: string; name: string } | null;
      if (dept) {
        const cur = deptMap.get(dept.id) ?? { name: dept.name, count: 0 };
        cur.count += 1;
        deptMap.set(dept.id, cur);
      }
    }
    const departmentBreakdown = Array.from(deptMap.values()).sort((a, b) => b.count - a.count);

    // Expiring contracts within 45 days
    const now = Date.now();
    const in45Days = now + 45 * 24 * 60 * 60 * 1000;
    const expiringContracts = (contractsRes.data ?? []).filter((c) => {
      if (!c.effective_to) return false;
      const t = Date.parse(c.effective_to);
      return t >= now && t <= in45Days;
    });

    const assets = assetsRes.data ?? [];
    const assignedAssets = assets.filter((a) => a.status === "ASSIGNED").length;

    const enrollments = enrollmentsRes.data ?? [];
    const completedEnrollments = enrollments.filter((e) => e.status === "COMPLETED").length;

    return NextResponse.json({
      data: {
        company,
        metrics: {
          totalEmployees: totalCount,
          activeEmployees: activeCount,
          probationEmployees: probationCount,
          pendingLeave: leavePendingRes.count ?? 0,
          pendingOvertime: otPendingRes.count ?? 0,
          expiringContractsCount: expiringContracts.length,
          totalAssets: assets.length,
          assignedAssets,
          mandatoryCourses: (coursesRes.data ?? []).length,
          completedEnrollments,
          totalEnrollments: enrollments.length,
        },
        latestPayrollRun: payrollRes.data?.[0] ?? null,
        expiringContracts: expiringContracts.slice(0, 5),
        departmentBreakdown,
        recentAudit: auditRes.data ?? [],
        locations: locationsRes.data ?? [],
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
