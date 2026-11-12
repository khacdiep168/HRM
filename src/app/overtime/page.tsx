"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock3, AlertCircle, CheckCircle2 } from "lucide-react";

interface OtPayload {
  requests: Array<{
    id: string;
    work_date: string;
    start_time: string;
    end_time: string;
    requested_hours: number;
    ot_day_type: string;
    is_night_shift: boolean;
    status: string;
    reason: string;
    employees: { employee_code: string; full_name: string } | null;
  }>;
  quota: {
    allow300h: boolean;
    annualCap: number;
    monthlyCap: number;
    yearHoursUsed: number;
    monthHoursUsed: number;
  };
}

export default function OvertimePage() {
  const [data, setData] = useState<OtPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  const [workDate, setWorkDate] = useState("");
  const [startTime, setStartTime] = useState("17:30");
  const [endTime, setEndTime] = useState("20:30");
  const [requestedHours, setRequestedHours] = useState("3");
  const [otDayType, setOtDayType] = useState<"WEEKDAY" | "WEEKEND" | "HOLIDAY">("WEEKDAY");
  const [isNightShift, setIsNightShift] = useState(false);
  const [employeeConsent, setEmployeeConsent] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/v1/overtime/requests", { cache: "no-store" })
      .then(async (res) => {
        if (!active) return;
        const json = await res.json();
        if (!res.ok) {
          setError(json.error?.message ?? "Không thể tải dữ liệu tăng ca.");
          return;
        }
        setError(null);
        setData(json.data as OtPayload);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    const res = await fetch("/api/v1/overtime/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workDate,
        startTime,
        endTime,
        requestedHours: Number(requestedHours),
        otDayType,
        isNightShift,
        employeeConsent,
        reason,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErr(json.error?.message ?? "Đăng ký tăng ca thất bại.");
      return;
    }
    setMsg("Đã gửi đăng ký tăng ca.");
    setReason("");
    setReloadTick((t) => t + 1);
  }

  async function handleDecision(requestId: string, decision: "APPROVED" | "REJECTED") {
    setMsg(null);
    setErr(null);
    const res = await fetch("/api/v1/overtime/requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, decision }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErr(json.error?.message ?? "Không thể duyệt đơn tăng ca.");
      return;
    }
    setMsg(`Đã ${decision === "APPROVED" ? "duyệt & ghi nhận hệ số OT" : "từ chối"} đơn tăng ca.`);
    setReloadTick((t) => t + 1);
  }

  if (loading) return <div className="py-12 text-center text-sm text-slate-500">Đang tải...</div>;
  if (error || !data) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle className="h-5 w-5" />
          Cần đăng nhập để truy cập Tăng ca (OT)
        </div>
        <p className="mt-2 text-xs text-amber-800">{error}</p>
        <Link href="/login" className="mt-4 inline-block rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white">
          Đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Clock3 className="h-5 w-5 text-amber-600" />
            Quản lý Tăng ca (BLLĐ 2019: Trần 40h/tháng &amp; 200h–300h/năm)
          </h1>
          <p className="text-xs text-slate-500">
            Bắt buộc sự đồng ý tự nguyện của người lao động • Tự động tách phần chênh lệch vượt 1.0x để miễn thuế TNCN.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="rounded-lg border bg-white px-3 py-1.5 font-medium">
            Tháng này: <strong>{data.quota.monthHoursUsed}</strong>/{data.quota.monthlyCap}h
          </span>
          <span className="rounded-lg border bg-white px-3 py-1.5 font-medium">
            Năm nay: <strong>{data.quota.yearHoursUsed}</strong>/{data.quota.annualCap}h
          </span>
        </div>
      </div>

      {err && <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{err}</div>}
      {msg && <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">{msg}</div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Đăng ký Làm thêm giờ (OT)</h2>
          <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-xs">
            <div>
              <label className="block font-medium text-slate-700">Ngày tăng ca *</label>
              <input
                type="date"
                required
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block font-medium text-slate-700">Từ</label>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700">Đến</label>
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700">Số giờ</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="12"
                  required
                  value={requestedHours}
                  onChange={(e) => setRequestedHours(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block font-medium text-slate-700">Loại ngày</label>
              <select
                value={otDayType}
                onChange={(e) => setOtDayType(e.target.value as typeof otDayType)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2"
              >
                <option value="WEEKDAY">Ngày thường (150%)</option>
                <option value="WEEKEND">Ngày nghỉ tuần (200%)</option>
                <option value="HOLIDAY">Ngày Lễ / Tết (300%)</option>
              </select>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isNightShift}
                onChange={(e) => setIsNightShift(e.target.checked)}
              />
              <span>Làm thêm giờ ban đêm (22:00–06:00)</span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
              <input
                type="checkbox"
                checked={employeeConsent}
                onChange={(e) => setEmployeeConsent(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-[11px] text-amber-950">
                Tôi hoàn toàn đồng ý tự nguyện làm thêm giờ theo Điều 107 Bộ luật Lao động 2019.
              </span>
            </label>
            <div>
              <label className="block font-medium text-slate-700">Lý do công việc *</label>
              <input
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="VD: Kiểm kê kho cuối tháng"
                className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
              />
            </div>
            <button type="submit" className="w-full rounded-lg bg-amber-600 px-4 py-2.5 font-semibold text-white">
              Gửi đăng ký OT
            </button>
          </form>
        </section>

        <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Danh sách Đơn Tăng ca</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Nhân viên</th>
                  <th className="px-3 py-2">Ngày &amp; Giờ</th>
                  <th className="px-3 py-2">Loại</th>
                  <th className="px-3 py-2">Trạng thái</th>
                  <th className="px-3 py-2 text-right">Duyệt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.requests.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {r.employees?.employee_code} — {r.employees?.full_name}
                    </td>
                    <td className="px-3 py-2">
                      {r.work_date} ({r.requested_hours}h)
                    </td>
                    <td className="px-3 py-2">
                      {r.ot_day_type} {r.is_night_shift ? "• Đêm" : ""}
                    </td>
                    <td className="px-3 py-2 font-mono">{r.status}</td>
                    <td className="px-3 py-2 text-right">
                      {r.status === "PENDING" && (
                        <button
                          type="button"
                          onClick={() => handleDecision(r.id, "APPROVED")}
                          className="inline-flex items-center gap-0.5 rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white"
                        >
                          <CheckCircle2 className="h-3 w-3" /> Duyệt OT
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

