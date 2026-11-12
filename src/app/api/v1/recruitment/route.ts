import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, resolveAuthContext } from "@/lib/security/auth-session";
import { encryptPii } from "@/lib/security/pii-crypto";
import { assertAuthorized, assertNotSelfApproval } from "@/lib/security/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const recruitmentActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("REQUISITION"),
    departmentId: z.string().uuid(),
    positionId: z.string().uuid(),
    title: z.string().trim().min(3).max(200),
    headcount: z.number().int().positive().max(100),
    targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
  z.object({
    kind: z.literal("CANDIDATE"),
    requisitionId: z.string().uuid(),
    fullName: z.string().trim().min(2).max(200),
    email: z.string().email().optional(),
    phone: z.string().min(8).max(20).optional(),
    source: z.string().max(64).default("DIRECT"),
  }),
  z.object({
    kind: z.literal("OFFER"),
    applicationId: z.string().uuid(),
    proposedSalary: z.number().positive(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({
    kind: z.literal("APPROVE_OFFER"),
    offerId: z.string().uuid(),
  }),
]);

export async function GET() {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "RECRUITMENT", "READ");

    const admin = getSupabaseAdminClient();
    const [reqRes, appRes, offerRes, deptRes, posRes] = await Promise.all([
      admin
        .from("job_requisitions")
        .select("*, departments(code, name), positions(code, title, headcount_limit)")
        .order("created_at", { ascending: false }),
      admin
        .from("applications")
        .select(
          "id, stage, status, applied_at, requisition_id, candidates(id, full_name, email, phone_last4, source, retention_until), job_requisitions(title)"
        )
        .order("applied_at", { ascending: false }),
      admin
        .from("offers")
        .select("*, applications(candidates(full_name), job_requisitions(title))")
        .order("created_at", { ascending: false }),
      admin.from("departments").select("id, code, name").eq("status", "ACTIVE").order("code"),
      admin.from("positions").select("id, department_id, code, title, headcount_limit").eq("is_active", true).order("code"),
    ]);

    if (reqRes.error) throw reqRes.error;

    return NextResponse.json({
      data: {
        requisitions: reqRes.data ?? [],
        applications: appRes.data ?? [],
        offers: offerRes.data ?? [],
        departments: deptRes.data ?? [],
        positions: posRes.data ?? [],
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await resolveAuthContext();
    if (!ctx) {
      assertAuthorized(null, "RECRUITMENT", "READ");
    }

    const body = recruitmentActionSchema.parse(await req.json());
    const admin = getSupabaseAdminClient();
    const { data: company, error: compErr } = await admin
      .from("companies")
      .select("id")
      .limit(1)
      .single();
    if (compErr || !company) throw new Error("Không tìm thấy pháp nhân công ty.");

    if (body.kind === "REQUISITION") {
      assertAuthorized(ctx, "RECRUITMENT", "CREATE");
      const { data: pos } = await admin
        .from("positions")
        .select("headcount_limit")
        .eq("id", body.positionId)
        .single();
      if (pos && body.headcount > pos.headcount_limit) {
        return NextResponse.json(
          {
            error: {
              code: "HEADCOUNT_EXCEEDS_BUDGET",
              message: `Số lượng tuyển (${body.headcount}) vượt định biên cho phép (${pos.headcount_limit}).`,
            },
          },
          { status: 422 }
        );
      }

      const { data, error } = await admin
        .from("job_requisitions")
        .insert({
          company_id: company.id,
          department_id: body.departmentId,
          position_id: body.positionId,
          title: body.title,
          headcount: body.headcount,
          target_date: body.targetDate ?? null,
          status: "OPEN",
          created_by: ctx!.userId,
        })
        .select("*")
        .single();
      if (error) throw error;
      return NextResponse.json({ data }, { status: 201 });
    }

    if (body.kind === "CANDIDATE") {
      assertAuthorized(ctx, "RECRUITMENT", "CREATE");
      let phoneEnc: string | null = null;
      let phoneLast4: string | null = null;
      if (body.phone) {
        const aesKey = process.env.PII_ENCRYPTION_KEY_BASE64;
        if (!aesKey) throw new Error("Thiếu PII_ENCRYPTION_KEY_BASE64.");
        phoneEnc = encryptPii(body.phone.trim(), aesKey);
        phoneLast4 = body.phone.trim().slice(-4);
      }

      const retDate = new Date();
      retDate.setUTCMonth(retDate.getUTCMonth() + 12);

      const { data: cand, error: cErr } = await admin
        .from("candidates")
        .insert({
          company_id: company.id,
          full_name: body.fullName,
          email: body.email ?? null,
          phone_enc: phoneEnc,
          phone_last4: phoneLast4,
          source: body.source,
          retention_until: retDate.toISOString().slice(0, 10),
        })
        .select("*")
        .single();
      if (cErr) throw cErr;

      const { data: app, error: aErr } = await admin
        .from("applications")
        .insert({
          company_id: company.id,
          requisition_id: body.requisitionId,
          candidate_id: cand.id,
          stage: "APPLIED",
          status: "ACTIVE",
        })
        .select("*")
        .single();
      if (aErr) throw aErr;

      return NextResponse.json({ data: { candidate: cand, application: app } }, { status: 201 });
    }

    if (body.kind === "OFFER") {
      assertAuthorized(ctx, "RECRUITMENT", "UPDATE");
      const { data: offer, error } = await admin
        .from("offers")
        .insert({
          company_id: company.id,
          application_id: body.applicationId,
          proposed_salary: body.proposedSalary,
          pay_structure: "GROSS",
          start_date: body.startDate,
          status: "PENDING",
          created_by: ctx!.userId,
        })
        .select("*")
        .single();
      if (error) throw error;

      await admin
        .from("applications")
        .update({ stage: "OFFER" })
        .eq("id", body.applicationId);

      return NextResponse.json({ data: offer }, { status: 201 });
    }

    // APPROVE_OFFER (SoD protected)
    assertAuthorized(ctx, "RECRUITMENT", "APPROVE");
    const { data: offer, error: oErr } = await admin
      .from("offers")
      .select("*")
      .eq("id", body.offerId)
      .single();
    if (oErr || !offer) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Không tìm thấy thư mời nhận việc." } },
        { status: 404 }
      );
    }
    if (offer.created_by) {
      assertNotSelfApproval(ctx!.userId, offer.created_by);
    }

    const { data: approved, error: upErr } = await admin
      .from("offers")
      .update({ status: "APPROVED", approved_by: ctx!.userId })
      .eq("id", offer.id)
      .select("*")
      .single();
    if (upErr) throw upErr;

    return NextResponse.json({ data: approved });
  } catch (err) {
    return handleApiError(err);
  }
}

