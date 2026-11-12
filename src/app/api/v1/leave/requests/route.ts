import { NextResponse } from "next/server";
import { z } from "zod";
import { calcAvailableLeaveDays } from "@/lib/leave/overtime-rules";
import { handleApiError, resolveAuthContext } from "@/lib/security/auth-session";
import { assertAuthorized, assertNotSelfApproval } from "@/lib/security/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const createLeaveSchema = z.object({
  leaveTypeId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalDays: z.number().positive().max(180),
  reason: z.string().trim().min(3).max(400),
});

const decisionSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["APPROVED", "REJECTED"]),
  reviewNote: z.string().max(300).optional(),
});

export async function GET() {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "LEAVE", "READ");

    const admin = getSupabaseAdminClient();
    const isManagerOrHr = ctx.roles.some((r) =>
      ["HR_ADMIN", "HR_STAFF", "DEPARTMENT_MANAGER", "DIRECTOR", "AUDITOR"].includes(r)
    );
    const currentYear = new Date().getUTCFullYear();
    const currentMonth = new Date().getUTCMonth() + 1;

    const { data: leaveTypes } = await admin
      .from("leave_types")
      .select("*")
      .eq("is_active", true)
      .order("code");

    const annualType = (leaveTypes ?? []).find((t) => t.code === "ANNUAL");

    // Ensure authenticated employee has an initialized current-year annual leave balance
    if (ctx.employeeId && annualType) {
      const { data: company } = await admin.from("companies").select("id").limit(1).single();
      if (company) {
        await admin.from("leave_balances").upsert(
          {
            company_id: company.id,
            employee_id: ctx.employeeId,
            leave_type_id: annualType.id,
            year: currentYear,
            entitled_days: 12,
          },
          { onConflict: "employee_id,leave_type_id,year", ignoreDuplicates: true }
        );
      }
    }

    let balQuery = admin
      .from("leave_balances")
      .select("*, leave_types(code, name), employees(employee_code, full_name)")
      .eq("year", currentYear);
    let reqQuery = admin
      .from("leave_requests")
      .select("*, leave_types(code, name, deducts_annual_quota), employees(employee_code, full_name)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!isManagerOrHr && ctx.employeeId) {
      balQuery = balQuery.eq("employee_id", ctx.employeeId);
      reqQuery = reqQuery.eq("employee_id", ctx.employeeId);
    }

    const [{ data: balances }, { data: requests, error: reqErr }] = await Promise.all([
      balQuery,
      reqQuery,
    ]);
    if (reqErr) throw reqErr;

    const computedBalances = (balances ?? []).map((b) => {
      const calc = calcAvailableLeaveDays({
        entitledDays: Number(b.entitled_days),
        carriedOver: Number(b.carried_over),
        adjustedDays: Number(b.adjusted_days),
        usedDays: Number(b.used_days),
        pendingDays: Number(b.pending_days),
        asOfMonth: currentMonth,
      });
      return {
        ...b,
        effective_carryover: calc.effectiveCarryover,
        available_days: calc.availableDays,
      };
    });

    return NextResponse.json({
      data: {
        leaveTypes: leaveTypes ?? [],
        balances: computedBalances,
        requests: requests ?? [],
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "LEAVE", "CREATE");
    if (!ctx.employeeId) {
      return NextResponse.json(
        { error: { code: "NO_EMPLOYEE_PROFILE", message: "Tài khoản chưa gắn hồ sơ nhân viên." } },
        { status: 400 }
      );
    }

    const body = createLeaveSchema.parse(await req.json());
    if (body.endDate < body.startDate) {
      return NextResponse.json(
        { error: { code: "INVALID_DATE_RANGE", message: "Ngày kết thúc phải >= ngày bắt đầu." } },
        { status: 422 }
      );
    }

    const admin = getSupabaseAdminClient();
    const { data: leaveType, error: ltErr } = await admin
      .from("leave_types")
      .select("id, company_id, code, deducts_annual_quota")
      .eq("id", body.leaveTypeId)
      .single();
    if (ltErr || !leaveType) {
      return NextResponse.json(
        { error: { code: "LEAVE_TYPE_NOT_FOUND", message: "Không tìm thấy loại nghỉ phép." } },
        { status: 404 }
      );
    }

    const reqYear = Number(body.startDate.slice(0, 4));
    const reqMonth = Number(body.startDate.slice(5, 7));

    if (leaveType.deducts_annual_quota) {
      const { data: bal } = await admin
        .from("leave_balances")
        .select("*")
        .eq("employee_id", ctx.employeeId)
        .eq("leave_type_id", leaveType.id)
        .eq("year", reqYear)
        .maybeSingle();

      const calc = bal
        ? calcAvailableLeaveDays({
            entitledDays: Number(bal.entitled_days),
            carriedOver: Number(bal.carried_over),
            adjustedDays: Number(bal.adjusted_days),
            usedDays: Number(bal.used_days),
            pendingDays: Number(bal.pending_days),
            asOfMonth: reqMonth,
          })
        : { availableDays: 12 };

      if (body.totalDays > calc.availableDays) {
        return NextResponse.json(
          {
            error: {
              code: "INSUFFICIENT_LEAVE_BALANCE",
              message: `Số dư phép năm còn ${calc.availableDays} ngày, không đủ để xin ${body.totalDays} ngày.`,
            },
          },
          { status: 422 }
        );
      }

      if (bal) {
        await admin
          .from("leave_balances")
          .update({ pending_days: Number(bal.pending_days) + body.totalDays })
          .eq("id", bal.id);
      }
    }

    const { data: created, error: insErr } = await admin
      .from("leave_requests")
      .insert({
        company_id: leaveType.company_id,
        employee_id: ctx.employeeId,
        requester_user_id: ctx.userId,
        leave_type_id: body.leaveTypeId,
        start_date: body.startDate,
        end_date: body.endDate,
        total_days: body.totalDays,
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
    assertAuthorized(ctx, "LEAVE", "APPROVE");

    const body = decisionSchema.parse(await req.json());
    const admin = getSupabaseAdminClient();

    const { data: leaveReq, error: rErr } = await admin
      .from("leave_requests")
      .select("*, leave_types(deducts_annual_quota)")
      .eq("id", body.requestId)
      .single();
    if (rErr || !leaveReq) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Không tìm thấy đơn nghỉ phép." } },
        { status: 404 }
      );
    }

    if (leaveReq.status !== "PENDING") {
      return NextResponse.json(
        { error: { code: "INVALID_STATE", message: "Đơn nghỉ phép đã được xử lý trước đó." } },
        { status: 409 }
      );
    }

    if (leaveReq.requester_user_id) {
      assertNotSelfApproval(ctx.userId, leaveReq.requester_user_id);
    }

    const { data: updated, error: updErr } = await admin
      .from("leave_requests")
      .update({
        status: body.decision,
        reviewed_by: ctx.userId,
        reviewed_at: new Date().toISOString(),
        review_note: body.reviewNote ?? null,
      })
      .eq("id", leaveReq.id)
      .select("*")
      .single();
    if (updErr) throw updErr;

    const deducts = (leaveReq.leave_types as { deducts_annual_quota?: boolean } | null)
      ?.deducts_annual_quota;
    if (deducts) {
      const reqYear = Number(String(leaveReq.start_date).slice(0, 4));
      const { data: bal } = await admin
        .from("leave_balances")
        .select("*")
        .eq("employee_id", leaveReq.employee_id)
        .eq("leave_type_id", leaveReq.leave_type_id)
        .eq("year", reqYear)
        .maybeSingle();

      if (bal) {
        const totalDays = Number(leaveReq.total_days);
        const nextPending = Math.max(0, Number(bal.pending_days) - totalDays);
        const nextUsed =
          body.decision === "APPROVED"
            ? Number(bal.used_days) + totalDays
            : Number(bal.used_days);
        await admin
          .from("leave_balances")
          .update({ pending_days: nextPending, used_days: nextUsed })
          .eq("id", bal.id);
      }
    }

    await admin.from("audit_events").insert({
      company_id: leaveReq.company_id,
      actor_user_id: ctx.userId,
      actor_role: ctx.roles[0],
      action: `LEAVE_${body.decision}`,
      target_entity: "leave_requests",
      target_id: leaveReq.id,
      after_data: { status: body.decision },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

