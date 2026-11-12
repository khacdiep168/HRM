import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, resolveAuthContext } from "@/lib/security/auth-session";
import { assertAuthorized } from "@/lib/security/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const createRuleSchema = z.object({
  ruleCode: z.string().trim().min(3).max(64),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  ruleVersion: z.string().trim().min(2).max(32),
  region3MinWage: z.number().positive(),
  bhxhReferenceLevel: z.number().positive(),
  selfDeduction: z.number().positive(),
  dependentDeduction: z.number().positive(),
  lunchCashExemptCap: z.number().nonnegative(),
  sourceCitation: z.string().trim().min(3).max(255),
});

export async function GET() {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "ORGANIZATION", "READ");

    const admin = getSupabaseAdminClient();
    const { data: rules, error } = await admin
      .from("legal_rule_registry")
      .select("*")
      .order("effective_from", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ data: rules ?? [] });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "ORGANIZATION", "UPDATE");

    const body = createRuleSchema.parse(await req.json());
    const admin = getSupabaseAdminClient();
    const { data: company } = await admin.from("companies").select("id").limit(1).single();
    if (!company) {
      return NextResponse.json(
        { error: { code: "COMPANY_NOT_FOUND", message: "Không tìm thấy công ty." } },
        { status: 400 }
      );
    }

    const { data, error } = await admin
      .from("legal_rule_registry")
      .insert({
        company_id: company.id,
        rule_code: body.ruleCode,
        effective_from: body.effectiveFrom,
        effective_to: body.effectiveTo ?? null,
        status: "APPROVED",
        parameters: {
          ruleVersion: body.ruleVersion,
          regionalMinWage: { III: body.region3MinWage },
          bhxhReferenceLevel: body.bhxhReferenceLevel,
          selfDeduction: body.selfDeduction,
          dependentDeduction: body.dependentDeduction,
          lunchCashExemptCap: body.lunchCashExemptCap,
          sourceCitation: body.sourceCitation,
        },
      })
      .select("*")
      .single();

    if (error) throw error;

    await admin.from("audit_events").insert({
      company_id: company.id,
      actor_user_id: ctx.userId,
      actor_role: ctx.roles[0],
      action: "LEGAL_RULE_CREATED",
      target_entity: "legal_rule_registry",
      target_id: data.id,
      after_data: data,
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

