import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import {
  CostCenterJournalAdapter,
  NeutralCsvBankAdapter,
  type BankTransferLine,
  type CostCenterJournalRow,
} from "@/lib/integrations/bank-export-adapter";
import { handleApiError, resolveAuthContext } from "@/lib/security/auth-session";
import { decryptPii } from "@/lib/security/pii-crypto";
import { assertAuthorized } from "@/lib/security/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "PAYROLL", "EXPORT");

    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const rawFormat = searchParams.get("format");
    const format =
      rawFormat === "accounting_csv"
        ? "accounting_csv"
        : rawFormat === "ot_variance_csv"
          ? "ot_variance_csv"
          : "bank_csv";
    const admin = getSupabaseAdminClient();

    const { data: run, error: runErr } = await admin
      .from("payroll_runs")
      .select("id, company_id, run_type, run_version, status, payroll_periods(period_code)")
      .eq("id", id)
      .single();

    if (runErr || !run) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Không tìm thấy bảng lương." } },
        { status: 404 }
      );
    }

    if (!["APPROVED", "LOCKED", "PAID"].includes(run.status)) {
      return NextResponse.json(
        {
          error: {
            code: "EXPORT_FORBIDDEN_UNAPPROVED",
            message: "Chỉ được xuất file chi trả/hạch toán sau khi Giám đốc đã phê duyệt (APPROVED/LOCKED/PAID).",
          },
        },
        { status: 409 }
      );
    }

    const periodCode =
      (run.payroll_periods as { period_code?: string } | null)?.period_code ?? "PERIOD";
    const aesKey = process.env.PII_ENCRYPTION_KEY_BASE64;

    const [{ data: results }, { data: bankAccounts }, { data: costCenters }] = await Promise.all([
      admin
        .from("payroll_results")
        .select("*, employees(id, employee_code, full_name)")
        .eq("payroll_run_id", run.id),
      admin
        .from("employee_bank_accounts")
        .select("employee_id, bank_code, bank_name, branch_name, account_no_enc, account_no_last4, is_primary")
        .eq("is_primary", true),
      admin
        .from("cost_centers")
        .select("id, code, name, accounting_ref"),
    ]);

    let csvContent = "";
    let rowCount = 0;

    if (format === "bank_csv") {
      const bankMap = new Map(
        (bankAccounts ?? []).map((b) => [b.employee_id, b])
      );
      const transferLines: BankTransferLine[] = (results ?? []).map((r) => {
        const emp = r.employees as { id: string; employee_code: string; full_name: string } | null;
        const bank = emp ? bankMap.get(emp.id) : undefined;
        let decryptedAcct = bank ? `****${bank.account_no_last4}` : "CHUA_CO_STK";
        if (bank?.account_no_enc && aesKey) {
          try {
            decryptedAcct = decryptPii(bank.account_no_enc, aesKey);
          } catch {
            decryptedAcct = `****${bank.account_no_last4}`;
          }
        }
        return {
          employeeCode: emp?.employee_code ?? "",
          fullName: emp?.full_name ?? "",
          bankAccountNumber: decryptedAcct,
          bankCode: bank?.bank_code ?? "—",
          bankName: bank?.bank_name ?? "Chưa cập nhật STK",
          branchName: bank?.branch_name ?? "",
          amountVnd: Number(r.net_payable),
          transferNote: `TKV Luong ${periodCode} ${run.run_type === "MID_MONTH_ADVANCE" ? "Dot 1" : "Dot 2"}`,
        };
      });

      csvContent = NeutralCsvBankAdapter.export(transferLines);
      rowCount = transferLines.length;
    } else if (format === "ot_variance_csv") {
      const headers = [
        "MaNV",
        "HoTen",
        "CongThucTe",
        "CongChuan",
        "LuongCoBan",
        "TienLamThemOT",
        "TongThuNhapGross",
        "ThucLinhNet",
        "CanhBaoBienDong",
      ];
      const csvRows = (results ?? []).map((r) => {
        const emp = r.employees as { employee_code?: string; full_name?: string } | null;
        const exp = (r.explanation_json ?? {}) as {
          workedDays?: number;
          standardDays?: number;
          otPay?: number;
          warnings?: string[];
        };
        return [
          emp?.employee_code ?? "",
          emp?.full_name ?? "",
          exp.workedDays ?? "",
          exp.standardDays ?? "",
          Math.round(Number(r.base_salary_snapshot ?? 0)),
          Math.round(Number(exp.otPay ?? 0)),
          Math.round(Number(r.gross_income ?? 0)),
          Math.round(Number(r.net_payable ?? 0)),
          (exp.warnings ?? []).join(" | "),
        ]
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(",");
      });
      csvContent = `\uFEFF${headers.join(",")}\r\n${csvRows.join("\r\n")}`;
      rowCount = csvRows.length;
    } else {
      const ccMap = new Map((costCenters ?? []).map((c) => [c.id, c]));
      const grouped = new Map<string, CostCenterJournalRow>();

      for (const r of results ?? []) {
        const cc = r.cost_center_id ? ccMap.get(r.cost_center_id) : undefined;
        const key = cc?.code ?? "UNASSIGNED";
        const current = grouped.get(key) ?? {
          costCenterCode: key,
          costCenterName: cc?.name ?? "Chưa phân bổ Cost Center",
          accountingRef: cc?.accounting_ref ?? "642",
          employeeCount: 0,
          totalGross: 0,
          totalEeInsurance: 0,
          totalErInsurance: 0,
          totalPit: 0,
          totalNetPayable: 0,
        };
        current.employeeCount += 1;
        current.totalGross += Number(r.gross_income);
        current.totalEeInsurance += Number(r.ee_insurance_total);
        current.totalErInsurance += Number(r.er_insurance_total);
        current.totalPit += Number(r.pit_amount);
        current.totalNetPayable += Number(r.net_payable);
        grouped.set(key, current);
      }

      const journalRows = Array.from(grouped.values());
      csvContent = CostCenterJournalAdapter.export(journalRows);
      rowCount = journalRows.length;
    }

    const fileSha256 = createHash("sha256").update(csvContent, "utf8").digest("hex");

    await admin.from("export_logs").insert({
      company_id: run.company_id,
      actor_user_id: ctx.userId,
      actor_role: ctx.roles[0],
      module_code: "PAYROLL",
      export_format: "CSV",
      filter_params: { payrollRunId: run.id, exportKind: format },
      row_count: rowCount,
      file_sha256: fileSha256,
    });

    const filename =
      format === "bank_csv"
        ? `TKV_BankTransfer_${periodCode}_v${run.run_version}.csv`
        : format === "ot_variance_csv"
          ? `TKV_OT_Variance_${periodCode}_v${run.run_version}.csv`
          : `TKV_CostCenterJournal_${periodCode}_v${run.run_version}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Export-SHA256": fileSha256,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

