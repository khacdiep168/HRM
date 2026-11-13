"use client";

import { useEffect, useState } from "react";
import {
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
} from "lucide-react";

interface HolidayItem {
  id: string;
  calendar_date: string;
  holiday_name: string;
  day_type: "HOLIDAY" | "COMPENSATORY_OFF";
}

export function HolidaySettingsView() {
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Scheme settings
  const [tetScheme, setTetScheme] = useState<"1_4" | "2_3" | "3_2">("2_3");
  const [nationalDayScheme, setNationalDayScheme] = useState<"1_2" | "2_3">("1_2");
  const [includeCultureDay, setIncludeCultureDay] = useState(true);

  // Add holiday modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"HOLIDAY" | "COMPENSATORY_OFF">("HOLIDAY");

  // Subtabs within settings
  const [subTab, setSubTab] = useState<
    "shifts" | "rules" | "exceptions" | "symbols" | "holidays"
  >("holidays");
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let active = true;
    fetch(`/api/v1/attendance/holidays?year=${selectedYear}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!active) return;
        const json = await res.json();
        if (!res.ok) {
          setErr(json.error?.message ?? "Không thể tải danh sách ngày nghỉ lễ.");
          return;
        }
        setHolidays(json.data.holidays ?? []);
      })
      .catch(() => {
        if (active) setErr("Lỗi kết nối khi tải danh sách ngày nghỉ lễ.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedYear, reloadTick]);

  async function handleApplyScheme() {
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/v1/attendance/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "GENERATE_SCHEME",
          year: selectedYear,
          tetScheme,
          nationalDayScheme,
          includeCultureDay,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error?.message ?? "Không thể áp dụng phương án.");
        return;
      }
      setMsg(json.data.message ?? `Đã áp dụng phương án nghỉ năm ${selectedYear}.`);
      setHolidays(json.data.holidays ?? []);
    } catch {
      setErr("Lỗi khi tạo lại lịch theo phương án.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteHoliday(item: HolidayItem) {
    if (!confirm(`Bạn có chắc muốn xóa ngày nghỉ "${item.holiday_name}"?`)) return;
    try {
      const res = await fetch("/api/v1/attendance/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "DELETE_HOLIDAY",
          id: item.id,
          calendarDate: item.calendar_date,
        }),
      });
      if (res.ok) {
        setHolidays((prev) => prev.filter((h) => h.id !== item.id && h.calendar_date !== item.calendar_date));
        setMsg(`Đã xóa ngày nghỉ ${item.holiday_name}.`);
      }
    } catch {
      setErr("Không thể xóa ngày nghỉ.");
    }
  }

  async function handleAddHoliday(e: React.FormEvent) {
    e.preventDefault();
    if (!newDate || !newName) return;
    try {
      const res = await fetch("/api/v1/attendance/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_HOLIDAY",
          year: selectedYear,
          calendarDate: newDate,
          holidayName: newName,
          dayType: newType,
        }),
      });
      if (res.ok) {
        setShowAddModal(false);
        setNewDate("");
        setNewName("");
        setReloadTick((t) => t + 1);
        setMsg("Đã thêm ngày nghỉ lễ mới thành công.");
      }
    } catch {
      setErr("Không thể thêm ngày nghỉ lễ.");
    }
  }

  async function handleResetDefaults() {
    if (!confirm(`Khôi phục danh sách ngày nghỉ lễ mặc định theo BLLĐ 2019 cho năm ${selectedYear}?`)) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/attendance/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RESET_DEFAULTS",
          year: selectedYear,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setHolidays(json.data.holidays ?? []);
        setMsg(`Đã khôi phục các ngày lễ tết mặc định năm ${selectedYear}.`);
      }
    } catch {
      setErr("Không thể khôi phục mặc định.");
    } finally {
      setSaving(false);
    }
  }

  function formatDisplayDate(dateStr: string) {
    const parts = dateStr.split("-");
    if (parts.length < 3) return { dayMonth: dateStr, weekday: "" };
    const dt = new Date(`${dateStr}T00:00:00`);
    const dayNames = [
      "Chủ nhật",
      "Thứ Hai",
      "Thứ Ba",
      "Thứ Tư",
      "Thứ Năm",
      "Thứ Sáu",
      "Thứ Bảy",
    ];
    return {
      dayMonth: `${parts[2]}/${parts[1]}`,
      weekday: dayNames[dt.getDay()],
    };
  }

  // Count stats
  const holidayCount = holidays.filter((h) => h.day_type === "HOLIDAY").length;
  const compCount = holidays.filter((h) => h.day_type === "COMPENSATORY_OFF").length;

  return (
    <div className="space-y-6">
      {/* Top Title matching Screenshot 2 */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          Thiết lập chấm công
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Ca làm, quy định tính công, ký hiệu và lịch nghỉ lễ của Thế Kỷ Vàng. Mỗi công ty thiết lập
          riêng · Đang dùng thiết lập gợi ý – sửa bất kỳ mục nào là lưu riêng cho công ty này
        </p>
      </div>

      {/* Sub Tabs within Settings */}
      <div className="border-b border-slate-200">
        <nav className="flex flex-wrap gap-4 text-xs font-semibold">
          <button
            onClick={() => setSubTab("shifts")}
            className={`border-b-2 pb-2.5 transition ${
              subTab === "shifts"
                ? "border-emerald-700 text-emerald-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Ca làm việc
          </button>
          <button
            onClick={() => setSubTab("rules")}
            className={`border-b-2 pb-2.5 transition ${
              subTab === "rules"
                ? "border-emerald-700 text-emerald-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Quy định tính công
          </button>
          <button
            onClick={() => setSubTab("exceptions")}
            className={`border-b-2 pb-2.5 transition ${
              subTab === "exceptions"
                ? "border-emerald-700 text-emerald-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Ngoại lệ
          </button>
          <button
            onClick={() => setSubTab("symbols")}
            className={`border-b-2 pb-2.5 transition ${
              subTab === "symbols"
                ? "border-emerald-700 text-emerald-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Ký hiệu công
          </button>
          <button
            onClick={() => setSubTab("holidays")}
            className={`border-b-2 pb-2.5 transition ${
              subTab === "holidays"
                ? "border-emerald-700 font-bold text-emerald-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Lịch nghỉ lễ, tết
          </button>
        </nav>
      </div>

      {subTab === "holidays" && (
        <div className="space-y-5">
          {/* Year selector pills */}
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-600">Năm</span>
            <button
              onClick={() => setSelectedYear(2026)}
              className={`rounded-lg px-3 py-1 font-bold transition ${
                selectedYear === 2026
                  ? "bg-emerald-800 text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              2026
            </button>
            <button
              onClick={() => setSelectedYear(2027)}
              className={`rounded-lg px-3 py-1 font-bold transition ${
                selectedYear === 2027
                  ? "bg-emerald-800 text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              2027
            </button>
          </div>

          {/* Feedback messages */}
          {err && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {err}
            </div>
          )}
          {msg && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              {msg}
            </div>
          )}

          {/* 2-Column layout matching Screenshot 2 */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Left Card: Phương án nghỉ năm 2026 */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-5">
              <h3 className="text-sm font-bold text-slate-900">
                Phương án nghỉ năm {selectedYear}
              </h3>
              <p className="mt-1 text-[11px] text-slate-500">
                {selectedYear === 2026
                  ? "Mùng 1 Tết: Thứ Ba 17/02/2026 · Giỗ Tổ 10/3 âm lịch: Chủ nhật 26/04/2026"
                  : "Mùng 1 Tết: Thứ Bảy 06/02/2027 · Giỗ Tổ 10/3 âm lịch: Thứ Năm 15/04/2027"}
              </p>

              <div className="mt-5 space-y-4 text-xs">
                {/* Tết Nguyên đán selector */}
                <div>
                  <label className="font-semibold text-slate-800">
                    Tết Nguyên đán (5 ngày)
                  </label>
                  <div className="mt-2 space-y-1.5">
                    <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 p-2.5 hover:bg-slate-50">
                      <input
                        type="radio"
                        name="tetScheme"
                        value="1_4"
                        checked={tetScheme === "1_4"}
                        onChange={() => setTetScheme("1_4")}
                        className="text-emerald-700 focus:ring-emerald-600"
                      />
                      <span className="text-slate-800">
                        1 ngày trước Tết + 4 ngày đầu năm
                      </span>
                    </label>

                    <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 p-2.5 hover:bg-slate-50">
                      <input
                        type="radio"
                        name="tetScheme"
                        value="2_3"
                        checked={tetScheme === "2_3"}
                        onChange={() => setTetScheme("2_3")}
                        className="text-emerald-700 focus:ring-emerald-600"
                      />
                      <span className="text-slate-800">2 + 3 (2 ngày trước Tết + 3 ngày đầu năm)</span>
                    </label>

                    <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 p-2.5 hover:bg-slate-50">
                      <input
                        type="radio"
                        name="tetScheme"
                        value="3_2"
                        checked={tetScheme === "3_2"}
                        onChange={() => setTetScheme("3_2")}
                        className="text-emerald-700 focus:ring-emerald-600"
                      />
                      <span className="text-slate-800">3 + 2 (3 ngày trước Tết + 2 ngày đầu năm)</span>
                    </label>
                  </div>
                </div>

                {/* Quốc khánh selector */}
                <div className="pt-2">
                  <label className="font-semibold text-slate-800">
                    Quốc khánh (2 ngày)
                  </label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 p-2.5 hover:bg-slate-50">
                      <input
                        type="radio"
                        name="nationalDayScheme"
                        value="1_2"
                        checked={nationalDayScheme === "1_2"}
                        onChange={() => setNationalDayScheme("1_2")}
                        className="text-emerald-700 focus:ring-emerald-600"
                      />
                      <span className="text-slate-800">1/9 và 2/9</span>
                    </label>

                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 p-2.5 hover:bg-slate-50">
                      <input
                        type="radio"
                        name="nationalDayScheme"
                        value="2_3"
                        checked={nationalDayScheme === "2_3"}
                        onChange={() => setNationalDayScheme("2_3")}
                        className="text-emerald-700 focus:ring-emerald-600"
                      />
                      <span className="text-slate-800">2/9 và 3/9</span>
                    </label>
                  </div>
                </div>

                {/* Checkbox Ngày Văn hóa VN 24/11 */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={includeCultureDay}
                      onChange={(e) => setIncludeCultureDay(e.target.checked)}
                      className="mt-0.5 rounded text-emerald-700 focus:ring-emerald-600"
                    />
                    <div>
                      <div className="font-semibold text-slate-800">
                        Cho nghỉ Ngày Văn hóa Việt Nam 24/11
                      </div>
                      <div className="mt-1 text-[11px] leading-relaxed text-slate-500">
                        Công chức được nghỉ 24/11/2026. Với doanh nghiệp, Luật sửa đổi Bộ luật Lao
                        động trao quyền đơn vị tự quyết, kiểm tra lại quy chế nội bộ trước khi bật.
                      </div>
                    </div>
                  </label>
                </div>

                {/* Action button */}
                <button
                  type="button"
                  onClick={handleApplyScheme}
                  disabled={saving}
                  className="w-full rounded-xl bg-slate-900 py-2.5 font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
                >
                  {saving ? "Đang áp dụng..." : "Tạo lại lịch theo phương án"}
                </button>
              </div>
            </div>

            {/* Right Card: Danh sách ngày năm 2026 */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-7">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Danh sách ngày năm {selectedYear}
                  </h3>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {holidayCount} ngày lễ, tết · {compCount} ngày nghỉ bù · ngày lễ, tết, nghỉ bù
                    được hưởng nguyên lương
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Thêm ngày
                  </button>
                  <button
                    onClick={handleResetDefaults}
                    className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Khôi phục
                  </button>
                </div>
              </div>

              {/* Holiday list */}
              {loading ? (
                <div className="flex h-48 items-center justify-center text-xs text-slate-400">
                  Đang tải danh sách ngày nghỉ...
                </div>
              ) : (
                <div className="mt-3 divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                  {holidays.map((h) => {
                    const { dayMonth, weekday } = formatDisplayDate(h.calendar_date);
                    return (
                      <div
                        key={h.id || h.calendar_date}
                        className="flex items-center justify-between py-2.5 hover:bg-slate-50/60"
                      >
                        <div className="flex items-center gap-3">
                          {/* Date box matching Screenshot 2 */}
                          <div className="flex h-12 w-14 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-center">
                            <span className="text-xs font-bold text-slate-900">{dayMonth}</span>
                            <span className="text-[10px] text-slate-500">{weekday}</span>
                          </div>

                          <div>
                            <div className="text-xs font-semibold text-slate-900">
                              {h.holiday_name}
                            </div>
                            <div className="mt-1">
                              {h.day_type === "HOLIDAY" ? (
                                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                                  Nghỉ lễ, tết
                                </span>
                              ) : (
                                <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                                  Nghỉ bù
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div>
                          <button
                            onClick={() => handleDeleteHoliday(h)}
                            className="rounded-lg p-1.5 text-xs text-slate-400 hover:bg-red-50 hover:text-red-600"
                            title="Xóa ngày nghỉ này"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Add Holiday Modal */}
          {showAddModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-900">Thêm Ngày Nghỉ Lễ Mới</h3>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleAddHoliday} className="mt-4 space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700">Ngày nghỉ *</label>
                    <input
                      type="date"
                      required
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700">Tên ngày lễ / tết *</label>
                    <input
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="VD: Ngày thành lập Công ty"
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700">Phân loại</label>
                    <select
                      value={newType}
                      onChange={(e) =>
                        setNewType(e.target.value as "HOLIDAY" | "COMPENSATORY_OFF")
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-emerald-600 focus:outline-none"
                    >
                      <option value="HOLIDAY">Nghỉ lễ, tết</option>
                      <option value="COMPENSATORY_OFF">Nghỉ bù</option>
                    </select>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="rounded-xl bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800"
                    >
                      Lưu ngày nghỉ
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Placeholders for other subtabs */}
      {subTab !== "holidays" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
          <Clock className="mx-auto h-8 w-8 text-slate-400" />
          <div className="mt-2 font-semibold text-slate-700">
            Cấu hình {subTab === "shifts" ? "Ca làm việc" : subTab === "rules" ? "Quy định tính công" : subTab === "exceptions" ? "Ngoại lệ" : "Ký hiệu công"}
          </div>
          <p className="mt-1 text-slate-400">
            Các tham số được đồng bộ trực tiếp với hệ thống chấm công và công thức tính lương.
          </p>
        </div>
      )}
    </div>
  );
}
