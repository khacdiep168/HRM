"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Utensils, AlertCircle, Sparkles, PlusCircle, Trash2, Upload, Download, Users } from "lucide-react";
import { buildUtf8BomCsv, parseCsvText } from "@/lib/integrations/csv-helper";

interface AllowancesPayload {
  components: Array<{
    id: string;
    code: string;
    name: string;
    category: string;
    calc_mode: string;
    is_taxable: boolean;
    tax_exempt_cap: number;
  }>;
  departmentPolicies: Array<{
    id: string;
    default_amount: number;
    calc_mode: string;
    departments: { code: string; name: string } | null;
    salary_components: { code: string; name: string } | null;
  }>;
  employeeOverrides: Array<{
    id: string;
    override_amount: number;
    calc_mode: string;
    reason: string;
    employees: { employee_code: string; full_name: string } | null;
    salary_components: { code: string; name: string } | null;
  }>;
  periodVariables: Array<{
    id: string;
    amount: number;
    quantity: number;
    note: string | null;
    employees: { employee_code: string; full_name: string } | null;
    salary_components: { code: string; name: string } | null;
    payroll_periods: { period_code: string } | null;
  }>;
  departments: Array<{ id: string; code: string; name: string }>;
  employees: Array<{ id: string; employee_code: string; full_name: string }>;
  periods: Array<{ id: string; period_code: string }>;
}

const fmtVnd = (n: number) => `${Number(n).toLocaleString("vi-VN")} đ`;

const CALC_MODE_LABELS: Record<string, string> = {
  PER_WORKDAY: "Nhân ngày công thực tế",
  FIXED_MONTHLY: "Cố định hàng tháng",
  VARIABLE_INPUT: "Nhập biến động theo kỳ",
};

export default function AllowancesPage() {
  const [data, setData] = useState<AllowancesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  const [tier, setTier] = useState<"DEPARTMENT_POLICY" | "EMPLOYEE_OVERRIDE" | "PERIOD_VARIABLE">(
    "PERIOD_VARIABLE"
  );
  const [departmentId, setDepartmentId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [payrollPeriodId, setPayrollPeriodId] = useState("");
  const [salaryComponentId, setSalaryComponentId] = useState("");
  const [amount, setAmount] = useState("5000000");
  const [calcMode, setCalcMode] = useState<"PER_WORKDAY" | "FIXED_MONTHLY" | "VARIABLE_INPUT">(
    "FIXED_MONTHLY"
  );
  const [reasonOrNote, setReasonOrNote] = useState("");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  // Auto year-end bonus & seniority
  const [autoMode, setAutoMode] = useState<"BONUS_13" | "BONUS_14" | "SENIORITY">("BONUS_13");
  const [autoPeriodId, setAutoPeriodId] = useState("");
  const [seniorityPerYear, setSeniorityPerYear] = useState("300000");

  // Custom component creator
  const [showNewComp, setShowNewComp] = useState(false);
  const [newCompCode, setNewCompCode] = useState("");
  const [newCompName, setNewCompName] = useState("");
  const [newCompCategory, setNewCompCategory] = useState<"ALLOWANCE" | "BONUS">("BONUS");
  const [newCompTaxable, setNewCompTaxable] = useState(true);

  // Bulk rule & CSV import for 1000+ employees
  const [bulkDeptId, setBulkDeptId] = useState("ALL");
  const [bulkCompId, setBulkCompId] = useState("");
  const [bulkPeriodId, setBulkPeriodId] = useState("");
  const [bulkFormula, setBulkFormula] = useState<"FIXED_AMOUNT" | "PERCENT_OF_BASE_SALARY">(
    "PERCENT_OF_BASE_SALARY"
  );
  const [bulkValue, setBulkValue] = useState("10");

  useEffect(() => {
    let active = true;
    fetch("/api/v1/payroll/allowances", { cache: "no-store" })
      .then(async (res) => {
        if (!active) return;
        const json = await res.json();
        if (!res.ok) {
          setError(json.error?.message ?? "Không thể tải cấu hình phụ cấp & thưởng.");
          return;
        }
        const payload = json.data as AllowancesPayload;
        setError(null);
        setData(payload);
        setSalaryComponentId((p) => p || payload.components[0]?.id || "");
        setDepartmentId((p) => p || payload.departments[0]?.id || "");
        setEmployeeId((p) => p || payload.employees[0]?.id || "");
        setPayrollPeriodId((p) => p || payload.periods[0]?.id || "");
        setAutoPeriodId((p) => p || payload.periods[0]?.id || "");
        setBulkCompId((p) => p || payload.components[0]?.id || "");
        setBulkPeriodId((p) => p || payload.periods[0]?.id || "");
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

  async function handleSaveRule(e: React.FormEvent) {
    e.preventDefault();
    setSaveMsg(null);
    setSaveErr(null);
    setBusy(true);
    try {
      const payload =
        tier === "DEPARTMENT_POLICY"
          ? {
              tier,
              departmentId,
              salaryComponentId,
              defaultAmount: Number(amount),
              calcMode,
            }
          : tier === "EMPLOYEE_OVERRIDE"
            ? {
                tier,
                employeeId,
                salaryComponentId,
                overrideAmount: Number(amount),
                calcMode,
                reason: reasonOrNote || "Điều chỉnh định mức theo vị trí / thâm niên",
              }
            : {
                tier,
                payrollPeriodId,
                employeeId,
                salaryComponentId,
                amount: Number(amount),
                quantity: 1,
                note: reasonOrNote || undefined,
              };

      const res = await fetch("/api/v1/payroll/allowances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveErr(json.error?.message ?? "Không thể lưu cấu hình phụ cấp / thưởng.");
        return;
      }
      setSaveMsg("Đã lưu khoản phụ cấp / thưởng và đồng bộ vào động cơ tính lương.");
      setReasonOrNote("");
      setReloadTick((t) => t + 1);
    } finally {
      setBusy(false);
    }
  }

  async function handleAutoYearEnd() {
    setSaveMsg(null);
    setSaveErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/v1/payroll/allowances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: "AUTO_YEAR_END",
          mode: autoMode,
          payrollPeriodId: autoMode === "SENIORITY" ? undefined : autoPeriodId,
          seniorityPerYear: Number(seniorityPerYear || 300000),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveErr(json.error?.message ?? "Không thể tính tự động khoản thưởng / thâm niên.");
        return;
      }
      setSaveMsg(
        `Đã tự động tính & ghi nhận "${json.data.componentName}" cho ${json.data.appliedCount} nhân viên.`
      );
      setReloadTick((t) => t + 1);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateComponent(e: React.FormEvent) {
    e.preventDefault();
    setSaveMsg(null);
    setSaveErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/v1/payroll/allowances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: "COMPONENT",
          code: newCompCode,
          name: newCompName,
          category: newCompCategory,
          calcMode: newCompCategory === "BONUS" ? "VARIABLE_INPUT" : "FIXED_MONTHLY",
          isTaxable: newCompTaxable,
          taxExemptCap: 0,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveErr(json.error?.message ?? "Không thể tạo khoản mục mới.");
        return;
      }
      setSaveMsg(`Đã thêm khoản mục "${json.data.name}" vào danh mục công ty.`);
      setSalaryComponentId(json.data.id);
      setNewCompCode("");
      setNewCompName("");
      setShowNewComp(false);
      setReloadTick((t) => t + 1);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteEntry(
    entryTier: "DEPARTMENT_POLICY" | "EMPLOYEE_OVERRIDE" | "PERIOD_VARIABLE",
    id: string
  ) {
    setSaveMsg(null);
    setSaveErr(null);
    const res = await fetch(`/api/v1/payroll/allowances?tier=${entryTier}&id=${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setSaveErr("Không thể xóa bản ghi.");
      return;
    }
    setSaveMsg("Đã xóa bản ghi cấu hình.");
    setReloadTick((t) => t + 1);
  }

  async function handleBulkRuleApply() {
    setSaveMsg(null);
    setSaveErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/v1/payroll/allowances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: "BULK_RULE",
          payrollPeriodId: bulkPeriodId,
          salaryComponentId: bulkCompId,
          departmentId: bulkDeptId,
          formulaType: bulkFormula,
          value: Number(bulkValue),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveErr(json.error?.message ?? "Không thể áp dụng quy tắc hàng loạt.");
        return;
      }
      setSaveMsg(`Đã áp dụng hàng loạt cho ${json.data.appliedCount} nhân viên.`);
      setReloadTick((t) => t + 1);
    } finally {
      setBusy(false);
    }
  }

  function handleDownloadCsvTemplate() {
    const sampleRows = (data?.employees ?? []).slice(0, 3).map((e) => [
      e.employee_code,
      5000000,
      "Thưởng / Hoa hồng theo kỳ",
    ]);
    const csv = buildUtf8BomCsv(
      ["employee_code", "amount", "note"],
      sampleRows.length > 0
        ? sampleRows
        : [["TKV-0001", 5000000, "Thưởng T13 / Hoa hồng kinh doanh"]]
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mau_import_thuong_phu_cap.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleBulkCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaveMsg(null);
    setSaveErr(null);
    setBusy(true);
    try {
      const text = await file.text();
      const parsed = parseCsvText(text);
      const items = parsed
        .map((row) => ({
          employeeCode: row.employee_code || row.ma_nv || "",
          amount: Number((row.amount || row.so_tien || "0").replace(/[^\d.-]/g, "")),
          note: row.note || row.ghi_chu || undefined,
        }))
        .filter((x) => x.employeeCode && !Number.isNaN(x.amount));

      if (items.length === 0) {
        setSaveErr("File CSV không có dòng hợp lệ (cần cột employee_code, amount).");
        return;
      }

      const res = await fetch("/api/v1/payroll/allowances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: "BULK_CSV_PERIOD",
          payrollPeriodId: bulkPeriodId,
          salaryComponentId: bulkCompId,
          items,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveErr(json.error?.message ?? "Import CSV thất bại.");
        return;
      }
      setSaveMsg(
        `Đã import thành công ${json.data.appliedCount} nhân viên từ CSV (bỏ qua ${json.data.skipped} mã không khớp).`
      );
      setReloadTick((t) => t + 1);
    } finally {
      e.target.value = "";
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-slate-500">
        Đang tải danh mục phụ cấp, thưởng &amp; hoa hồng...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle className="h-5 w-5" />
          Chưa thể truy cập Cấu hình Phụ cấp &amp; Thưởng
        </div>
        <p className="mt-2 text-xs text-amber-800">{error}</p>
        <Link
          href="/login"
          className="mt-4 inline-block rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white"
        >
          Đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Utensils className="h-5 w-5 text-amber-600" />
            Phụ cấp, Thưởng Cuối năm (T13/T14), Thâm niên &amp; Hoa hồng Kinh doanh
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            Cấu hình chuẩn kế toán 3 tầng: <strong>Tầng 1 (Bộ phận hàng tháng)</strong> •{" "}
            <strong>Tầng 2 (Cá nhân: Thâm niên, Trách nhiệm)</strong> •{" "}
            <strong>Tầng 3 (Biến động kỳ: Thưởng T13, T14, Tết, KPI, Hoa hồng KD)</strong>. Mọi
            khoản nhập tại đây sẽ tự động cộng vào Gross &amp; quyết toán Thuế TNCN khi chạy Bảng
            lương.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewComp((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
        >
          <PlusCircle className="h-4 w-4 text-amber-600" />
          Tạo Khoản mục Lương/Thưởng mới
        </button>
      </div>

      {/* Custom Component Creator */}
      {showNewComp && (
        <form
          onSubmit={handleCreateComponent}
          className="grid gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-xs sm:grid-cols-5"
        >
          <div>
            <label className="block font-semibold text-slate-700">Mã khoản mục</label>
            <input
              required
              value={newCompCode}
              onChange={(e) => setNewCompCode(e.target.value)}
              placeholder="VD: PROJECT_BONUS"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono uppercase"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700">Tên hiển thị trên Phiếu lương</label>
            <input
              required
              value={newCompName}
              onChange={(e) => setNewCompName(e.target.value)}
              placeholder="VD: Thưởng hoàn thành dự án Q4"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700">Nhóm &amp; Thuế TNCN</label>
            <div className="mt-1 flex gap-2">
              <select
                value={newCompCategory}
                onChange={(e) => setNewCompCategory(e.target.value as "ALLOWANCE" | "BONUS")}
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5"
              >
                <option value="BONUS">Khoản thưởng</option>
                <option value="ALLOWANCE">Phụ cấp</option>
              </select>
              <label className="flex shrink-0 items-center gap-1 text-[11px] text-slate-700">
                <input
                  type="checkbox"
                  checked={newCompTaxable}
                  onChange={(e) => setNewCompTaxable(e.target.checked)}
                />
                Chịu thuế
              </label>
            </div>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-amber-600 px-3 py-2 font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              Lưu Khoản mục
            </button>
          </div>
        </form>
      )}

      {/* Year-end & Seniority Auto-Calculator */}
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-emerald-950">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              Công cụ Tự động tính Thưởng Tháng 13, Tháng 14 &amp; Phụ cấp Thâm niên cho toàn công ty
            </h2>
            <p className="text-[11px] text-emerald-800">
              Thưởng T13/T14 tự động tính theo <strong>Lương cơ bản × (Số tháng làm việc / 12)</strong>.
              Phụ cấp thâm niên tự động tính theo <strong>Số năm công tác từ Ngày vào làm</strong>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={autoMode}
              onChange={(e) => setAutoMode(e.target.value as typeof autoMode)}
              className="rounded-lg border border-emerald-300 bg-white px-2.5 py-2 font-medium text-slate-900"
            >
              <option value="BONUS_13">Thưởng Lương Tháng 13 (Theo kỳ)</option>
              <option value="BONUS_14">Thưởng Lương Tháng 14 / Tết (Theo kỳ)</option>
              <option value="SENIORITY">Phụ cấp Thâm niên (Hàng tháng)</option>
            </select>
            {autoMode === "SENIORITY" ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-emerald-900">Mức/năm:</span>
                <input
                  type="number"
                  min={0}
                  step={50000}
                  value={seniorityPerYear}
                  onChange={(e) => setSeniorityPerYear(e.target.value)}
                  className="w-28 rounded-lg border border-emerald-300 bg-white px-2 py-2 font-mono"
                />
              </div>
            ) : (
              <select
                value={autoPeriodId}
                onChange={(e) => setAutoPeriodId(e.target.value)}
                className="rounded-lg border border-emerald-300 bg-white px-2.5 py-2 text-slate-900"
              >
                {data.periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    Kỳ {p.period_code}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={handleAutoYearEnd}
              className="rounded-lg bg-emerald-600 px-3.5 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Tự động tính &amp; Ghi nhận
            </button>
          </div>
        </div>
      </section>

      {/* Bulk Rule Apply & CSV Import for 1,000+ Employees */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
              <Users className="h-4 w-4 text-amber-600" />
              Áp dụng Hàng loạt theo Bộ phận / % Lương hoặc Import Excel/CSV (Quy mô 1.000+ NV)
            </h2>
            <p className="text-[11px] text-slate-500">
              Không cần nhập tay từng người: áp dụng đồng loạt theo % Lương cơ bản / mức cố định,
              hoặc tải lên file CSV danh sách thưởng/hoa hồng từ Kế toán.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={handleDownloadCsvTemplate}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5" />
              Tải file mẫu CSV
            </button>
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 font-semibold text-white hover:bg-slate-800">
              <Upload className="h-3.5 w-3.5" />
              Import CSV Hàng loạt
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleBulkCsvUpload}
                disabled={busy}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-6">
          <select
            value={bulkPeriodId}
            onChange={(e) => setBulkPeriodId(e.target.value)}
            className="rounded-lg border border-slate-300 px-2.5 py-2"
          >
            {data.periods.map((p) => (
              <option key={p.id} value={p.id}>
                Kỳ {p.period_code}
              </option>
            ))}
          </select>
          <select
            value={bulkCompId}
            onChange={(e) => setBulkCompId(e.target.value)}
            className="rounded-lg border border-slate-300 px-2.5 py-2"
          >
            {data.components.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={bulkDeptId}
            onChange={(e) => setBulkDeptId(e.target.value)}
            className="rounded-lg border border-slate-300 px-2.5 py-2"
          >
            <option value="ALL">Tất cả bộ phận</option>
            {data.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} — {d.name}
              </option>
            ))}
          </select>
          <select
            value={bulkFormula}
            onChange={(e) => setBulkFormula(e.target.value as typeof bulkFormula)}
            className="rounded-lg border border-slate-300 px-2.5 py-2"
          >
            <option value="PERCENT_OF_BASE_SALARY">% Lương cơ bản</option>
            <option value="FIXED_AMOUNT">Số tiền cố định (VNĐ)</option>
          </select>
          <input
            type="number"
            min={1}
            value={bulkValue}
            onChange={(e) => setBulkValue(e.target.value)}
            placeholder={bulkFormula === "PERCENT_OF_BASE_SALARY" ? "VD: 10 (%)" : "VD: 2000000"}
            className="rounded-lg border border-slate-300 px-2.5 py-2 font-mono"
          />
          <button
            type="button"
            disabled={busy || !bulkPeriodId || !bulkCompId}
            onClick={handleBulkRuleApply}
            className="rounded-lg bg-amber-600 px-3 py-2 font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            Áp dụng Hàng loạt
          </button>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Form Add Rule */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Nhập Phụ cấp, Thưởng &amp; Hoa hồng</h2>
          {saveErr && (
            <div className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-700">{saveErr}</div>
          )}
          {saveMsg && (
            <div className="mt-3 rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-800">{saveMsg}</div>
          )}

          <form onSubmit={handleSaveRule} className="mt-4 space-y-3 text-xs">
            <div>
              <label className="block font-medium text-slate-700">Tầng áp dụng</label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as typeof tier)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2"
              >
                <option value="PERIOD_VARIABLE">
                  Tầng 3 — Thưởng T13/T14, KPI, Hoa hồng KD (Theo Kỳ)
                </option>
                <option value="EMPLOYEE_OVERRIDE">
                  Tầng 2 — Thâm niên, Trách nhiệm, PC riêng (Cá nhân)
                </option>
                <option value="DEPARTMENT_POLICY">
                  Tầng 1 — Tiền ăn, Xăng xe, PC Kinh doanh (Bộ phận)
                </option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700">Khoản Phụ cấp / Thưởng</label>
              <select
                value={salaryComponentId}
                onChange={(e) => setSalaryComponentId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2"
              >
                {data.components.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            {tier === "DEPARTMENT_POLICY" && (
              <div>
                <label className="block font-medium text-slate-700">Bộ phận</label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2"
                >
                  {data.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} — {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(tier === "EMPLOYEE_OVERRIDE" || tier === "PERIOD_VARIABLE") && (
              <div>
                <label className="block font-medium text-slate-700">Nhân viên</label>
                <select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2"
                >
                  {data.employees.length === 0 ? (
                    <option value="">Chưa có nhân viên</option>
                  ) : (
                    data.employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.employee_code} — {emp.full_name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            {tier === "PERIOD_VARIABLE" && (
              <div>
                <label className="block font-medium text-slate-700">Kỳ lương chi trả</label>
                <select
                  value={payrollPeriodId}
                  onChange={(e) => setPayrollPeriodId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2"
                >
                  {data.periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.period_code}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-medium text-slate-700">Số tiền (VNĐ)</label>
                <input
                  type="number"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono"
                />
              </div>
              {tier !== "PERIOD_VARIABLE" && (
                <div>
                  <label className="block font-medium text-slate-700">Cách tính</label>
                  <select
                    value={calcMode}
                    onChange={(e) => setCalcMode(e.target.value as typeof calcMode)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5"
                  >
                    <option value="FIXED_MONTHLY">Cố định tháng</option>
                    <option value="PER_WORKDAY">Nhân ngày công</option>
                  </select>
                </div>
              )}
            </div>

            {tier !== "DEPARTMENT_POLICY" && (
              <div>
                <label className="block font-medium text-slate-700">Lý do / Ghi chú</label>
                <input
                  value={reasonOrNote}
                  onChange={(e) => setReasonOrNote(e.target.value)}
                  placeholder="VD: Thưởng T14 năm 2026 / Hoa hồng Q4"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Lưu vào Bảng lương
            </button>
          </form>
        </section>

        {/* Active Tiers Display */}
        <section className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">
              Tầng 1: Chính sách Phụ cấp Theo Bộ phận ({data.departmentPolicies.length})
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Bộ phận</th>
                    <th className="px-3 py-2">Khoản mục</th>
                    <th className="px-3 py-2">Đơn giá</th>
                    <th className="px-3 py-2">Cách tính</th>
                    <th className="px-3 py-2 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.departmentPolicies.map((pol) => (
                    <tr key={pol.id}>
                      <td className="px-3 py-2 font-medium text-slate-900">
                        {pol.departments?.name ?? "—"}
                      </td>
                      <td className="px-3 py-2">{pol.salary_components?.name ?? "—"}</td>
                      <td className="px-3 py-2 font-mono font-semibold text-slate-900">
                        {fmtVnd(pol.default_amount)}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {CALC_MODE_LABELS[pol.calc_mode] ?? pol.calc_mode}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteEntry("DEPARTMENT_POLICY", pol.id)}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3 w-3" />
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">
              Tầng 2 (Cá nhân: Thâm niên / Trách nhiệm: {data.employeeOverrides.length}) &amp; Tầng 3
              (Thưởng T13/T14 / Hoa hồng theo Kỳ: {data.periodVariables.length})
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 text-xs">
              {data.employeeOverrides.map((ov) => (
                <div key={ov.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-slate-900">
                      [Tầng 2] {ov.employees?.employee_code} — {ov.employees?.full_name}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteEntry("EMPLOYEE_OVERRIDE", ov.id)}
                      className="text-rose-600 hover:text-rose-800"
                      title="Xóa"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="text-slate-700">
                    {ov.salary_components?.name}: <strong>{fmtVnd(ov.override_amount)}</strong> (
                    {CALC_MODE_LABELS[ov.calc_mode] ?? ov.calc_mode})
                  </div>
                  <div className="text-[11px] text-slate-500">Lý do: {ov.reason}</div>
                </div>
              ))}
              {data.periodVariables.map((pv) => (
                <div key={pv.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-amber-950">
                      [Tầng 3 • {pv.payroll_periods?.period_code}] {pv.employees?.employee_code} —{" "}
                      {pv.employees?.full_name}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteEntry("PERIOD_VARIABLE", pv.id)}
                      className="text-rose-600 hover:text-rose-800"
                      title="Xóa"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="text-amber-900">
                    {pv.salary_components?.name}: <strong>{fmtVnd(pv.amount)}</strong> × {pv.quantity}
                  </div>
                  {pv.note && <div className="text-[11px] text-amber-800">{pv.note}</div>}
                </div>
              ))}
              {data.employeeOverrides.length === 0 && data.periodVariables.length === 0 && (
                <div className="col-span-2 py-4 text-center text-slate-500">
                  Chưa có bản ghi ghi đè cá nhân (Tầng 2) hoặc thưởng/hoa hồng theo kỳ (Tầng 3).
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
