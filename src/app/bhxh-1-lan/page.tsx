"use client";

import { useEffect, useState } from "react";
import { Calculator, Plus, Trash2, Printer, Info, Users } from "lucide-react";

interface ContributionPeriod {
  id: string;
  fromYm: string; // YYYY-MM
  toYm: string; // YYYY-MM
  salary: string;
  inflationFactor: string;
}

interface EmployeeOption {
  id: string;
  employee_code: string;
  full_name: string;
  hire_date: string;
  salary_info?: { base_salary: number; si_salary_base: number } | null;
}

function countMonthsSplit(fromYm: string, toYm: string) {
  if (!/^\d{4}-\d{2}$/.test(fromYm) || !/^\d{4}-\d{2}$/.test(toYm)) {
    return { total: 0, pre2014: 0, from2014: 0 };
  }
  const [fy, fm] = fromYm.split("-").map(Number);
  const [ty, tm] = toYm.split("-").map(Number);
  const startIdx = fy * 12 + (fm - 1);
  const endIdx = ty * 12 + (tm - 1);
  if (endIdx < startIdx) return { total: 0, pre2014: 0, from2014: 0 };

  const cutoff2014 = 2014 * 12; // Jan 2014
  let pre2014 = 0;
  let from2014 = 0;
  for (let m = startIdx; m <= endIdx; m++) {
    if (m < cutoff2014) pre2014 += 1;
    else from2014 += 1;
  }
  return { total: pre2014 + from2014, pre2014, from2014 };
}

function roundOddMonthsToYears(months: number): number {
  const fullYears = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return fullYears;
  if (rem <= 6) return fullYears + 0.5;
  return fullYears + 1;
}

const fmtVnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")} đ`;

export default function BhxhOneTimePage() {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [periods, setPeriods] = useState<ContributionPeriod[]>([
    {
      id: "p1",
      fromYm: "2023-01",
      toYm: "2026-11",
      salary: "15000000",
      inflationFactor: "1.00",
    },
  ]);

  useEffect(() => {
    let active = true;
    fetch("/api/v1/employees", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!active || !json?.data) return;
        setEmployees(json.data);
      })
      .catch(() => {
        // Optional employee autofill
      });
    return () => {
      active = false;
    };
  }, []);

  function handleSelectEmployee(empId: string) {
    setSelectedEmpId(empId);
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return;
    const fromYm = emp.hire_date ? emp.hire_date.slice(0, 7) : "2023-01";
    const siSal = emp.salary_info?.si_salary_base || emp.salary_info?.base_salary || 15000000;
    setPeriods([
      {
        id: "emp-1",
        fromYm,
        toYm: "2026-11",
        salary: String(siSal),
        inflationFactor: "1.00",
      },
    ]);
  }

  function addPeriod() {
    setPeriods((prev) => [
      ...prev,
      {
        id: `p-${Date.now()}`,
        fromYm: "2024-01",
        toYm: "2026-11",
        salary: "12000000",
        inflationFactor: "1.00",
      },
    ]);
  }

  function removePeriod(id: string) {
    setPeriods((prev) => (prev.length > 1 ? prev.filter((p) => p.id !== id) : prev));
  }

  function updatePeriod(id: string, field: keyof ContributionPeriod, value: string) {
    setPeriods((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  }

  // Calculation according to Vietnam Social Insurance Law
  let totalMonths = 0;
  let totalPre2014Months = 0;
  let totalFrom2014Months = 0;
  let weightedSalarySum = 0;

  for (const p of periods) {
    const split = countMonthsSplit(p.fromYm, p.toYm);
    const sal = Math.max(0, Number(p.salary) || 0);
    const factor = Math.max(0.1, Number(p.inflationFactor) || 1);
    totalMonths += split.total;
    totalPre2014Months += split.pre2014;
    totalFrom2014Months += split.from2014;
    weightedSalarySum += split.total * sal * factor;
  }

  const mbqtl = totalMonths > 0 ? weightedSalarySum / totalMonths : 0;

  let yearsPre2014 = 0;
  let yearsFrom2014 = 0;
  let totalBenefit = 0;

  if (totalMonths > 0 && totalMonths < 12) {
    totalBenefit = Math.min(0.22 * weightedSalarySum, 2 * mbqtl);
  } else if (totalMonths >= 12) {
    // Odd months before 2014 carry over to 2014+ period per statutory rule
    yearsPre2014 = Math.floor(totalPre2014Months / 12);
    const oddPre = totalPre2014Months % 12;
    yearsFrom2014 = roundOddMonthsToYears(totalFrom2014Months + oddPre);
    totalBenefit = 1.5 * mbqtl * yearsPre2014 + 2.0 * mbqtl * yearsFrom2014;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Calculator className="h-5 w-5 text-amber-600" />
            Công cụ Tính Lãnh Bảo hiểm Xã hội 1 Lần
          </h1>
          <p className="text-sm text-slate-600">
            Dự tính mức hưởng BHXH 1 lần khi nhân viên nghỉ việc theo Luật BHXH Việt Nam (Điều 60).
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Printer className="h-3.5 w-3.5" />
          In phiếu dự tính
        </button>
      </div>

      {/* Autofill from Employee */}
      {employees.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
              <Users className="h-4 w-4 text-amber-600" />
              Lấy nhanh dữ liệu đóng BHXH từ hồ sơ nhân viên:
            </div>
            <select
              value={selectedEmpId}
              onChange={(e) => handleSelectEmployee(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium sm:w-80"
            >
              <option value="">-- Nhập thủ công hoặc chọn nhân viên --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.employee_code} — {emp.full_name} (Vào làm {emp.hire_date})
                </option>
              ))}
            </select>
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Contribution Periods Input */}
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">
              Quá trình đóng BHXH theo từng giai đoạn
            </h2>
            <button
              type="button"
              onClick={addPeriod}
              className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Thêm giai đoạn
            </button>
          </div>

          <div className="space-y-3">
            {periods.map((p, idx) => {
              const split = countMonthsSplit(p.fromYm, p.toYm);
              return (
                <div
                  key={p.id}
                  className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs sm:grid-cols-5"
                >
                  <div>
                    <label className="font-medium text-slate-700">Từ tháng (YYYY-MM)</label>
                    <input
                      type="month"
                      value={p.fromYm}
                      onChange={(e) => updatePeriod(p.id, "fromYm", e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-slate-700">Đến tháng (YYYY-MM)</label>
                    <input
                      type="month"
                      value={p.toYm}
                      onChange={(e) => updatePeriod(p.id, "toYm", e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-slate-700">Lương đóng BHXH (đ)</label>
                    <input
                      type="number"
                      min={0}
                      step={100000}
                      value={p.salary}
                      onChange={(e) => updatePeriod(p.id, "salary", e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-slate-700">Hệ số trượt giá</label>
                    <input
                      type="number"
                      min={0.5}
                      max={5}
                      step={0.01}
                      value={p.inflationFactor}
                      onChange={(e) =>
                        updatePeriod(p.id, "inflationFactor", e.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-mono"
                    />
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <div className="text-[10px] text-slate-500">GĐ #{idx + 1}</div>
                      <div className="font-mono font-bold text-slate-800">
                        {split.total} tháng
                      </div>
                    </div>
                    {periods.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePeriod(p.id)}
                        className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                        title="Xóa giai đoạn"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3.5 text-xs text-sky-900">
            <div className="flex items-center gap-1.5 font-semibold">
              <Info className="h-4 w-4 text-sky-600" />
              Quy tắc tính theo Luật BHXH Việt Nam
            </div>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[11px] text-sky-800">
              <li>
                Mức hưởng mỗi năm trước 2014 = <strong>1,5 tháng</strong> mức bình quân tiền lương đóng BHXH.
              </li>
              <li>
                Mức hưởng mỗi năm từ 2014 trở đi = <strong>2,0 tháng</strong> mức bình quân tiền lương đóng BHXH.
              </li>
              <li>
                Làm tròn tháng lẻ: từ 1–6 tháng tính <strong>0,5 năm</strong>; từ 7–11 tháng tính <strong>1 năm</strong>.
              </li>
              <li>
                Đóng dưới 12 tháng: hưởng <strong>22%</strong> tổng mức lương đã đóng (tối đa 2 tháng bình quân).
              </li>
            </ul>
          </div>
        </section>

        {/* Calculation Result Summary */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900">Kết quả Dự tính BHXH 1 Lần</h2>

          <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 p-4 text-white">
            <div className="text-xs text-emerald-100">Tổng tiền BHXH 1 lần dự kiến nhận</div>
            <div className="mt-1 font-mono text-2xl font-extrabold">
              {fmtVnd(totalBenefit)}
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between border-b border-slate-100 py-1.5">
              <span className="text-slate-600">Tổng thời gian đóng BHXH</span>
              <span className="font-mono font-bold text-slate-900">{totalMonths} tháng</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 py-1.5">
              <span className="text-slate-600">Số năm tính trước 2014 (×1,5)</span>
              <span className="font-mono font-semibold text-slate-900">{yearsPre2014} năm</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 py-1.5">
              <span className="text-slate-600">Số năm tính từ 2014 (×2,0)</span>
              <span className="font-mono font-semibold text-slate-900">{yearsFrom2014} năm</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-600">Lương bình quân đóng BHXH (Mbqtl)</span>
              <span className="font-mono font-bold text-amber-700">{fmtVnd(mbqtl)}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

