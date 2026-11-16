import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, resolveAuthContext } from "@/lib/security/auth-session";
import { assertAuthorized } from "@/lib/security/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const updateCompanySchema = z.object({
  legalName: z.string().min(2, "Tên công ty tối thiểu 2 ký tự").max(255),
  englishName: z.string().max(255).optional().nullable(),
  taxCode: z.string().min(8, "Mã số thuế tối thiểu 8 ký tự").max(32),
  address: z.string().min(5, "Địa chỉ tối thiểu 5 ký tự"),
  phone: z.string().max(64).optional().nullable(),
  email: z.string().email("Email không hợp lệ").optional().nullable().or(z.literal("")),
  website: z.string().max(255).optional().nullable().or(z.literal("")),
  representative: z.string().max(255).optional().nullable().or(z.literal("")),
  logoUrl: z.string().optional().nullable().or(z.literal("")),
  payrollCutoffDay: z.number().int().min(1).max(28).default(25),
  payrollAdvanceDay: z.number().int().min(1).max(28).default(15),
});

export async function GET() {
  try {
    const admin = getSupabaseAdminClient();

    // 1. Fetch company base record
    const { data: comp, error: compErr } = await admin
      .from("companies")
      .select("*")
      .limit(1)
      .single();

    if (compErr || !comp) {
      return NextResponse.json(
        { error: { code: "COMPANY_NOT_FOUND", message: "Không tìm thấy thông tin công ty." } },
        { status: 404 }
      );
    }

    // 2. Fetch extended profile from legal_rule_registry (rule_code = 'COMPANY_PROFILE')
    const { data: profileRule } = await admin
      .from("legal_rule_registry")
      .select("parameters")
      .eq("company_id", comp.id)
      .eq("rule_code", "COMPANY_PROFILE")
      .maybeSingle();

    const extra = (profileRule?.parameters as Record<string, unknown>) ?? {};

    return NextResponse.json({
      data: {
        id: comp.id,
        code: comp.code,
        legalName: comp.legal_name,
        englishName: comp.english_name ?? (extra.englishName as string | null) ?? null,
        taxCode: comp.tax_code,
        address: comp.address,
        phone: comp.phone,
        email: (extra.email as string | null) ?? "contact@thekyvang.vn",
        website: (extra.website as string | null) ?? "https://thekyvang.vn",
        representative: (extra.representative as string | null) ?? "Phan Ngọc Bảo Châu",
        logoUrl: (extra.logoUrl as string | null) ?? null,
        defaultCurrency: comp.default_currency,
        timezone: comp.timezone,
        payrollCutoffDay: comp.payroll_cutoff_day ?? 25,
        payrollAdvanceDay: comp.payroll_advance_day ?? 15,
        updatedAt: comp.updated_at,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "ADMIN_AUDIT", "UPDATE");

    const body = updateCompanySchema.parse(await req.json());
    const admin = getSupabaseAdminClient();

    // 1. Get existing company
    const { data: comp, error: compErr } = await admin
      .from("companies")
      .select("id")
      .limit(1)
      .single();

    if (compErr || !comp) throw new Error("Không tìm thấy pháp nhân công ty.");

    // 2. Update base fields on companies table
    const { error: updErr } = await admin
      .from("companies")
      .update({
        legal_name: body.legalName.trim(),
        english_name: body.englishName?.trim() || null,
        tax_code: body.taxCode.trim(),
        address: body.address.trim(),
        phone: body.phone?.trim() || null,
        payroll_cutoff_day: body.payrollCutoffDay,
        payroll_advance_day: body.payrollAdvanceDay,
      })
      .eq("id", comp.id);

    if (updErr) throw updErr;

    // 3. Update extended fields in legal_rule_registry
    const today = new Date().toISOString().slice(0, 10);
    const extraParameters = {
      legalName: body.legalName.trim(),
      englishName: body.englishName?.trim() || null,
      taxCode: body.taxCode.trim(),
      address: body.address.trim(),
      phone: body.phone?.trim() || null,
      email: body.email?.trim() || null,
      website: body.website?.trim() || null,
      representative: body.representative?.trim() || null,
      logoUrl: body.logoUrl || null,
      payrollCutoffDay: body.payrollCutoffDay,
      payrollAdvanceDay: body.payrollAdvanceDay,
    };

    const { error: ruleErr } = await admin.from("legal_rule_registry").upsert(
      {
        company_id: comp.id,
        rule_code: "COMPANY_PROFILE",
        effective_from: "2026-01-01",
        effective_to: null,
        status: "APPROVED",
        source_citation: "Thông tin pháp nhân Công ty TNHH TM Thế Kỷ Vàng",
        parameters: extraParameters,
      },
      { onConflict: "company_id, rule_code, effective_from" }
    );

    if (ruleErr) throw ruleErr;

    // 4. Audit Log
    await admin.from("audit_logs").insert({
      action: "UPDATE_COMPANY_PROFILE",
      entity_name: "companies",
      record_id: comp.id,
      performed_by: ctx.userId,
      details: extraParameters,
    });

    return NextResponse.json({
      data: {
        message: "Cập nhật cấu hình tham số công ty thành công.",
        company: extraParameters,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
