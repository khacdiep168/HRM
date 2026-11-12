"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wallet, AlertCircle, Play, ShieldCheck, Lock, FileText, X, Printer, Download } from "lucide-react";
import { buildUtf8BomCsv } from "@/lib/integrations/csv-helper";
import {
  PAYROLL_RUN_TYPE_LABELS,
  PAYROLL_STATUS_LABELS,
  labelOf,
} from "@/lib/i18n/vi-labels";

interface PayrollPeriod {
  id: string;
  period_code: string;
  start_date: string;
  end_date: string;
  cutoff_date: string;
  advance_pay_date: string;
  settlement_pay_date: string;
  standard_work_days: number;
  status: string;
}

interface EmployeeSummary {
  id: string;
  employee_code: string;
  full_name: string;
}

interface PayrollRunRow {
  id: string;
  payroll_period_id: string;
  run_type: "MID_MONTH_ADVANCE" | "END_MONTH_SETTLEMENT";
  run_version: number;
  status: string;
  total_employees: number;
  total_gross_amount: number;
  total_net_payable: number;
  created_at: string;
  payroll_periods: { period_code: string } | null;
}

interface PayrollResultRow {
  id: string;
  payroll_run_id: string;
  base_salary_snapshot: number;
  gross_income: number;
  si_base_bhxh?: number;
  si_base_bhtn?: number;
  ee_insurance_total: number;
  er_insurance_total?: number;
  personal_deduction?: number;
  dependent_deduction?: number;
  taxable_income?: number;
  pit_amount: number;
  other_deductions?: number;
  full_month_net: number;
  mid_month_advance_paid: number;
  net_payable: number;
  employer_total_cost?: number;
  explanation_json?: {
    workedDays?: number;
    standardDays?: number;
    unionFeeEr?: number;
    warnings?: string[];
    otPay?: number;
    isSimulation?: boolean;
    payStructure?: string;
  } | null;
  employees: { employee_code: string; full_name: string } | null;
  payroll_items?: Array<{
    id: string;
    component_code: string;
    category: string;
    tier_source: string;
    quantity: number;
    rate: number;
    amount: number;
    tax_exempt_amount: number;
    explanation_text?: string | null;
  }>;
  attendance_leave_summary?: {
    standard_days: number;
    actual_work_days: number;
    paid_leave_days: number;
    unpaid_leave_days: number;
    paid_days: number;
    remaining_annual_leave: number;
  };
}

const ALLOWANCE_CODE_LABELS: Record<string, string> = {
  LUNCH_ALLOWANCE: "Tiền ăn trưa / ăn ca",
  MEAL_ALLOWANCE: "Phụ cấp ăn trưa",
  PHONE_ALLOWANCE: "Phụ cấp điện thoại",
  TRANSPORT_ALLOWANCE: "Phụ cấp xăng xe / đi lại",
  FUEL_ALLOWANCE: "Phụ cấp xăng xe / đi lại",
  SHIFT_HAZARD_ALLOW: "Phụ cấp ca đêm / nặng nhọc",
  SALES_COMMISSION: "Thưởng doanh số / Hoa hồng KD",
  BONUS_MONTH_13: "Thưởng lương tháng 13",
  BONUS_MONTH_14: "Thưởng lương tháng 14 / Thưởng Tết",
  KPI_BONUS: "Thưởng hiệu suất / KPI",
  SENIORITY_ALLOWANCE: "Phụ cấp thâm niên",
  BUSINESS_ALLOWANCE: "Phụ cấp kinh doanh / tiếp khách",
  HOUSING_ALLOWANCE: "Phụ cấp nhà ở",
  ATTENDANCE_BONUS: "Thưởng chuyên cần",
  RESPONSIBILITY_ALLOWANCE: "Phụ cấp trách nhiệm / chức vụ",
  UNIFORM_ALLOWANCE: "Phụ cấp trang phục",
};

function formatAllowanceLabel(item: {
  component_code: string;
  explanation_text?: string | null;
}) {
  if (item.explanation_text) {
    return item.explanation_text.replace(
      /\s*\((COMPANY_DEFAULT|DEPARTMENT_POLICY|EMPLOYEE_OVERRIDE|PERIOD_VARIABLE|CONTRACT_BASE)\)\s*/g,
      ""
    );
  }
  return ALLOWANCE_CODE_LABELS[item.component_code] ?? item.component_code;
}

const fmtVnd = (n: number) => `${Math.round(Number(n)).toLocaleString("vi-VN")} đ`;

export default function PayrollPage() {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [runs, setRuns] = useState<PayrollRunRow[]>([]);
  const [results, setResults] = useState<PayrollResultRow[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [selectedPayslip, setSelectedPayslip] = useState<PayrollResultRow | null>(null);

  const [salEmpId, setSalEmpId] = useState("");
  const [calcEmpId, setCalcEmpId] = useState("");
  const [calcRunType, setCalcRunType] = useState<"END_MONTH_SETTLEMENT" | "MID_MONTH_ADVANCE">(
    "END_MONTH_SETTLEMENT"
  );
  const [baseSalary, setBaseSalary] = useState("15000000");
  const [siSalary, setSiSalary] = useState("15000000");
  const [dependents, setDependents] = useState("0");
  const [salaryAssignments, setSalaryAssignments] = useState<
    Array<{ employee_id: string; base_salary: number; si_salary_base: number }>
  >([]);
  const [taxProfiles, setTaxProfiles] = useState<
    Array<{ employee_id: string; dependent_count: number }>
  >([]);

  function fillSalaryFields(
    empId: string,
    salaries: Array<{ employee_id: string; base_salary: number; si_salary_base: number }>,
    taxes: Array<{ employee_id: string; dependent_count: number }>
  ) {
    const sal = salaries.find((s) => s.employee_id === empId);
    const tax = taxes.find((t) => t.employee_id === empId);
    if (sal) {
      setBaseSalary(String(Math.round(Number(sal.base_salary))));
      setSiSalary(String(Math.round(Number(sal.si_salary_base))));
    } else {
      setBaseSalary("15000000");
      setSiSalary("15000000");
    }
    setDependents(String(tax?.dependent_count ?? 0));
  }

  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/v1/payroll/periods", { cache: "no-store" }),
      fetch("/api/v1/payroll/runs", { cache: "no-store" }),
    ])
      .then(async ([pRes, rRes]) => {
        if (!active) return;
        const pJson = await pRes.json();
        const rJson = await rRes.json();
        if (!pRes.ok) {
          setError(pJson.error?.message ?? "Không thể tải dữ liệu bảng lương.");
          return;
        }
        const loadedPeriods: PayrollPeriod[] = pJson.data.periods ?? [];
        const loadedEmployees: EmployeeSummary[] = pJson.data.employees ?? [];
        const loadedSalaries = pJson.data.salaryAssignments ?? [];
        const loadedTaxes = pJson.data.taxProfiles ?? [];
        const loadedRuns: PayrollRunRow[] = rJson.data?.runs ?? [];

        setError(null);
        setPeriods(loadedPeriods);
        setEmployees(loadedEmployees);
        setSalaryAssignments(loadedSalaries);
        setTaxProfiles(loadedTaxes);
        setRuns(loadedRuns);
        setResults(rJson.data?.results ?? []);

        if (loadedPeriods.length > 0) setSelectedPeriodId((p) => p || loadedPeriods[0].id);
        if (loadedEmployees.length > 0) {
          setSalEmpId((prev) => {
            const targetEmp = prev || loadedEmployees[0].id;
            fillSalaryFields(targetEmp, loadedSalaries, loadedTaxes);
            return targetEmp;
          });
          setCalcEmpId((prev) => prev || loadedEmployees[0].id);
        }
        if (loadedRuns.length > 0) setSelectedRunId((r) => r || loadedRuns[0].id);
      })
      .catch(() => {
        if (active) setError("Lỗi kết nối server.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadTick]);

  async function handleSaveSalary(e: React.FormEvent) {
    e.preventDefault();
    setActionErr(null);
    setActionMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/v1/payroll/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: salEmpId,
          baseSalary: Number(baseSalary),
          siSalaryBase: Number(siSalary),
          dependentsCount: Number(dependents),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setActionErr(json.error?.message ?? "Không thể cập nhật lương hợp đồng.");
        return;
      }
      setActionMsg("Đã lưu mức lương Gross & BHXH làm căn cứ chạy lương.");
      setReloadTick((t) => t + 1);
    } finally {
      setBusy(false);
    }
  }

  async function handleRunPayroll(
    runType: "MID_MONTH_ADVANCE" | "END_MONTH_SETTLEMENT",
    isSimulation = false,
  ) {
    if (!selectedPeriodId) return;
    setActionErr(null);
    setActionMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/v1/payroll/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payrollPeriodId: selectedPeriodId,
          runType,
          isSimulation,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setActionErr(json.error?.message ?? "Không thể tính bảng lương.");
        return;
      }
      setSelectedRunId(json.data.id);
      setActionMsg(
        isSimulation
          ? "Đã chạy thử (Simulation - DRAFT) bảng lương cuối tháng để kiểm tra & đối soát."
          : runType === "MID_MONTH_ADVANCE"
            ? "Đã tính xong Bảng tạm ứng Đợt 1 (Ngày 15 — 50% Lương cơ bản)."
            : "Đã tính xong Bảng quyết toán Đợt 2 (Cuối tháng — trừ BHXH, Thuế & Tạm ứng 15).",
      );
      setReloadTick((t) => t + 1);
    } finally {
      setBusy(false);
    }
  }

  async function handleCalculateSingleEmployee() {
    if (!selectedPeriodId || !calcEmpId) return;
    setActionErr(null);
    setActionMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/v1/payroll/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payrollPeriodId: selectedPeriodId,
          runType: calcRunType,
          employeeId: calcEmpId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setActionErr(json.error?.message ?? "Không thể tính lương cho nhân viên đã chọn.");
        return;
      }
      if (json.data?.id) setSelectedRunId(json.data.id);
      if (json.data?.employeeResult) {
        setSelectedPayslip(json.data.employeeResult);
      }
      const empName =
        employees.find((e) => e.id === calcEmpId)?.full_name ?? "nhân viên đã chọn";
      setActionMsg(`Đã tính xong lương và mở phiếu lương cho ${empName}.`);
      setReloadTick((t) => t + 1);
    } finally {
      setBusy(false);
    }
  }

  async function handleTransition(runId: string, action: string) {
    let reason: string | undefined;
    if (action === "UNLOCK") {
      const input = window.prompt("Nhập lý do mở khóa kỳ lương (tối thiểu 5 ký tự):");
      if (!input || input.trim().length < 5) {
        setActionErr("Bắt buộc nhập lý do tối thiểu 5 ký tự để mở khóa kỳ lương.");
        return;
      }
      reason = input.trim();
    }
    setActionErr(null);
    setActionMsg(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/payroll/runs/${runId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(reason ? { reason } : {}) }),
      });
      const json = await res.json();
      if (!res.ok) {
        setActionErr(json.error?.message ?? "Chuyển trạng thái phê duyệt thất bại.");
        return;
      }
      setActionMsg(`Đã chuyển bảng lương sang trạng thái: ${json.data.status}`);
      setReloadTick((t) => t + 1);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="h-5 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
        <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
        <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle className="h-5 w-5" />
          Chưa thể truy cập Bảng lương 2 Đợt
        </div>
        <p className="mt-2 text-xs text-amber-800">{error}</p>
        <Link
          href="/login"
          className="mt-4 inline-block rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white"
        >
          Đăng nhập / MFA
        </Link>
      </div>
    );
  }

  const activePeriod = periods.find((p) => p.id === selectedPeriodId);
  const runResults = results.filter((r) => r.payroll_run_id === selectedRunId);

  function getAllowanceTotal(res: PayrollResultRow) {
    const items = (res.payroll_items ?? []).filter(
      (it) =>
        it.component_code !== "BASE_SALARY" &&
        it.component_code !== "BASE_SALARY_PRORATED" &&
        it.component_code !== "MID_MONTH_ADVANCE_50"
    );
    if (items.length > 0) {
      return items.reduce((sum, it) => sum + Number(it.amount || 0), 0);
    }
    return Math.max(0, Number(res.gross_income) - Number(res.base_salary_snapshot));
  }

  function handleExportDetailedPayrollCsv() {
    if (runResults.length === 0) return;
    const headers = [
      "Mã NV",
      "Họ và tên",
      "Công chuẩn",
      "Ngày làm thực tế",
      "Nghỉ phép hưởng lương",
      "Nghỉ không lương",
      "Phép năm còn lại",
      "Lương CB Hợp đồng",
      "Tổng Phụ cấp & Thưởng",
      "Tổng thu nhập Gross",
      "Lương đóng BHXH",
      "BHXH/YT/TN NLĐ (10.5%)",
      "Thuế TNCN",
      "Đoàn phí CĐ (1%)",
      "Thực lĩnh cả tháng",
      "Đã tạm ứng Đợt 15",
      "Chi trả đợt này (NET)",
      "BHXH DN đóng (21.5%)",
      "Kinh phí CĐ DN (2%)",
    ];
    const rows = runResults.map((res) => {
      const att = res.attendance_leave_summary;
      const stdDays = att?.standard_days ?? activePeriod?.standard_work_days ?? 22;
      const workDays = att?.actual_work_days ?? res.explanation_json?.workedDays ?? stdDays;
      const paidLeave = att?.paid_leave_days ?? 0;
      const unpaidLeave = att?.unpaid_leave_days ?? 0;
      const remLeave = att?.remaining_annual_leave ?? 12;
      const allowanceTotal = getAllowanceTotal(res);
      const bhxhBase = Number(res.si_base_bhxh ?? 0);
      const unionDues = Number(res.other_deductions ?? 0);
      const erIns = Number(res.er_insurance_total ?? 0);
      const unionEr = Number(res.explanation_json?.unionFeeEr ?? 0);

      return [
        res.employees?.employee_code ?? "",
        res.employees?.full_name ?? "",
        stdDays,
        workDays,
        paidLeave,
        unpaidLeave,
        remLeave,
        Math.round(res.base_salary_snapshot),
        Math.round(allowanceTotal),
        Math.round(res.gross_income),
        Math.round(bhxhBase),
        Math.round(res.ee_insurance_total),
        Math.round(res.pit_amount),
        Math.round(unionDues),
        Math.round(res.full_month_net),
        Math.round(res.mid_month_advance_paid),
        Math.round(res.net_payable),
        Math.round(erIns),
        Math.round(unionEr),
      ];
    });
    const csv = buildUtf8BomCsv(headers, rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bang_luong_chi_tiet_${activePeriod?.period_code ?? "ky"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden">
      <div className={selectedPayslip ? "space-y-6 print:hidden" : "space-y-6"}>
      {/* 5-Step Monthly Payroll Stepper */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-xs sm:grid-cols-5">
        {[
          { step: "1. Chốt công", desc: "Kiểm tra công & bất thường" },
          { step: "2. Tính lương", desc: "Chạy thử & So sánh kỳ trước" },
          { step: "3. Rà soát", desc: "Kế toán & Giám đốc duyệt" },
          { step: "4. Khóa kỳ", desc: "Bất biến (Mở khóa cần lý do)" },
          { step: "5. Phát hành", desc: "Phiếu lương PDF & CSV Bank" },
        ].map((s) => (
          <div key={s.step} className="rounded-xl bg-slate-50 px-3 py-2">
            <div className="font-bold text-slate-900">{s.step}</div>
            <div className="text-[11px] text-slate-500">{s.desc}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Wallet className="h-5 w-5 text-amber-600" />
            Tính lương 2 Đợt &amp; Phê duyệt 2 Cấp (Engine VN-2026-H2)
          </h1>
          <p className="text-xs text-slate-500">
            Chốt công ngày 25 • Đợt 1 ngày 15 (50% CB) • Đợt 2 cuối tháng (Thực lĩnh - Đợt 1) • Bắt buộc Kế toán trưởng duyệt trước Giám đốc.
          </p>
        </div>

        <select
          value={selectedPeriodId}
          onChange={(e) => setSelectedPeriodId(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
        >
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              Kỳ {p.period_code} (Chốt công {p.cutoff_date})
            </option>
          ))}
        </select>
      </div>

      {actionErr && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {actionErr}
        </div>
      )}
      {actionMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          {actionMsg}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Contract Salary Assignment Helper */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Gán Lương Hợp đồng Gross &amp; NPT</h2>
          <form onSubmit={handleSaveSalary} className="mt-3 space-y-2.5 text-xs">
            <div>
              <label className="block font-medium text-slate-700">Nhân viên</label>
              <select
                value={salEmpId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setSalEmpId(nextId);
                  fillSalaryFields(nextId, salaryAssignments, taxProfiles);
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2"
              >
                {employees.length === 0 ? (
                  <option value="">Tạo nhân viên tại mục Nhân sự trước</option>
                ) : (
                  employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.employee_code} — {e.full_name}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-medium text-slate-700">Lương CB Gross</label>
                <input
                  type="number"
                  required
                  value={baseSalary}
                  onChange={(e) => setBaseSalary(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700">Lương đóng BHXH</label>
                <input
                  type="number"
                  required
                  value={siSalary}
                  onChange={(e) => setSiSalary(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block font-medium text-slate-700">Số người phụ thuộc</label>
              <input
                type="number"
                min={0}
                value={dependents}
                onChange={(e) => setDependents(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={busy || !salEmpId}
              className="w-full rounded-lg border border-slate-900 px-3 py-2 font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
            >
              Lưu mức lương Gross
            </button>
          </form>
        </section>

        {/* Execute 2-Installment Runs */}
        <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Chạy Tính lương Kỳ {activePeriod?.period_code ?? "—"}
              </h2>
              <p className="text-xs text-slate-500">
                Chu kỳ công: {activePeriod?.start_date} → {activePeriod?.end_date} • Ngày ứng:{" "}
                {activePeriod?.advance_pay_date} • Quyết toán: {activePeriod?.settlement_pay_date}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => handleRunPayroll("MID_MONTH_ADVANCE")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" />
                Chạy Đợt 1 (Ngày 15 • 50% CB)
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleRunPayroll("END_MONTH_SETTLEMENT", true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" />
                Chạy thử (Simulation)
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleRunPayroll("END_MONTH_SETTLEMENT")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" />
                Chạy Đợt 2 (Cuối tháng)
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
            <div className="text-xs font-bold text-emerald-950">
              Tính lương &amp; In Phiếu lương riêng theo Nhân viên
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <select
                value={calcEmpId}
                onChange={(e) => setCalcEmpId(e.target.value)}
                className="min-w-[220px] flex-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-2 text-slate-900"
              >
                {employees.length === 0 ? (
                  <option value="">Chưa có nhân viên</option>
                ) : (
                  employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.employee_code} — {e.full_name}
                    </option>
                  ))
                )}
              </select>
              <select
                value={calcRunType}
                onChange={(e) =>
                  setCalcRunType(
                    e.target.value as "END_MONTH_SETTLEMENT" | "MID_MONTH_ADVANCE"
                  )
                }
                className="rounded-lg border border-emerald-300 bg-white px-2.5 py-2 text-slate-900"
              >
                <option value="END_MONTH_SETTLEMENT">Đợt 2 — Quyết toán cuối tháng</option>
                <option value="MID_MONTH_ADVANCE">Đợt 1 — Tạm ứng ngày 15 (50%)</option>
              </select>
              <button
                type="button"
                disabled={busy || !calcEmpId || !selectedPeriodId}
                onClick={handleCalculateSingleEmployee}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Printer className="h-3.5 w-3.5" />
                Tính lương &amp; Xem / In Phiếu lương
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Đợt chạy</th>
                  <th className="px-3 py-2">Trạng thái</th>
                  <th className="px-3 py-2">NV</th>
                  <th className="px-3 py-2">Tổng chi đợt này</th>
                  <th className="px-3 py-2 text-right">Duyệt SoD &amp; Khóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {runs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                      Chưa có lần chạy lương nào.
                    </td>
                  </tr>
                ) : (
                  runs.map((run) => (
                    <tr
                      key={run.id}
                      onClick={() => setSelectedRunId(run.id)}
                      className={`cursor-pointer ${
                        selectedRunId === run.id ? "bg-amber-50/70" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="px-3 py-2 font-semibold text-slate-900">
                        {run.payroll_periods?.period_code} •{" "}
                        {labelOf(PAYROLL_RUN_TYPE_LABELS, run.run_type)} (v{run.run_version})
                      </td>
                      <td className="px-3 py-2 text-[11px] font-medium">
                        {labelOf(PAYROLL_STATUS_LABELS, run.status)}
                      </td>
                      <td className="px-3 py-2">{run.total_employees}</td>
                      <td className="px-3 py-2 font-mono font-semibold text-slate-900">
                        {fmtVnd(run.total_net_payable)}
                      </td>
                      <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                        {run.status === "CALCULATED" && (
                          <button
                            type="button"
                            onClick={() => handleTransition(run.id, "SUBMIT_ACCOUNTANT")}
                            className="rounded bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-white"
                          >
                            Trình Kế toán trưởng
                          </button>
                        )}
                        {run.status === "PENDING_ACCOUNTANT_REVIEW" && (
                          <button
                            type="button"
                            onClick={() => handleTransition(run.id, "ACCOUNTANT_REVIEW")}
                            className="inline-flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white"
                          >
                            <ShieldCheck className="h-3 w-3" />
                            Kế toán trưởng duyệt
                          </button>
                        )}
                        {run.status === "PENDING_DIRECTOR_APPROVAL" && (
                          <button
                            type="button"
                            onClick={() => handleTransition(run.id, "DIRECTOR_APPROVE")}
                            className="inline-flex items-center gap-1 rounded bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white"
                          >
                            <ShieldCheck className="h-3 w-3" />
                            Giám đốc duyệt chi
                          </button>
                        )}
                        {run.status === "APPROVED" && (
                          <button
                            type="button"
                            onClick={() => handleTransition(run.id, "LOCK")}
                            className="inline-flex items-center gap-1 rounded bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white"
                          >
                            <Lock className="h-3 w-3" />
                            Khóa kỳ
                          </button>
                        )}
                        {run.status === "LOCKED" && (
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleTransition(run.id, "MARK_PAID")}
                              className="rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white"
                            >
                              Xác nhận Đã chi CK
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTransition(run.id, "UNLOCK")}
                              className="rounded border border-rose-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                            >
                              Mở khóa
                            </button>
                          </div>
                        )}
                        {run.status === "PAID" && (
                          <span className="text-[11px] font-semibold text-emerald-700">
                            Đã phát hành Payslip
                          </span>
                        )}
                        {["APPROVED", "LOCKED", "PAID"].includes(run.status) && (
                          <div className="mt-1.5 flex justify-end gap-1.5">
                            <a
                              href={`/api/v1/payroll/runs/${run.id}/export?format=bank_csv`}
                              className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-50"
                            >
                              CSV Ngân hàng
                            </a>
                            <a
                              href={`/api/v1/payroll/runs/${run.id}/export?format=accounting_csv`}
                              className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-50"
                            >
                              CSV Cost Center
                            </a>
                            <a
                              href={`/api/v1/payroll/runs/${run.id}/export?format=ot_variance_csv`}
                              className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 hover:bg-amber-100"
                            >
                              CSV OT &amp; Biến động
                            </a>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Payroll Results Breakdown */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-900">
            Bảng lương Chi tiết Tổng hợp theo Nhân viên ({runResults.length})
          </h2>
          {runResults.length > 0 && (
            <button
              type="button"
              onClick={handleExportDetailedPayrollCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5 text-emerald-600" />
              Xuất Bảng lương Chi tiết (Excel/CSV)
            </button>
          )}
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 whitespace-nowrap">Nhân viên</th>
                <th className="px-2 py-2 text-center whitespace-nowrap">Ngày làm</th>
                <th className="px-2 py-2 text-center whitespace-nowrap">Phép hưởng lương</th>
                <th className="px-2 py-2 text-center whitespace-nowrap">Nghỉ K.Lương</th>
                <th className="px-2 py-2 text-center whitespace-nowrap">Phép năm còn</th>
                <th className="px-3 py-2 whitespace-nowrap">Lương CB HĐ</th>
                <th className="px-3 py-2 whitespace-nowrap">Phụ cấp &amp; Thưởng</th>
                <th className="px-3 py-2 whitespace-nowrap">Tổng Gross</th>
                <th className="px-3 py-2 whitespace-nowrap">BHXH (10.5%)</th>
                <th className="px-3 py-2 whitespace-nowrap">Thuế TNCN</th>
                <th className="px-3 py-2 whitespace-nowrap">Đoàn phí (1%)</th>
                <th className="px-3 py-2 whitespace-nowrap">Thực lĩnh tháng</th>
                <th className="px-3 py-2 whitespace-nowrap">Đã ứng Đợt 15</th>
                <th className="px-3 py-2 whitespace-nowrap">Chi trả đợt này</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {runResults.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-3 py-6 text-center text-slate-500">
                    Chọn một đợt chạy lương ở trên để xem chi tiết.
                  </td>
                </tr>
              ) : (
                runResults.map((res) => {
                  const att = res.attendance_leave_summary;
                  const stdDays = att?.standard_days ?? activePeriod?.standard_work_days ?? 22;
                  const workDays =
                    att?.actual_work_days ?? res.explanation_json?.workedDays ?? stdDays;
                  const paidLeave = att?.paid_leave_days ?? 0;
                  const unpaidLeave = att?.unpaid_leave_days ?? 0;
                  const remLeave = att?.remaining_annual_leave ?? 12;
                  const allowanceTotal = getAllowanceTotal(res);
                  const unionDues = Number(res.other_deductions ?? 0);
                  return (
                    <tr
                      key={res.id}
                      onClick={() => setSelectedPayslip(res)}
                      className="cursor-pointer transition hover:bg-amber-50/40"
                    >
                      <td className="px-3 py-2 font-medium text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-amber-600" />
                          <span>
                            {res.employees?.employee_code} — {res.employees?.full_name}
                          </span>
                          {res.explanation_json?.warnings?.map((w) => (
                            <span
                              key={w}
                              className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700"
                            >
                              {w === "BHXH_EXEMPT_MONTH"
                                ? "BHXH <14 công"
                                : w.startsWith("VARIANCE_OVER_20%")
                                  ? "Biến động >20%"
                                  : w}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center font-mono whitespace-nowrap">
                        {workDays}/{stdDays}
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-emerald-700">
                        {paidLeave}
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-rose-600">
                        {unpaidLeave}
                      </td>
                      <td className="px-2 py-2 text-center font-mono font-semibold text-blue-700">
                        {remLeave} ngày
                      </td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">
                        {fmtVnd(res.base_salary_snapshot)}
                      </td>
                      <td className="px-3 py-2 font-mono text-emerald-700 whitespace-nowrap">
                        +{fmtVnd(allowanceTotal)}
                      </td>
                      <td className="px-3 py-2 font-mono font-semibold whitespace-nowrap">
                        {fmtVnd(res.gross_income)}
                      </td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">
                        {fmtVnd(res.ee_insurance_total)}
                      </td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">
                        {fmtVnd(res.pit_amount)}
                      </td>
                      <td className="px-3 py-2 font-mono text-rose-700 whitespace-nowrap">
                        {fmtVnd(unionDues)}
                      </td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">
                        {fmtVnd(res.full_month_net)}
                      </td>
                      <td className="px-3 py-2 font-mono text-amber-700 whitespace-nowrap">
                        {fmtVnd(res.mid_month_advance_paid)}
                      </td>
                      <td className="px-3 py-2 font-mono font-bold text-emerald-700 whitespace-nowrap">
                        {fmtVnd(res.net_payable)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
      </div>

      {/* Payslip Detail Modal */}
      {selectedPayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs print:static print:block print:bg-transparent print:p-0">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl print:max-w-none print:rounded-none print:shadow-none">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                  Phiếu lương chi tiết • Thế Kỷ Vàng
                </div>
                <h3 className="mt-1 text-lg font-bold text-slate-900">
                  {selectedPayslip.employees?.employee_code} —{" "}
                  {selectedPayslip.employees?.full_name}
                </h3>
                <div className="text-xs text-slate-500">
                  Kỳ {activePeriod?.period_code ?? "—"} (Chốt công{" "}
                  {activePeriod?.cutoff_date ?? "—"})
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPayslip(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 print:hidden"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between py-1">
                <span className="text-slate-600">Ngày công chuẩn / Thực tế</span>
                <span className="font-mono font-semibold text-slate-900">
                  {selectedPayslip.attendance_leave_summary?.actual_work_days ??
                    selectedPayslip.explanation_json?.workedDays ??
                    activePeriod?.standard_work_days ??
                    22}{" "}
                  /{" "}
                  {selectedPayslip.attendance_leave_summary?.standard_days ??
                    selectedPayslip.explanation_json?.standardDays ??
                    activePeriod?.standard_work_days ??
                    22}{" "}
                  ngày
                </span>
              </div>
              <div className="flex justify-between py-1 text-[11px] text-slate-500">
                <span>Phép hưởng lương / Nghỉ K.lương / Phép năm còn</span>
                <span className="font-mono">
                  {selectedPayslip.attendance_leave_summary?.paid_leave_days ?? 0} ngày /{" "}
                  {selectedPayslip.attendance_leave_summary?.unpaid_leave_days ?? 0} ngày /{" "}
                  <strong className="text-blue-700">
                    {selectedPayslip.attendance_leave_summary?.remaining_annual_leave ?? 12} ngày
                  </strong>
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-600">Lương cơ bản hợp đồng</span>
                <span className="font-mono font-semibold text-slate-900">
                  {fmtVnd(selectedPayslip.base_salary_snapshot)}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-600">Mức lương làm căn cứ đóng BHXH</span>
                <span className="font-mono font-semibold text-slate-900">
                  {fmtVnd(
                    selectedPayslip.si_base_bhxh && selectedPayslip.si_base_bhxh > 0
                      ? selectedPayslip.si_base_bhxh
                      : selectedPayslip.base_salary_snapshot
                  )}
                </span>
              </div>
              {(() => {
                const allowanceItems = (selectedPayslip.payroll_items ?? []).filter(
                  (it) =>
                    it.component_code !== "BASE_SALARY_PRORATED" &&
                    it.component_code !== "MID_MONTH_ADVANCE_50" &&
                    Number(it.amount) > 0
                );
                const proratedBaseItem = (selectedPayslip.payroll_items ?? []).find(
                  (it) => it.component_code === "BASE_SALARY_PRORATED"
                );
                const extraDiff =
                  Number(selectedPayslip.gross_income) -
                  Number(selectedPayslip.base_salary_snapshot);
                if (allowanceItems.length === 0 && extraDiff <= 0) return null;
                return (
                  <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-2.5 space-y-1">
                    <div className="text-[11px] font-semibold text-amber-900">
                      Chi tiết thu nhập &amp; các khoản phụ cấp cộng vào Gross:
                    </div>
                    {proratedBaseItem && (
                      <div className="flex justify-between text-[11px] text-slate-700">
                        <span>• {formatAllowanceLabel(proratedBaseItem)}</span>
                        <span className="font-mono">{fmtVnd(proratedBaseItem.amount)}</span>
                      </div>
                    )}
                    {allowanceItems.length > 0 ? (
                      allowanceItems.map((it) => (
                        <div
                          key={it.id}
                          className="flex justify-between text-[11px] text-slate-700"
                        >
                          <span>
                            • (+) {formatAllowanceLabel(it)}
                            {Number(it.tax_exempt_amount) > 0 ? (
                              <span className="ml-1 text-[10px] text-emerald-700">
                                (Miễn thuế TNCN)
                              </span>
                            ) : null}
                          </span>
                          <span className="font-mono font-medium text-emerald-700">
                            +{fmtVnd(it.amount)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="flex justify-between text-[11px] text-slate-700">
                        <span>• (+) Phụ cấp &amp; thu nhập bổ sung theo kỳ</span>
                        <span className="font-mono font-medium text-emerald-700">
                          +{fmtVnd(extraDiff)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}
              <div className="flex justify-between border-t border-slate-100 pt-2">
                <span className="font-semibold text-slate-800">Tổng thu nhập Gross</span>
                <span className="font-mono font-bold text-slate-900">
                  {fmtVnd(selectedPayslip.gross_income)}
                </span>
              </div>
              <div className="flex justify-between py-1 text-rose-700">
                <span>(-) BHXH 8% + BHYT 1.5% + BHTN 1% (NLĐ 10.5%)</span>
                <span className="font-mono">
                  -{fmtVnd(selectedPayslip.ee_insurance_total)}
                </span>
              </div>
              <div className="flex justify-between py-1 text-slate-500">
                <span>Giảm trừ gia cảnh (Bản thân + NPT)</span>
                <span className="font-mono">
                  {fmtVnd(
                    (selectedPayslip.personal_deduction && selectedPayslip.personal_deduction > 0
                      ? selectedPayslip.personal_deduction
                      : 15500000) +
                      (selectedPayslip.dependent_deduction ?? 0)
                  )}
                </span>
              </div>
              <div className="flex justify-between py-1 text-rose-700">
                <span>(-) Thuế TNCN khấu trừ</span>
                <span className="font-mono">-{fmtVnd(selectedPayslip.pit_amount)}</span>
              </div>
              <div className="flex justify-between py-1 text-rose-700">
                <span>(-) Đoàn phí CĐ (1% BHXH • QĐ 1408/QĐ-TLĐ)</span>
                <span className="font-mono">
                  -{fmtVnd(Number(selectedPayslip.other_deductions ?? 0))}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold text-slate-900">
                <span>Thực lĩnh cả tháng</span>
                <span className="font-mono">{fmtVnd(selectedPayslip.full_month_net)}</span>
              </div>
              <div className="flex justify-between py-1 text-amber-700">
                <span>(-) Đã tạm ứng Đợt 1 (Ngày 15)</span>
                <span className="font-mono">
                  -{fmtVnd(selectedPayslip.mid_month_advance_paid)}
                </span>
              </div>
              <div className="flex justify-between rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
                <span>THỰC NHẬN ĐỢT NÀY (NET)</span>
                <span className="font-mono">{fmtVnd(selectedPayslip.net_payable)}</span>
              </div>
              <div className="mt-2 rounded-xl bg-slate-50 p-2.5 text-[11px] text-slate-600">
                <div className="flex justify-between">
                  <span>DN đóng BHXH/YT/TN (21.5%):</span>
                  <span className="font-mono font-semibold">
                    {fmtVnd(
                      selectedPayslip.er_insurance_total && selectedPayslip.er_insurance_total > 0
                        ? selectedPayslip.er_insurance_total
                        : Math.round(
                            (selectedPayslip.si_base_bhxh && selectedPayslip.si_base_bhxh > 0
                              ? selectedPayslip.si_base_bhxh
                              : selectedPayslip.base_salary_snapshot) * 0.215
                          )
                    )}
                  </span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span>Kinh phí Công đoàn DN đóng (2% quỹ lương BHXH):</span>
                  <span className="font-mono font-semibold">
                    {fmtVnd(
                      selectedPayslip.explanation_json?.unionFeeEr &&
                        selectedPayslip.explanation_json.unionFeeEr > 0
                        ? selectedPayslip.explanation_json.unionFeeEr
                        : Math.round(
                            (selectedPayslip.si_base_bhxh && selectedPayslip.si_base_bhxh > 0
                              ? selectedPayslip.si_base_bhxh
                              : selectedPayslip.base_salary_snapshot) * 0.02
                          )
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Printer className="h-3.5 w-3.5" />
                In phiếu lương
              </button>
              <button
                type="button"
                onClick={() => setSelectedPayslip(null)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

