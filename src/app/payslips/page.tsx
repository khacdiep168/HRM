"use client";

import { useCallback, useEffect, useState } from "react";
import { HelpCircle, Printer, ReceiptText } from "lucide-react";
import { EmptyState, ErrorRetry, SkeletonBlock } from "@/components/ui/StateViews";
import { formatCurrencyVi, translateEnumVi } from "@/lib/i18n/format";

interface PayslipItemRow {
  id: string;
  component_code: string;
  amount: number;
  tax_exempt_amount: number;
  explanation_text?: string | null;
}

interface MyPayrollResult {
  id: string;
  payroll_run_id: string;
  base_salary_snapshot: number;
  gross_income: number;
  si_base_bhxh?: number;
  ee_insurance_total: number;
  personal_deduction?: number;
  dependent_deduction?: number;
  taxable_income?: number;
  pit_amount: number;
  other_deductions?: number;
  full_month_net: number;
  mid_month_advance_paid: number;
  net_payable: number;
  explanation_json?: {
    runType?: string;
    ruleVersion?: string;
    workedDays?: number;
    standardDays?: number;
    otPay?: number;
  } | null;
  employees?: { employee_code: string; full_name: string } | null;
  payroll_items?: PayslipItemRow[];
  attendance_leave_summary?: {
    standard_days: number;
    actual_work_days: number;
    paid_leave_days: number;
    unpaid_leave_days: number;
    remaining_annual_leave: number;
  };
}

interface MyRunMeta {
  id: string;
  run_type: string;
  status: string;
  payroll_periods?: { period_code?: string } | null;
}

export default function MyPayslipsPage() {
  const [runs, setRuns] = useState<MyRunMeta[]>([]);
  const [results, setResults] = useState<MyPayrollResult[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [showWhy, setShowWhy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/v1/payroll/runs", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!active) return;
        if (!res.ok) {
          setError(json.error?.message ?? "Không thể tải phiếu lương cá nhân.");
          return;
        }
        const loadedRuns: MyRunMeta[] = json.data?.runs ?? [];
        const loadedResults: MyPayrollResult[] = json.data?.results ?? [];
        setRuns(loadedRuns);
        setResults(loadedResults);
        if (loadedResults.length > 0) {
          setSelectedId((prev) => prev || loadedResults[0].id);
        }
      })
      .catch(() => {
        if (active) setError("Lỗi kết nối máy chủ.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadTick]);

  const current = results.find((r) => r.id === selectedId) ?? results[0];
  const currentRun = runs.find((r) => r.id === current?.payroll_run_id);

  if (loading) return <SkeletonBlock rows={5} />;
  if (error) return <ErrorRetry message={error} onRetry={load} />;
  if (!current) {
    return (
      <EmptyState
        title="Chưa có phiếu lương nào"
        description="Kế toán chưa phát hành bảng lương cho kỳ hiện tại. Vui lòng quay lại sau ngày chốt lương."
      />
    );
  }

  const stdDays =
    current.attendance_leave_summary?.standard_days ??
    current.explanation_json?.standardDays ??
    22;
  const workDays =
    current.attendance_leave_summary?.actual_work_days ??
    current.explanation_json?.workedDays ??
    stdDays;
  const unionDues = Number(current.other_deductions ?? 0);
  const allowances = (current.payroll_items ?? []).filter(
    (it) =>
      it.component_code !== "BASE_SALARY" &&
      it.component_code !== "BASE_SALARY_PRORATED" &&
      it.component_code !== "MID_MONTH_ADVANCE_50"
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Phiếu lương của tôi</h1>
          <p className="text-xs text-slate-500">
            Xem chi tiết từng khoản thu nhập, khấu trừ và tải bản PDF.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowWhy((v) => !v)}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
          >
            <HelpCircle className="h-4 w-4" />
            {showWhy ? "Ẩn giải thích công thức" : "Vì sao con số này?"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <Printer className="h-4 w-4" />
            In / Tải PDF
          </button>
        </div>
      </div>

      {results.length > 1 && (
        <div className="print:hidden">
          <label htmlFor="payslip-select" className="sr-only">
            Chọn kỳ phiếu lương
          </label>
          <select
            id="payslip-select"
            value={current.id}
            onChange={(e) => setSelectedId(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900"
          >
            {results.map((r) => {
              const rm = runs.find((run) => run.id === r.payroll_run_id);
              return (
                <option key={r.id} value={r.id}>
                  Kỳ {rm?.payroll_periods?.period_code ?? "—"} •{" "}
                  {translateEnumVi(rm?.run_type)} ({translateEnumVi(rm?.status)})
                </option>
              );
            })}
          </select>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-600">
              <ReceiptText className="h-3.5 w-3.5" />
              Phiếu lương Thế Kỷ Vàng
            </div>
            <h2 className="mt-1 text-base font-bold text-slate-900">
              {current.employees?.employee_code} — {current.employees?.full_name}
            </h2>
            <p className="text-xs text-slate-500">
              Kỳ {currentRun?.payroll_periods?.period_code ?? "—"} •{" "}
              {translateEnumVi(currentRun?.run_type)}
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
            {translateEnumVi(currentRun?.status)}
          </span>
        </div>

        <div className="mt-4 space-y-2.5 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Ngày công thực tế / Chuẩn</span>
            <span className="font-mono font-semibold">
              {workDays} / {stdDays} ngày
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-600">Lương cơ bản hợp đồng</span>
            <span className="font-mono font-semibold">
              {formatCurrencyVi(current.base_salary_snapshot)}
            </span>
          </div>
          {showWhy && (
            <div className="rounded-lg bg-slate-50 px-3 py-1.5 text-[11px] text-slate-600">
              Công thức: Lương cơ bản × ({workDays} / {stdDays} ngày công chuẩn) ={" "}
              {formatCurrencyVi((current.base_salary_snapshot * workDays) / Math.max(1, stdDays))}
            </div>
          )}

          {allowances.map((it) => (
            <div key={it.id} className="flex justify-between text-emerald-700">
              <span>(+) {it.explanation_text || it.component_code}</span>
              <span className="font-mono">+{formatCurrencyVi(it.amount)}</span>
            </div>
          ))}

          <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold text-slate-900">
            <span>Tổng thu nhập Gross</span>
            <span className="font-mono">{formatCurrencyVi(current.gross_income)}</span>
          </div>

          <div className="flex justify-between text-rose-700">
            <span>(-) BHXH / BHYT / BHTN (10,5%)</span>
            <span className="font-mono">-{formatCurrencyVi(current.ee_insurance_total)}</span>
          </div>
          {showWhy && (
            <div className="rounded-lg bg-slate-50 px-3 py-1.5 text-[11px] text-slate-600">
              Công thức: 10,5% (8% BHXH + 1,5% BHYT + 1% BHTN) × Mức đóng BHXH (
              {formatCurrencyVi(current.si_base_bhxh ?? 0)})
            </div>
          )}

          <div className="flex justify-between text-rose-700">
            <span>(-) Thuế TNCN khấu trừ</span>
            <span className="font-mono">-{formatCurrencyVi(current.pit_amount)}</span>
          </div>
          {showWhy && (
            <div className="rounded-lg bg-slate-50 px-3 py-1.5 text-[11px] text-slate-600">
              Giảm trừ gia cảnh: {formatCurrencyVi(current.personal_deduction ?? 0)} (bản thân) +{" "}
              {formatCurrencyVi(current.dependent_deduction ?? 0)} (NPT) • Thu nhập tính thuế:{" "}
              {formatCurrencyVi(current.taxable_income ?? 0)}
            </div>
          )}

          <div className="flex justify-between text-rose-700">
            <span>(-) Đoàn phí công đoàn (1%)</span>
            <span className="font-mono">-{formatCurrencyVi(unionDues)}</span>
          </div>

          <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold text-slate-900">
            <span>Thực lĩnh cả tháng</span>
            <span className="font-mono">{formatCurrencyVi(current.full_month_net)}</span>
          </div>

          <div className="flex justify-between text-amber-700">
            <span>(-) Đã tạm ứng Đợt 1</span>
            <span className="font-mono">-{formatCurrencyVi(current.mid_month_advance_paid)}</span>
          </div>

          <div className="flex justify-between rounded-xl bg-emerald-50 p-3.5 text-base font-bold text-emerald-800">
            <span>THỰC NHẬN ĐỢT NÀY</span>
            <span className="font-mono">{formatCurrencyVi(current.net_payable)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
