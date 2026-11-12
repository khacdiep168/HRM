import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, resolveAuthContext } from "@/lib/security/auth-session";
import { encryptPii } from "@/lib/security/pii-crypto";
import { assertAuthorized } from "@/lib/security/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const createContractSchema = z.object({
  employeeId: z.string().uuid(),
  contractNo: z.string().trim().min(3).max(64),
  contractType: z.enum(["PROBATION", "FIXED_TERM", "INDEFINITE", "PART_TIME", "SEASONAL"]),
  signedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  probationRate: z.number().min(0.85).max(1).default(1),
  bankCode: z.string().max(32).optional(),
  bankName: z.string().max(128).optional(),
  accountNo: z.string().min(6).max(32).optional(),
  accountHolder: z.string().max(255).optional(),
});

export async function GET() {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "CONTRACTS", "READ");

    const admin = getSupabaseAdminClient();
    const isHrOrExec = ctx.roles.some((r) =>
      ["HR_ADMIN", "HR_STAFF", "ACCOUNTANT", "DIRECTOR", "AUDITOR", "DEPARTMENT_MANAGER"].includes(r)
    );

    let contractsQuery = admin
      .from("contracts")
      .select(
        "*, employees(employee_code, full_name), contract_terms(work_hours_per_day, work_days_per_week, probation_rate, notice_days)"
      )
      .order("effective_from", { ascending: false });

    if (!isHrOrExec && ctx.employeeId) {
      contractsQuery = contractsQuery.eq("employee_id", ctx.employeeId);
    }

    const [{ data: contracts, error }, { data: employees }, { data: bankAccounts }] =
      await Promise.all([
        contractsQuery,
        isHrOrExec
          ? admin.from("employees").select("id, employee_code, full_name").order("employee_code")
          : Promise.resolve({ data: [] }),
        admin
          .from("employee_bank_accounts")
          .select("employee_id, bank_code, bank_name, account_no_last4, is_primary")
          .eq("is_primary", true),
      ]);

    if (error) throw error;

    return NextResponse.json({
      data: {
        contracts: contracts ?? [],
        employees: employees ?? [],
        bankAccounts: (bankAccounts ?? []).map((b) => ({
          ...b,
          account_no_masked: `****${b.account_no_last4}`,
        })),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "CONTRACTS", "CREATE");

    const body = createContractSchema.parse(await req.json());
    if (body.effectiveTo && body.effectiveTo < body.effectiveFrom) {
      return NextResponse.json(
        { error: { code: "INVALID_DATE_RANGE", message: "Ngày kết thúc HĐLĐ phải >= ngày hiệu lực." } },
        { status: 422 }
      );
    }

    const admin = getSupabaseAdminClient();
    const { data: company, error: compErr } = await admin
      .from("companies")
      .select("id")
      .limit(1)
      .single();
    if (compErr || !company) throw new Error("Không tìm thấy pháp nhân công ty.");

    // Check overlapping active contracts for the same employee
    const { data: existingContracts } = await admin
      .from("contracts")
      .select("id, contract_no, effective_from, effective_to, status")
      .eq("employee_id", body.employeeId)
      .eq("status", "ACTIVE");

    const hasOverlap = (existingContracts ?? []).some((c) => {
      const cStart = String(c.effective_from);
      const cEnd = c.effective_to ? String(c.effective_to) : "9999-12-31";
      const nEnd = body.effectiveTo ?? "9999-12-31";
      return body.effectiveFrom <= cEnd && nEnd >= cStart;
    });

    if (hasOverlap) {
      return NextResponse.json(
        {
          error: {
            code: "CONTRACT_DATE_OVERLAP",
            message: "Nhân viên đang có hợp đồng ACTIVE trùng khoảng thời gian hiệu lực.",
          },
        },
        { status: 409 }
      );
    }

    const { data: created, error: insErr } = await admin
      .from("contracts")
      .insert({
        company_id: company.id,
        employee_id: body.employeeId,
        contract_no: body.contractNo,
        contract_type: body.contractType,
        signed_date: body.signedDate,
        effective_from: body.effectiveFrom,
        effective_to: body.effectiveTo ?? null,
        status: "ACTIVE",
        created_by: ctx.userId,
      })
      .select("*")
      .single();
    if (insErr) throw insErr;

    await admin.from("contract_terms").insert({
      contract_id: created.id,
      probation_rate: body.probationRate,
    });

    // Optional encrypted bank account registration for 100% bank-transfer payroll
    if (body.accountNo && body.bankCode && body.bankName) {
      const aesKey = process.env.PII_ENCRYPTION_KEY_BASE64;
      if (!aesKey) {
        throw new Error("Thiếu PII_ENCRYPTION_KEY_BASE64 để mã hóa số tài khoản ngân hàng.");
      }
      await admin
        .from("employee_bank_accounts")
        .update({ is_primary: false })
        .eq("employee_id", body.employeeId);

      await admin.from("employee_bank_accounts").insert({
        company_id: company.id,
        employee_id: body.employeeId,
        bank_code: body.bankCode.toUpperCase(),
        bank_name: body.bankName,
        account_no_enc: encryptPii(body.accountNo.trim(), aesKey),
        account_no_last4: body.accountNo.trim().slice(-4),
        account_holder: body.accountHolder ?? "CHỦ TÀI KHOẢN",
        is_primary: true,
      });
    }

    // Automatic statutory 10-year retention legal hold (Luật Kế toán & BLLĐ 2019)
    await admin.from("legal_holds").insert({
      company_id: company.id,
      target_entity: "contracts",
      target_id: created.id,
      reason: `Lưu trữ bắt buộc HĐLĐ số ${created.contract_no}`,
      legal_basis: "Bộ luật Lao động 2019 & Luật Kế toán 88/2015/QH13 (tối thiểu 10 năm)",
      created_by: ctx.userId,
    });

    await admin.from("audit_events").insert({
      company_id: company.id,
      actor_user_id: ctx.userId,
      actor_role: ctx.roles[0],
      action: "CONTRACT_CREATE",
      target_entity: "contracts",
      target_id: created.id,
      after_data: { contractNo: created.contract_no, contractType: created.contract_type },
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

