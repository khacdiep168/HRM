"use client";

import { useEffect, useState } from "react";
import {
  Download,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { buildUtf8BomCsv } from "@/lib/integrations/csv-helper";

interface DayColumn {
  dayNumber: number;
  dayNumberStr: string;
  dayOfWeek: "CN" | "T2" | "T3" | "T4" | "T5" | "T6" | "T7";
  dateStr: string;
  isWeekend: boolean;
  isSunday: boolean;
  isToday: boolean;
  isHoliday: boolean;
  holidayName?: string;
}

interface AttendanceCell {
  symbol: "X" | "1/2" | "CT" | "TS" | "P" | "O" | "KP" | "?" | "" | "LE";
  otHours: number;
  workedHours: number;
  isException: boolean;
  exceptionType?: string;
  note?: string;
}

interface EmployeeMatrixRow {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  departmentName: string;
  shiftCode: string;
  days: Record<string, AttendanceCell>;
}

export function DetailedTimesheetMatrix() {
  const [year, setYear] = useState<number>(2026);
  const [month, setMonth] = useState<number>(11);
  const [days, setDays] = useState<DayColumn[]>([]);
  const [rows, setRows] = useState<EmployeeMatrixRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Edit cell modal state
  const [editingCell, setEditingCell] = useState<{
    employeeId: string;
    employeeName: string;
    employeeCode: string;
    workDate: string;
    cell: AttendanceCell;
  } | null>(null);

  const [editSymbol, setEditSymbol] = useState<string>("X");
  const [editOtHours, setEditOtHours] = useState<number>(0);
  const [editNote, setEditNote] = useState<string>("");
  const [savingCell, setSavingCell] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let active = true;
    fetch(`/api/v1/attendance/matrix?year=${year}&month=${month}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!active) return;
        const json = await res.json();
        if (!res.ok) {
          setError(json.error?.message ?? "Không thể tải bảng chấm công chi tiết.");
          return;
        }
        setDays(json.data.days ?? []);
        setRows(json.data.rows ?? []);
      })
      .catch(() => {
        if (active) setError("Lỗi kết nối khi tải bảng chấm công chi tiết.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [year, month, reloadTick]);

  function handleOpenEdit(emp: EmployeeMatrixRow, day: DayColumn) {
    const c = emp.days[day.dateStr] || {
      symbol: "",
      otHours: 0,
      workedHours: 0,
      isException: false,
    };
    setEditingCell({
      employeeId: emp.employeeId,
      employeeName: emp.fullName,
      employeeCode: emp.employeeCode,
      workDate: day.dateStr,
      cell: c,
    });
    setEditSymbol(c.symbol || "X");
    setEditOtHours(c.otHours || 0);
    setEditNote(c.note || "");
  }

  async function handleSaveCell(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCell) return;
    setSavingCell(true);
    try {
      const res = await fetch("/api/v1/attendance/matrix", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: editingCell.employeeId,
          workDate: editingCell.workDate,
          symbol: editSymbol,
          otHours: Number(editOtHours),
          note: editNote,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Không thể lưu cập nhật.");
        return;
      }
      // Update local state
      setRows((prev) =>
        prev.map((r) => {
          if (r.employeeId !== editingCell.employeeId) return r;
          return {
            ...r,
            days: {
              ...r.days,
              [editingCell.workDate]: {
                symbol: editSymbol as AttendanceCell["symbol"],
                otHours: Number(editOtHours),
                workedHours: editSymbol === "X" ? 8 : editSymbol === "1/2" ? 4 : 0,
                isException: editSymbol === "?",
                note: editNote,
              },
            },
          };
        })
      );
      setEditingCell(null);
      setReloadTick((t) => t + 1);
      setMsg(`Đã cập nhật công ngày ${editingCell.workDate} cho ${editingCell.employeeName}.`);
    } catch {
      setError("Lỗi khi lưu cập nhật chấm công.");
    } finally {
      setSavingCell(false);
    }
  }

  function handleExportCsv() {
    const headerRow = [
      "Mã NV",
      "Họ và tên",
      "Phòng ban",
      ...days.map((d) => `${d.dayNumberStr}/${String(month).padStart(2, "0")} (${d.dayOfWeek})`),
      "Tổng ngày công",
      "Tổng giờ tăng ca",
    ];

    const dataRows = rows.map((emp) => {
      let totalWorkDays = 0;
      let totalOtHours = 0;

      const dayCells = days.map((d) => {
        const c = emp.days[d.dateStr];
        if (!c || !c.symbol) return "";
        if (c.symbol === "X") totalWorkDays += 1;
        else if (c.symbol === "1/2") totalWorkDays += 0.5;
        if (c.otHours > 0) totalOtHours += c.otHours;

        return c.otHours > 0 ? `${c.symbol} (+${c.otHours}h OT)` : c.symbol;
      });

      return [
        emp.employeeCode,
        emp.fullName,
        emp.departmentName,
        ...dayCells,
        totalWorkDays.toFixed(1),
        totalOtHours.toFixed(1),
      ];
    });

    const csvContent = buildUtf8BomCsv(headerRow, dataRows);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `bang_cham_cong_chi_tiet_${month}_${year}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handlePrevMonth() {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function handleNextMonth() {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Header matching Screenshot 3 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-emerald-100 px-2.5 py-1 font-medium text-emerald-800">
            Dữ liệu thực tế · CÔNG TY TNHH THƯƠNG MẠI THẾ KỶ VÀNG
          </span>
          <span className="rounded bg-slate-100 px-2.5 py-1 text-slate-700">
            Đơn vị: Tổng các công ty · Cơ cấu {rows.length} nhân sự
          </span>
        </div>

        {/* Month selector */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="rounded-lg border border-slate-200 bg-white p-1 hover:bg-slate-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="font-bold text-slate-900">
            Tháng {month < 10 ? `0${month}` : month}/{year}
          </span>
          <button
            onClick={handleNextMonth}
            className="rounded-lg border border-slate-200 bg-white p-1 hover:bg-slate-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Title & Actions */}
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Bảng chấm công chi tiết theo ngày
          </h2>
          <p className="text-xs text-slate-500">
            Theo dõi chi tiết điểm danh, tăng ca và các ngoại lệ từng ngày trong tháng
          </p>
        </div>
        <div>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            Xuất bảng công
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {msg && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          {msg}
        </div>
      )}

      {/* Matrix Table */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto max-h-[600px]">
            <table className="min-w-full border-collapse text-xs">
              <thead className="sticky top-0 z-20 bg-slate-50 font-semibold text-slate-600 shadow-xs">
                <tr>
                  {/* Sticky first column: Nhân sự */}
                  <th className="sticky left-0 z-30 min-w-[200px] border-b border-r border-slate-200 bg-slate-50 px-3 py-2.5 text-left font-bold text-slate-900">
                    Nhân sự
                  </th>

                  {/* Day columns */}
                  {days.map((day) => {
                    const isToday = day.isToday;
                    return (
                      <th
                        key={day.dateStr}
                        className={`min-w-[44px] border-b border-r border-slate-200 px-1 py-2 text-center ${
                          isToday
                            ? "bg-amber-100 text-amber-900 border-l-2 border-r-2 border-amber-500 font-bold"
                            : day.isSunday
                            ? "bg-slate-100 text-slate-500"
                            : "bg-slate-50 text-slate-700"
                        }`}
                      >
                        <div className="text-[11px] font-bold">{day.dayNumberStr}</div>
                        <div
                          className={`text-[10px] ${
                            isToday ? "text-amber-800 font-extrabold" : "text-slate-500"
                          }`}
                        >
                          {day.dayOfWeek}
                        </div>
                        {isToday && (
                          <div className="mt-0.5 rounded bg-amber-500 px-0.5 py-0.2 text-[8px] font-extrabold text-white uppercase tracking-tight">
                            HÔM NAY
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((emp) => (
                  <tr key={emp.employeeId} className="hover:bg-slate-50/70">
                    {/* Sticky employee info column */}
                    <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-3 py-2 text-left">
                      <div className="font-bold text-slate-900">{emp.fullName}</div>
                      <div className="text-[11px] text-slate-500">
                        {emp.employeeCode} · {emp.shiftCode}
                      </div>
                    </td>

                    {/* Day cells */}
                    {days.map((day) => {
                      const c = emp.days[day.dateStr] || {
                        symbol: "",
                        otHours: 0,
                        workedHours: 0,
                        isException: false,
                      };

                      const isException = c.symbol === "?";
                      const isToday = day.isToday;

                      return (
                        <td
                          key={day.dateStr}
                          onClick={() => handleOpenEdit(emp, day)}
                          title="Bấm để xem chi tiết / sửa tay"
                          className={`relative cursor-pointer border-r border-slate-200 p-0 text-center transition hover:ring-2 hover:ring-emerald-500 hover:z-10 ${
                            isToday
                              ? "bg-amber-50/70 border-l border-r border-amber-300"
                              : day.isSunday
                              ? "bg-slate-50/50"
                              : ""
                          }`}
                        >
                          <div
                            className={`flex h-11 w-full flex-col items-center justify-center ${
                              isException ? "bg-red-100 text-red-700 font-bold" : ""
                            }`}
                          >
                            <span
                              className={`text-xs font-semibold ${
                                isException
                                  ? "text-red-700 text-sm font-extrabold"
                                  : c.symbol === "X"
                                  ? "text-slate-900"
                                  : c.symbol === "TS" || c.symbol === "CT"
                                  ? "text-blue-700 font-bold"
                                  : c.symbol === "P"
                                  ? "text-emerald-700 font-bold"
                                  : "text-slate-400"
                              }`}
                            >
                              {c.symbol}
                            </span>

                            {/* Overtime subscript */}
                            {c.otHours > 0 && (
                              <span className="text-[9px] font-bold text-amber-700 -mt-1">
                                {c.otHours}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer matching Screenshot 3 */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <div>
              Bấm vào ô để xem chi tiết, sửa tay. Số nhỏ trong ô là giờ tăng ca.
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="font-bold text-slate-800">X:</span> Đi làm đủ
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="font-bold text-blue-700">CT:</span> Công tác
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="font-bold text-blue-700">TS:</span> Thai sản
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="font-bold text-red-600 bg-red-100 px-1 rounded">?:</span> Chưa chấm/Ngoại lệ
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Modal Sửa tay / Xem chi tiết chấm công */}
      {editingCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Chấm công ngày {editingCell.workDate}
                </h3>
                <p className="text-xs text-slate-500">
                  {editingCell.employeeName} ({editingCell.employeeCode})
                </p>
              </div>
              <button
                onClick={() => setEditingCell(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCell} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700">
                  Ký hiệu chấm công *
                </label>
                <select
                  value={editSymbol}
                  onChange={(e) => setEditSymbol(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                >
                  <option value="X">X — Đi làm đủ công (8h)</option>
                  <option value="1/2">1/2 — Làm nửa ngày (4h)</option>
                  <option value="P">P — Nghỉ phép năm có lương</option>
                  <option value="CT">CT — Đi công tác</option>
                  <option value="TS">TS — Nghỉ thai sản</option>
                  <option value="O">O — Nghỉ ốm đau hưởng BHXH</option>
                  <option value="KP">KP — Nghỉ không phép / việc riêng</option>
                  <option value="?">? — Chưa chấm / Ngoại lệ cần duyệt</option>
                  <option value="">(Trống / Ngày nghỉ tuần)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700">
                  Giờ tăng ca (OT)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="12"
                  value={editOtHours}
                  onChange={(e) => setEditOtHours(Number(e.target.value))}
                  placeholder="0"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs focus:border-emerald-600 focus:outline-none"
                />
                <span className="mt-1 block text-[11px] text-slate-400">
                  Số nhỏ hiển thị phía dưới ký hiệu trong ô bảng công.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700">
                  Ghi chú / Giải trình điều chỉnh
                </label>
                <textarea
                  rows={2}
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="VD: Quên quẹt thẻ ra, quản lý đã xác nhận"
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCell(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={savingCell}
                  className="rounded-xl bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {savingCell ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
