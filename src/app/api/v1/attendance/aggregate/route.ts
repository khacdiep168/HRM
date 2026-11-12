import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, resolveAuthContext } from "@/lib/security/auth-session";
import { assertAuthorized } from "@/lib/security/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const aggregateSchema = z.object({
  payrollPeriodId: z.string().uuid(),
});

export async function POST(req: Request) {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "PAYROLL", "UPDATE");

    const body = aggregateSchema.parse(await req.json());
    const admin = getSupabaseAdminClient();

    const { data: period, error: pErr } = await admin
      .from("payroll_periods")
      .select("id, company_id, period_code, start_date, end_date, standard_work_days")
      .eq("id", body.payrollPeriodId)
      .single();

    if (pErr || !period) {
      return NextResponse.json(
        { error: { code: "PERIOD_NOT_FOUND", message: "Không tìm thấy kỳ lương." } },
        { status: 404 }
      );
    }

    const startTs = `${period.start_date}T00:00:00+07:00`;
    const endTs = `${period.end_date}T23:59:59+07:00`;

    const [{ data: employees }, { data: rawEvents }, { data: leaves }, { data: overtimes }] =
      await Promise.all([
        admin
          .from("employees")
          .select("id, employee_code, full_name")
          .neq("employment_status", "TERMINATED"),
        admin
          .from("attendance_raw_events")
          .select("employee_id, event_time")
          .gte("event_time", startTs)
          .lte("event_time", endTs),
        admin
          .from("leave_requests")
          .select("employee_id, total_days, start_date, end_date, leave_types(is_paid)")
          .eq("status", "APPROVED")
          .lte("start_date", period.end_date)
          .gte("end_date", period.start_date),
        admin
          .from("overtime_requests")
          .select("employee_id, hours, multiplier, work_date")
          .eq("status", "APPROVED")
          .gte("work_date", period.start_date)
          .lte("work_date", period.end_date),
      ]);

    const daysByEmp = new Map<string, Set<string>>();
    for (const ev of rawEvents ?? []) {
      const dateStr = String(ev.event_time).slice(0, 10);
      if (!daysByEmp.has(ev.employee_id)) daysByEmp.set(ev.employee_id, new Set());
      daysByEmp.get(ev.employee_id)!.add(dateStr);
    }

    const paidLeaveByEmp = new Map<string, number>();
    const unpaidLeaveByEmp = new Map<string, number>();
    for (const lv of leaves ?? []) {
      const isPaid =
        (lv.leave_types as { is_paid?: boolean } | null)?.is_paid !== false;
      const days = Number(lv.total_days || 0);
      if (isPaid) {
        paidLeaveByEmp.set(lv.employee_id, (paidLeaveByEmp.get(lv.employee_id) ?? 0) + days);
      } else {
        unpaidLeaveByEmp.set(lv.employee_id, (unpaidLeaveByEmp.get(lv.employee_id) ?? 0) + days);
      }
    }

    const otByEmp = new Map<
      string,
      { weekday: number; weekend: number; holiday: number }
    >();
    for (const ot of overtimes ?? []) {
      const curr = otByEmp.get(ot.employee_id) ?? { weekday: 0, weekend: 0, holiday: 0 };
      const hrs = Number(ot.hours || 0);
      const mult = Number(ot.multiplier || 1.5);
      if (mult >= 3) curr.holiday += hrs;
      else if (mult >= 2) curr.weekend += hrs;
      else curr.weekday += hrs;
      otByEmp.set(ot.employee_id, curr);
    }

    const stdDays = Number(period.standard_work_days || 22);
    const upsertRows = (employees ?? []).map((emp) => {
      const actualWorkDays = daysByEmp.get(emp.id)?.size ?? 0;
      const paidLeaveDays = paidLeaveByEmp.get(emp.id) ?? 0;
      const unpaidLeaveDays = unpaidLeaveByEmp.get(emp.id) ?? 0;
      const ot = otByEmp.get(emp.id) ?? { weekday: 0, weekend: 0, holiday: 0 };
      const paidDays =
        actualWorkDays + paidLeaveDays > 0
          ? Math.min(stdDays, actualWorkDays + paidLeaveDays)
          : stdDays;

      return {
        company_id: period.company_id,
        payroll_period_id: period.id,
        employee_id: emp.id,
        standard_days: stdDays,
        actual_work_days: actualWorkDays,
        paid_leave_days: paidLeaveDays,
        unpaid_leave_days: unpaidLeaveDays,
        paid_days: paidDays,
        ot_hours_weekday: ot.weekday,
        ot_hours_weekend: ot.weekend,
        ot_hours_holiday: ot.holiday,
        is_locked: false,
      };
    });

    if (upsertRows.length > 0) {
      const { error: upErr } = await admin
        .from("attendance_summaries")
        .upsert(upsertRows, { onConflict: "payroll_period_id,employee_id" });
      if (upErr) throw upErr;
    }

    return NextResponse.json({
      data: {
        periodCode: period.period_code,
        aggregatedCount: upsertRows.length,
        rawEventCount: (rawEvents ?? []).length,
        approvedLeaveCount: (leaves ?? []).length,
        approvedOvertimeCount: (overtimes ?? []).length,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

