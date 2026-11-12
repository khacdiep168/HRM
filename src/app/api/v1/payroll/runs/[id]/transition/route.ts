import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, resolveAuthContext } from "@/lib/security/auth-session";
import { assertAuthorized, assertNotSelfApproval } from "@/lib/security/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const transitionSchema = z.object({
  action: z.enum([
    "SUBMIT_ACCOUNTANT",
    "ACCOUNTANT_REVIEW",
    "DIRECTOR_APPROVE",
    "LOCK",
    "MARK_PAID",
  ]),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await resolveAuthContext();
    if (!ctx) {
      assertAuthorized(null, "PAYROLL", "READ");
    }

    const { id } = await context.params;
    const { action } = transitionSchema.parse(await req.json());
    const admin = getSupabaseAdminClient();

    const { data: run, error: runErr } = await admin
      .from("payroll_runs")
      .select("*, payroll_periods(period_code)")
      .eq("id", id)
      .single();

    if (runErr || !run) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Không tìm thấy bảng lương." } },
        { status: 404 }
      );
    }

    if (run.status === "PAID") {
      return NextResponse.json(
        { error: { code: "PAYROLL_PERIOD_LOCKED", message: "Bảng lương đã chi trả, không thể chuyển trạng thái." } },
        { status: 409 }
      );
    }

    const nowIso = new Date().toISOString();
    const updatePatch: Record<string, unknown> = {};

    if (action === "SUBMIT_ACCOUNTANT") {
      assertAuthorized(ctx, "PAYROLL", "UPDATE");
      if (run.status !== "CALCULATED") {
        return NextResponse.json(
          { error: { code: "INVALID_STATE", message: "Chỉ trình Kế toán trưởng khi bảng lương ở trạng thái CALCULATED." } },
          { status: 409 }
        );
      }
      updatePatch.status = "PENDING_ACCOUNTANT_REVIEW";
    } else if (action === "ACCOUNTANT_REVIEW") {
      assertAuthorized(ctx, "PAYROLL", "APPROVE");
      if (!ctx!.roles.includes("ACCOUNTANT")) {
        return NextResponse.json(
          { error: { code: "ACCOUNTANT_ROLE_REQUIRED", message: "Bước này bắt buộc vai trò Kế toán trưởng (ACCOUNTANT)." } },
          { status: 403 }
        );
      }
      if (run.status !== "PENDING_ACCOUNTANT_REVIEW") {
        return NextResponse.json(
          { error: { code: "INVALID_STATE", message: "Bảng lương chưa ở trạng thái chờ Kế toán trưởng kiểm tra." } },
          { status: 409 }
        );
      }
      if (run.created_by) {
        assertNotSelfApproval(ctx!.userId, run.created_by);
      }
      updatePatch.status = "PENDING_DIRECTOR_APPROVAL";
      updatePatch.accountant_reviewed_by = ctx!.userId;
      updatePatch.accountant_reviewed_at = nowIso;
    } else if (action === "DIRECTOR_APPROVE") {
      assertAuthorized(ctx, "PAYROLL", "APPROVE");
      if (!ctx!.roles.includes("DIRECTOR")) {
        return NextResponse.json(
          { error: { code: "DIRECTOR_ROLE_REQUIRED", message: "Bước phê duyệt chi cuối cùng bắt buộc vai trò Giám đốc (DIRECTOR)." } },
          { status: 403 }
        );
      }
      if (run.status !== "PENDING_DIRECTOR_APPROVAL" || !run.accountant_reviewed_by) {
        return NextResponse.json(
          { error: { code: "ACCOUNTANT_REVIEW_REQUIRED", message: "Giám đốc chỉ được duyệt sau khi Kế toán trưởng đã ký kiểm tra." } },
          { status: 409 }
        );
      }
      assertNotSelfApproval(ctx!.userId, run.accountant_reviewed_by);
      updatePatch.status = "APPROVED";
      updatePatch.director_approved_by = ctx!.userId;
      updatePatch.director_approved_at = nowIso;
    } else if (action === "LOCK") {
      assertAuthorized(ctx, "PAYROLL", "LOCK");
      if (run.status !== "APPROVED") {
        return NextResponse.json(
          { error: { code: "INVALID_STATE", message: "Chỉ được khóa kỳ lương sau khi Giám đốc đã APPROVED." } },
          { status: 409 }
        );
      }
      updatePatch.status = "LOCKED";
      updatePatch.locked_by = ctx!.userId;
      updatePatch.locked_at = nowIso;
    } else if (action === "MARK_PAID") {
      assertAuthorized(ctx, "PAYROLL", "UPDATE");
      if (run.status !== "LOCKED") {
        return NextResponse.json(
          { error: { code: "INVALID_STATE", message: "Phải khóa kỳ lương (LOCKED) trước khi xác nhận đã chuyển khoản ngân hàng." } },
          { status: 409 }
        );
      }
      updatePatch.status = "PAID";
      updatePatch.paid_at = nowIso;

      // Publish immutable payslips for this run
      const { data: resRows } = await admin
        .from("payroll_results")
        .select("*")
        .eq("payroll_run_id", run.id);
      const periodCode = (run.payroll_periods as { period_code?: string } | null)?.period_code ?? "PERIOD";
      const payslipInserts = (resRows ?? []).map((r, idx) => ({
        payroll_result_id: r.id,
        employee_id: r.employee_id,
        payroll_period_id: run.payroll_period_id,
        payslip_no: `PS-${periodCode}-${run.run_type === "MID_MONTH_ADVANCE" ? "D1" : "D2"}-V${run.run_version}-${idx + 1}`,
        payload_snapshot: r,
      }));
      if (payslipInserts.length > 0) {
        await admin.from("payslips").upsert(payslipInserts, {
          onConflict: "payslip_no",
          ignoreDuplicates: true,
        });
      }
    }

    const { data: updated, error: updErr } = await admin
      .from("payroll_runs")
      .update(updatePatch)
      .eq("id", run.id)
      .select("*")
      .single();
    if (updErr) throw updErr;

    await admin.from("audit_events").insert({
      company_id: run.company_id,
      actor_user_id: ctx!.userId,
      actor_role: ctx!.roles[0],
      action: `PAYROLL_TRANSITION_${action}`,
      target_entity: "payroll_runs",
      target_id: run.id,
      before_data: { status: run.status },
      after_data: { status: updated.status },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
