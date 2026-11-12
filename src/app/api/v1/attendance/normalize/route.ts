import { NextResponse } from "next/server";
import { z } from "zod";
import {
  extractDistinctVnWorkDates,
  normalizeAttendanceForEmployeeDay,
  type RawAttendanceEventInput,
  type ShiftTemplateConfig,
} from "@/lib/attendance/session-normalizer";
import { handleApiError, resolveAuthContext } from "@/lib/security/auth-session";
import { assertAuthorized } from "@/lib/security/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const normalizeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET() {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "ATTENDANCE", "READ");

    const admin = getSupabaseAdminClient();
    const isAdminOrHr = ctx.roles.some((r) =>
      ["HR_ADMIN", "HR_STAFF", "LINE_MANAGER", "DIRECTOR", "ACCOUNTANT", "AUDITOR"].includes(r)
    );

    let sessQuery = admin
      .from("attendance_sessions")
      .select("*, employees(employee_code, full_name)")
      .order("work_date", { ascending: false })
      .limit(100);

    if (!isAdminOrHr && ctx.employeeId) {
      sessQuery = sessQuery.eq("employee_id", ctx.employeeId);
    }

    const { data: sessions, error } = await sessQuery;
    if (error) throw error;

    return NextResponse.json({ data: { sessions: sessions ?? [] } });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "ATTENDANCE", "UPDATE");

    const body = normalizeSchema.parse(await req.json());
    const admin = getSupabaseAdminClient();

    const { data: company } = await admin.from("companies").select("id").limit(1).single();
    if (!company) {
      return NextResponse.json(
        { error: { code: "COMPANY_NOT_FOUND", message: "Không tìm thấy pháp nhân công ty." } },
        { status: 400 }
      );
    }

    // Add 1 day buffer after endDate to capture overnight check-outs
    const endBuffer = new Date(`${body.endDate}T23:59:59+07:00`);
    endBuffer.setUTCDate(endBuffer.getUTCDate() + 1);

    const [{ data: rawEvents }, { data: shiftAssigns }, { data: existingExceptions }] =
      await Promise.all([
        admin
          .from("attendance_raw_events")
          .select("id, employee_id, event_time, direction")
          .gte("event_time", `${body.startDate}T00:00:00+07:00`)
          .lte("event_time", endBuffer.toISOString())
          .order("event_time", { ascending: true }),
        admin
          .from("shift_assignments")
          .select(
            "id, employee_id, work_date, shift_templates(id, code, start_time, end_time, is_overnight, break_minutes, standard_work_hours)"
          )
          .gte("work_date", body.startDate)
          .lte("work_date", body.endDate),
        admin
          .from("attendance_exceptions")
          .select("employee_id, work_date, exception_type")
          .gte("work_date", body.startDate)
          .lte("work_date", body.endDate),
      ]);

    const eventsByEmp = new Map<string, RawAttendanceEventInput[]>();
    for (const ev of rawEvents ?? []) {
      if (!eventsByEmp.has(ev.employee_id)) eventsByEmp.set(ev.employee_id, []);
      eventsByEmp.get(ev.employee_id)!.push({
        id: ev.id,
        employeeId: ev.employee_id,
        eventTime: ev.event_time,
        direction: (ev.direction as "IN" | "OUT" | "UNKNOWN") ?? "UNKNOWN",
      });
    }

    const assignMap = new Map<
      string,
      { id: string; shift: ShiftTemplateConfig }
    >();
    for (const sa of shiftAssigns ?? []) {
      const rawTpl = Array.isArray(sa.shift_templates)
        ? sa.shift_templates[0]
        : sa.shift_templates;
      const tpl = rawTpl as {
        id: string;
        code: string;
        start_time: string;
        end_time: string;
        is_overnight: boolean;
        break_minutes: number;
        standard_work_hours: number;
      } | null;
      if (!tpl) continue;
      assignMap.set(`${sa.employee_id}:${sa.work_date}`, {
        id: sa.id,
        shift: {
          id: tpl.id,
          code: tpl.code,
          startTime: tpl.start_time,
          endTime: tpl.end_time,
          isOvernight: Boolean(tpl.is_overnight),
          breakMinutes: Number(tpl.break_minutes ?? 60),
          standardWorkHours: Number(tpl.standard_work_hours ?? 8),
        },
      });
    }

    const exKeySet = new Set(
      (existingExceptions ?? []).map(
        (ex) => `${ex.employee_id}:${ex.work_date}:${ex.exception_type}`
      )
    );

    const sessionUpserts: Array<Record<string, unknown>> = [];
    const newExceptions: Array<Record<string, unknown>> = [];
    let validCount = 0;
    let exceptionCount = 0;

    for (const [empId, empEvents] of eventsByEmp.entries()) {
      const candidateDates = new Set(
        extractDistinctVnWorkDates(empEvents).filter(
          (d) => d >= body.startDate && d <= body.endDate
        )
      );
      for (const workDate of candidateDates) {
        const assign = assignMap.get(`${empId}:${workDate}`);
        const norm = normalizeAttendanceForEmployeeDay({
          employeeId: empId,
          workDate,
          allEmployeeEvents: empEvents,
          shift: assign?.shift,
          duplicateWindowMinutes: 5,
          graceMinutes: 5,
        });
        if (!norm) continue;

        sessionUpserts.push({
          company_id: company.id,
          employee_id: empId,
          work_date: workDate,
          shift_assignment_id: assign?.id ?? null,
          check_in_event_id: norm.checkInEventId,
          check_out_event_id: norm.checkOutEventId,
          effective_in: norm.effectiveIn,
          effective_out: norm.effectiveOut,
          worked_hours: norm.workedHours,
          late_minutes: norm.lateMinutes,
          early_minutes: norm.earlyMinutes,
          night_hours: norm.nightHours,
          status: norm.status,
        });

        if (norm.status === "VALID") {
          validCount += 1;
        } else if (norm.exceptionType) {
          exceptionCount += 1;
          const k = `${empId}:${workDate}:${norm.exceptionType}`;
          if (!exKeySet.has(k)) {
            exKeySet.add(k);
            newExceptions.push({
              company_id: company.id,
              employee_id: empId,
              work_date: workDate,
              raw_event_id: norm.checkInEventId ?? norm.checkOutEventId,
              exception_type: norm.exceptionType,
              explanation_note:
                norm.exceptionType === "MISSING_IN"
                  ? "Thiếu lượt Check-in khi chuẩn hóa ca"
                  : "Thiếu lượt Check-out khi chuẩn hóa ca",
              status: "PENDING",
            });
          }
        }
      }
    }

    if (sessionUpserts.length > 0) {
      const { error: upErr } = await admin
        .from("attendance_sessions")
        .upsert(sessionUpserts, { onConflict: "employee_id,work_date" });
      if (upErr) throw upErr;
    }

    if (newExceptions.length > 0) {
      const { error: exErr } = await admin.from("attendance_exceptions").insert(newExceptions);
      if (exErr) throw exErr;
    }

    return NextResponse.json({
      data: {
        processedSessions: sessionUpserts.length,
        validCount,
        exceptionCount,
        newExceptionsCreated: newExceptions.length,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
