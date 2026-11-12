import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, resolveAuthContext } from "@/lib/security/auth-session";
import { assertAuthorized } from "@/lib/security/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const exceptionActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("SUBMIT_EXCEPTION"),
    employeeId: z.string().uuid().optional(),
    workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    exceptionType: z.enum([
      "MISSING_IN",
      "MISSING_OUT",
      "DUPLICATE",
      "OUT_OF_GEOFENCE",
      "OUT_OF_SHIFT",
    ]),
    requestedIn: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    requestedOut: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    explanationNote: z.string().min(4).max(400),
  }),
  z.object({
    action: z.literal("REVIEW_EXCEPTION"),
    exceptionId: z.string().uuid(),
    decision: z.enum(["APPROVED", "REJECTED"]),
    adjustedIn: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    adjustedOut: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    reviewNote: z.string().max(300).optional(),
  }),
]);

export async function GET() {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "ATTENDANCE", "READ");

    const admin = getSupabaseAdminClient();
    const isAdminOrMgr = ctx.roles.some((r) =>
      ["HR_ADMIN", "HR_STAFF", "LINE_MANAGER", "DIRECTOR", "ACCOUNTANT", "AUDITOR"].includes(r)
    );

    let exQuery = admin
      .from("attendance_exceptions")
      .select("*, employees(employee_code, full_name)")
      .order("created_at", { ascending: false })
      .limit(100);

    if (!isAdminOrMgr && ctx.employeeId) {
      exQuery = exQuery.eq("employee_id", ctx.employeeId);
    }

    const { data: exceptions, error } = await exQuery;
    if (error) throw error;

    return NextResponse.json({ data: { exceptions: exceptions ?? [] } });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await resolveAuthContext();
    const body = exceptionActionSchema.parse(await req.json());
    const admin = getSupabaseAdminClient();

    const { data: company } = await admin.from("companies").select("id").limit(1).single();
    if (!company) {
      return NextResponse.json(
        { error: { code: "COMPANY_NOT_FOUND", message: "Không tìm thấy pháp nhân công ty." } },
        { status: 400 }
      );
    }

    if (body.action === "SUBMIT_EXCEPTION") {
      assertAuthorized(ctx, "ATTENDANCE", "CREATE");
      const targetEmpId = body.employeeId ?? ctx.employeeId;
      if (!targetEmpId) {
        return NextResponse.json(
          { error: { code: "EMPLOYEE_REQUIRED", message: "Không xác định được nhân viên." } },
          { status: 400 }
        );
      }

      const timeTag =
        body.requestedIn || body.requestedOut
          ? ` [Đề xuất: ${body.requestedIn ?? "--:--"} -> ${body.requestedOut ?? "--:--"}]`
          : "";

      const { data, error } = await admin
        .from("attendance_exceptions")
        .insert({
          company_id: company.id,
          employee_id: targetEmpId,
          work_date: body.workDate,
          exception_type: body.exceptionType,
          explanation_note: `${body.explanationNote.trim()}${timeTag}`,
          status: "PENDING",
        })
        .select("*")
        .single();
      if (error) throw error;
      return NextResponse.json({ data }, { status: 201 });
    }

    // REVIEW_EXCEPTION
    assertAuthorized(ctx, "ATTENDANCE", "APPROVE");

    const { data: ex, error: exErr } = await admin
      .from("attendance_exceptions")
      .select("*")
      .eq("id", body.exceptionId)
      .single();

    if (exErr || !ex) {
      return NextResponse.json(
        { error: { code: "EXCEPTION_NOT_FOUND", message: "Không tìm thấy yêu cầu ngoại lệ." } },
        { status: 404 }
      );
    }

    // Prevent modifying attendance if the covering payroll period has a LOCKED/PAID run
    const { data: lockedPeriods } = await admin
      .from("payroll_periods")
      .select("id, period_code, payroll_runs(status)")
      .lte("start_date", ex.work_date)
      .gte("end_date", ex.work_date);

    const isPeriodLocked = (lockedPeriods ?? []).some((p) =>
      ((p.payroll_runs as Array<{ status: string }> | null) ?? []).some(
        (r) => r.status === "LOCKED" || r.status === "PAID"
      )
    );
    if (isPeriodLocked && body.decision === "APPROVED") {
      return NextResponse.json(
        {
          error: {
            code: "ATTENDANCE_PERIOD_LOCKED",
            message:
              "Kỳ lương chứa ngày công này đã khóa/chi trả, không thể sửa công trực tiếp nếu chưa mở khóa theo quy trình.",
          },
        },
        { status: 409 }
      );
    }

    const updatedNote = body.reviewNote
      ? `${ex.explanation_note ?? ""} | Duyệt: ${body.reviewNote}`
      : ex.explanation_note;

    const { data: updatedEx, error: upExErr } = await admin
      .from("attendance_exceptions")
      .update({
        status: body.decision,
        explanation_note: updatedNote,
        reviewed_by: ctx.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", ex.id)
      .select("*")
      .single();
    if (upExErr) throw upExErr;

    if (body.decision === "APPROVED") {
      const { data: prevSession } = await admin
        .from("attendance_sessions")
        .select("*")
        .eq("employee_id", ex.employee_id)
        .eq("work_date", ex.work_date)
        .maybeSingle();

      const effIn = body.adjustedIn
        ? `${ex.work_date}T${body.adjustedIn}:00+07:00`
        : prevSession?.effective_in ?? `${ex.work_date}T08:00:00+07:00`;
      const effOut = body.adjustedOut
        ? `${ex.work_date}T${body.adjustedOut}:00+07:00`
        : prevSession?.effective_out ?? `${ex.work_date}T17:00:00+07:00`;

      const inMs = new Date(effIn).getTime();
      const outMs = new Date(effOut).getTime();
      const rawHours = outMs > inMs ? (outMs - inMs) / 3600000 : 8;
      const workedHours = Number(Math.max(0, rawHours > 4 ? rawHours - 1 : rawHours).toFixed(2));

      const { data: nextSession } = await admin
        .from("attendance_sessions")
        .upsert(
          {
            company_id: company.id,
            employee_id: ex.employee_id,
            work_date: ex.work_date,
            effective_in: effIn,
            effective_out: effOut,
            worked_hours: workedHours,
            status: "APPROVED",
          },
          { onConflict: "employee_id,work_date" }
        )
        .select("*")
        .single();

      await admin.from("audit_events").insert({
        company_id: company.id,
        actor_user_id: ctx.userId,
        actor_role: ctx.roles[0],
        action: "ATTENDANCE_EXCEPTION_APPROVE",
        target_entity: "attendance_sessions",
        target_id: nextSession?.id ?? ex.id,
        before_data: prevSession ?? null,
        after_data: nextSession ?? null,
      });
    }

    return NextResponse.json({ data: updatedEx });
  } catch (err) {
    return handleApiError(err);
  }
}

