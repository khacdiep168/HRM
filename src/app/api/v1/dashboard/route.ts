import { NextResponse } from "next/server";
import { handleApiError, resolveAuthContext } from "@/lib/security/auth-session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const auth = await resolveAuthContext();
    if (!auth) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Chưa đăng nhập" } },
        { status: 401 }
      );
    }

    const admin = getSupabaseAdminClient();
    const { data: company } = await admin
      .from("companies")
      .select("id, legal_name, tax_code")
      .limit(1)
      .single();

    if (!company) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Không tìm thấy công ty" } },
        { status: 404 }
      );
    }

    const isExecOrHr = auth.roles.some((r) =>
      ["HR_ADMIN", "HR_STAFF", "ACCOUNTANT", "DIRECTOR", "AUDITOR"].includes(r)
    );
    const isManager = !isExecOrHr && auth.roles.includes("DEPARTMENT_MANAGER");

    // 1. EMPLOYEE SCOPE: Strictly self-only metrics (no company totals, no other employees)
    if (!isExecOrHr && !isManager) {
      const todayIso = new Date().toISOString().slice(0, 10);
      if (!auth.employeeId) {
        return NextResponse.json({
          data: {
            scope: "EMPLOYEE",
            company,
            selfMetrics: {
              todayCheckins: 0,
              monthWorkDays: 0,
              remainingLeaveDays: 0,
              pendingRequests: 0,
              latestNetPay: null,
            },
          },
        });
      }

      const [
        { count: todayCheckins },
        { data: attRows },
        { data: leaveBal },
        { count: myPendingLeave },
        { count: myPendingOt },
        { data: myPayslips },
      ] = await Promise.all([
        admin
          .from("attendance_raw_events")
          .select("id", { count: "exact", head: true })
          .eq("employee_id", auth.employeeId)
          .gte("event_time", `${todayIso}T00:00:00`),
        admin
          .from("attendance_summaries")
          .select("actual_work_days")
          .eq("employee_id", auth.employeeId)
          .order("updated_at", { ascending: false })
          .limit(1),
        admin
          .from("leave_balances")
          .select("remaining_days")
          .eq("employee_id", auth.employeeId),
        admin
          .from("leave_requests")
          .select("id", { count: "exact", head: true })
          .eq("employee_id", auth.employeeId)
          .eq("status", "PENDING"),
        admin
          .from("overtime_requests")
          .select("id", { count: "exact", head: true })
          .eq("employee_id", auth.employeeId)
          .eq("status", "PENDING"),
        admin
          .from("payroll_results")
          .select("net_payable")
          .eq("employee_id", auth.employeeId)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      const remainingLeaveDays = (leaveBal ?? []).reduce(
        (sum, b) => sum + Number(b.remaining_days ?? 0),
        0
      );

      return NextResponse.json({
        data: {
          scope: "EMPLOYEE",
          company,
          selfMetrics: {
            todayCheckins: todayCheckins ?? 0,
            monthWorkDays: Number(attRows?.[0]?.actual_work_days ?? 0),
            remainingLeaveDays,
            pendingRequests: (myPendingLeave ?? 0) + (myPendingOt ?? 0),
            latestNetPay:
              myPayslips?.[0]?.net_payable !== undefined
                ? Number(myPayslips[0].net_payable)
                : null,
          },
        },
      });
    }

    // 2. MANAGER SCOPE: Team/approval metrics only (no company payroll fund or audit logs)
    if (isManager) {
      const todayIso = new Date().toISOString().slice(0, 10);
      const [
        { count: pendingLeave },
        { count: pendingOvertime },
        { count: pendingExceptions },
        { data: todayEvents },
      ] = await Promise.all([
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
          .from("attendance_exceptions")
          .select("id", { count: "exact", head: true })
          .eq("status", "PENDING"),
        admin
          .from("attendance_raw_events")
          .select("employee_id")
          .gte("event_time", `${todayIso}T00:00:00`),
      ]);

      const presentToday = new Set(
        (todayEvents ?? []).map((e) => e.employee_id).filter(Boolean)
      ).size;

      return NextResponse.json({
        data: {
          scope: "MANAGER",
          company,
          managerMetrics: {
            presentToday,
            pendingLeave: pendingLeave ?? 0,
            pendingOvertime: pendingOvertime ?? 0,
            pendingExceptions: pendingExceptions ?? 0,
            totalPendingApprovals:
              (pendingLeave ?? 0) + (pendingOvertime ?? 0) + (pendingExceptions ?? 0),
          },
        },
      });
    }

    // 3. EXEC / HR / ACCOUNTANT / AUDITOR SCOPE: Full 6-KPI operational dashboard
    const todayIso = new Date().toISOString().slice(0, 10);
    const [
      employeesRes,
      leavePendingRes,
      otPendingRes,
      excPendingRes,
      contractsRes,
      payrollRes,
      todayEventsRes,
      todayLateRes,
      lowLeaveRes,
    ] = await Promise.all([
      admin
        .from("employees")
        .select("id, employment_status")
        .eq("company_id", company.id),
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
        .from("attendance_exceptions")
        .select("id", { count: "exact", head: true })
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
        .from("attendance_raw_events")
        .select("employee_id")
        .gte("event_time", `${todayIso}T00:00:00`),
      admin
        .from("attendance_sessions")
        .select("id", { count: "exact", head: true })
        .eq("work_date", todayIso)
        .gt("late_minutes", 0),
      admin
        .from("leave_balances")
        .select("employee_id, remaining_days")
        .lte("remaining_days", 2),
    ]);

    const employees = employeesRes.data ?? [];
    const totalCount = employees.filter((e) => e.employment_status !== "TERMINATED").length;
    const presentToday = new Set(
      (todayEventsRes.data ?? []).map((e) => e.employee_id).filter(Boolean)
    ).size;

    const now = Date.now();
    const in45Days = now + 45 * 24 * 60 * 60 * 1000;
    const expiringContracts = (contractsRes.data ?? []).filter((c) => {
      if (!c.effective_to) return false;
      const t = Date.parse(c.effective_to);
      return t >= now && t <= in45Days;
    });

    const pendingApprovals =
      (leavePendingRes.count ?? 0) +
      (otPendingRes.count ?? 0) +
      (excPendingRes.count ?? 0);

    return NextResponse.json({
      data: {
        scope: "EXEC_HR",
        company,
        metrics: {
          totalEmployees: totalCount,
          presentToday,
          lateToday: todayLateRes.count ?? 0,
          pendingApprovals,
          expiringContractsCount: expiringContracts.length,
          lowLeaveEmployeesCount: (lowLeaveRes.data ?? []).length,
        },
        latestPayrollRun: payrollRes.data?.[0] ?? null,
        expiringContracts: expiringContracts.slice(0, 5),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
