import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, resolveAuthContext } from "@/lib/security/auth-session";
import { assertAuthorized } from "@/lib/security/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const batchApprovalSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().max(300).optional(),
  items: z
    .array(
      z.object({
        type: z.enum(["LEAVE", "OT", "EXCEPTION"]),
        id: z.string().uuid(),
      })
    )
    .min(1)
    .max(100),
});

export async function GET() {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "LEAVE", "APPROVE");

    const admin = getSupabaseAdminClient();
    const [{ data: leaves }, { data: ots }, { data: exceptions }] = await Promise.all([
      admin
        .from("leave_requests")
        .select(
          "id, employee_id, start_date, end_date, total_days, reason, status, created_at, employees(employee_code, full_name), leave_types(name)"
        )
        .eq("status", "PENDING")
        .order("created_at", { ascending: false }),
      admin
        .from("overtime_requests")
        .select(
          "id, employee_id, work_date, requested_hours, ot_day_type, reason, status, created_at, employees(employee_code, full_name)"
        )
        .eq("status", "PENDING")
        .order("created_at", { ascending: false }),
      admin
        .from("attendance_exceptions")
        .select(
          "id, employee_id, work_date, exception_type, explanation_note, status, created_at, employees(employee_code, full_name)"
        )
        .eq("status", "PENDING")
        .order("created_at", { ascending: false }),
    ]);

    return NextResponse.json({
      data: {
        leaves: leaves ?? [],
        overtimes: ots ?? [],
        exceptions: exceptions ?? [],
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "LEAVE", "APPROVE");

    const body = batchApprovalSchema.parse(await req.json());
    const admin = getSupabaseAdminClient();
    const nowIso = new Date().toISOString();

    const leaveIds = body.items.filter((i) => i.type === "LEAVE").map((i) => i.id);
    const otIds = body.items.filter((i) => i.type === "OT").map((i) => i.id);
    const excIds = body.items.filter((i) => i.type === "EXCEPTION").map((i) => i.id);

    const nextStatus = body.action === "APPROVE" ? "APPROVED" : "REJECTED";

    await Promise.all([
      leaveIds.length > 0
        ? admin
            .from("leave_requests")
            .update({
              status: nextStatus,
              reviewed_by: ctx.userId,
              reviewed_at: nowIso,
              ...(body.reason ? { review_note: body.reason } : {}),
            })
            .in("id", leaveIds)
            .eq("status", "PENDING")
        : Promise.resolve(),
      otIds.length > 0
        ? admin
            .from("overtime_requests")
            .update({
              status: nextStatus,
              reviewed_by: ctx.userId,
              reviewed_at: nowIso,
              ...(body.reason ? { review_note: body.reason } : {}),
            })
            .in("id", otIds)
            .eq("status", "PENDING")
        : Promise.resolve(),
      excIds.length > 0
        ? admin
            .from("attendance_exceptions")
            .update({
              status: nextStatus,
              reviewed_by: ctx.userId,
              reviewed_at: nowIso,
            })
            .in("id", excIds)
            .eq("status", "PENDING")
        : Promise.resolve(),
    ]);

    return NextResponse.json({
      data: {
        processedCount: body.items.length,
        action: body.action,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

