import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getOvertimeMultipliers,
  validateOvertimeCaps,
} from "@/lib/leave/overtime-rules";
import { handleApiError, resolveAuthContext } from "@/lib/security/auth-session";
import { assertAuthorized, assertNotSelfApproval } from "@/lib/security/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const createOtSchema = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  requestedHours: z.number().positive().max(12),
  otDayType: z.enum(["WEEKDAY", "WEEKEND", "HOLIDAY"]),
  isNightShift: z.boolean().default(false),
  employeeConsent: z.boolean(),
  reason: z.string().trim().min(3).max(400),
});

const otDecisionSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["APPROVED", "REJECTED"]),
  reviewNote: z.string().max(300).optional(),
});

export async function GET() {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "OVERTIME", "READ");

    const admin = getSupabaseAdminClient();
    const isManagerOrHr = ctx.roles.some((r) =>
      ["HR_ADMIN", "HR_STAFF", "DEPARTMENT_MANAGER", "DIRECTOR", "AUDITOR"].includes(r)
    );

    let reqQuery = admin
      .from("overtime_requests")
      .select("*, employees(employee_code, full_name)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!isManagerOrHr && ctx.employeeId) {
      reqQuery = reqQuery.eq("employee_id", ctx.employeeId);
    }

    const { data: requests, error } = await reqQuery;
    if (error) throw error;

    let allow300h = false;
    let yearHoursUsed = 0;
    let monthHoursUsed = 0;

    if (ctx.employeeId) {
      const { data: org } = await admin
        .from("org_assignments")
        .select("positions(allow_300h_ot)")
        .eq("employee_id", ctx.employeeId)
        .eq("is_primary", true)
        .limit(1)
        .maybeSingle();
      allow300h = Boolean(
        (org?.positions as { allow_300h_ot?: boolean } | null)?.allow_300h_ot
      );

      const now = new Date();
      const yearPrefix = String(now.getUTCFullYear());
      const monthPrefix = `${yearPrefix}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

      const { data: myOt } = await admin
        .from("overtime_requests")
        .select("work_date, requested_hours")
        .eq("employee_id", ctx.employeeId)
        .in("status", ["PENDING", "APPROVED"])
        .gte("work_date", `${yearPrefix}-01-01`);

      for (const r of myOt ?? []) {
        const hrs = Number(r.requested_hours);
        yearHoursUsed += hrs;
        if (String(r.work_date).startsWith(monthPrefix)) {
          monthHoursUsed += hrs;
        }
      }
    }

    return NextResponse.json({
      data: {
        requests: requests ?? [],
        quota: {
          allow300h,
          annualCap: allow300h ? 300 : 200,
          monthlyCap: 40,
          yearHoursUsed,
          monthHoursUsed,
        },
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "OVERTIME", "CREATE");
    if (!ctx.employeeId) {
      return NextResponse.json(
        { error: { code: "NO_EMPLOYEE_PROFILE", message: "Tài khoản chưa gắn hồ sơ nhân viên." } },
        { status: 400 }
      );
    }

    const body = createOtSchema.parse(await req.json());
    const admin = getSupabaseAdminClient();

    const [{ data: company }, { data: org }] = await Promise.all([
      admin.from("companies").select("id").limit(1).single(),
      admin
        .from("org_assignments")
        .select("positions(allow_300h_ot)")
        .eq("employee_id", ctx.employeeId)
        .eq("is_primary", true)
        .limit(1)
        .maybeSingle(),
    ]);
    if (!company) throw new Error("Không tìm thấy pháp nhân công ty.");

    const allow300hYearCap = Boolean(
      (org?.positions as { allow_300h_ot?: boolean } | null)?.allow_300h_ot
    );

    const yearPrefix = body.workDate.slice(0, 4);
    const monthPrefix = body.workDate.slice(0, 7);

    const { data: existingOt } = await admin
      .from("overtime_requests")
      .select("work_date, requested_hours")
      .eq("employee_id", ctx.employeeId)
      .in("status", ["PENDING", "APPROVED"])
      .gte("work_date", `${yearPrefix}-01-01`)
      .lte("work_date", `${yearPrefix}-12-31`);

    let monthHoursUsed = 0;
    let yearHoursUsed = 0;
    for (const r of existingOt ?? []) {
      const hrs = Number(r.requested_hours);
      yearHoursUsed += hrs;
      if (String(r.work_date).startsWith(monthPrefix)) {
        monthHoursUsed += hrs;
      }
    }

    const validation = validateOvertimeCaps({
      requestedHours: body.requestedHours,
      monthHoursUsed,
      yearHoursUsed,
      allow300hYearCap,
      employeeConsent: body.employeeConsent,
    });

    if (!validation.allowed) {
      return NextResponse.json(
        { error: { code: validation.code ?? "OT_CAP_EXCEEDED", message: validation.message } },
        { status: 422 }
      );
    }

    const { data: created, error: insErr } = await admin
      .from("overtime_requests")
      .insert({
        company_id: company.id,
        employee_id: ctx.employeeId,
        requester_user_id: ctx.userId,
        work_date: body.workDate,
        start_time: `${body.startTime}:00`,
        end_time: `${body.endTime}:00`,
        requested_hours: body.requestedHours,
        ot_day_type: body.otDayType,
        is_night_shift: body.isNightShift,
        employee_consent: true,
        employee_consent_at: new Date().toISOString(),
        reason: body.reason,
        status: "PENDING",
      })
      .select("*")
      .single();
    if (insErr) throw insErr;

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "OVERTIME", "APPROVE");

    const body = otDecisionSchema.parse(await req.json());
    const admin = getSupabaseAdminClient();

    const { data: otReq, error: rErr } = await admin
      .from("overtime_requests")
      .select("*")
      .eq("id", body.requestId)
      .single();
    if (rErr || !otReq) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Không tìm thấy đơn tăng ca." } },
        { status: 404 }
      );
    }

    if (otReq.status !== "PENDING") {
      return NextResponse.json(
        { error: { code: "INVALID_STATE", message: "Đơn tăng ca đã được duyệt trước đó." } },
        { status: 409 }
      );
    }

    if (otReq.requester_user_id) {
      assertNotSelfApproval(ctx.userId, otReq.requester_user_id);
    }

    const { data: updated, error: updErr } = await admin
      .from("overtime_requests")
      .update({
        status: body.decision,
        reviewed_by: ctx.userId,
        reviewed_at: new Date().toISOString(),
        review_note: body.reviewNote ?? null,
      })
      .eq("id", otReq.id)
      .select("*")
      .single();
    if (updErr) throw updErr;

    if (body.decision === "APPROVED") {
      const mult = getOvertimeMultipliers(
        otReq.ot_day_type,
        Boolean(otReq.is_night_shift)
      );
      await admin.from("overtime_records").insert({
        company_id: otReq.company_id,
        overtime_request_id: otReq.id,
        employee_id: otReq.employee_id,
        work_date: otReq.work_date,
        actual_hours: otReq.requested_hours,
        day_hours: otReq.is_night_shift ? 0 : otReq.requested_hours,
        night_hours: otReq.is_night_shift ? otReq.requested_hours : 0,
        multiplier: mult.multiplier,
        tax_exempt_multiplier: mult.taxExemptMultiplier,
        verified_by: ctx.userId,
      });
    }

    await admin.from("audit_events").insert({
      company_id: otReq.company_id,
      actor_user_id: ctx.userId,
      actor_role: ctx.roles[0],
      action: `OVERTIME_${body.decision}`,
      target_entity: "overtime_requests",
      target_id: otReq.id,
      after_data: { status: body.decision },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

