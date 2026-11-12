"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarOff, AlertCircle, CheckCircle2, XCircle } from "lucide-react";

interface LeavePayload {
  leaveTypes: Array<{ id: string; code: string; name: string }>;
  balances: Array<{
    id: string;
    year: number;
    entitled_days: number;
    used_days: number;
    pending_days: number;
    available_days: number;
    leave_types: { name: string } | null;
    employees: { employee_code: string; full_name: string } | null;
  }>;
  requests: Array<{
    id: string;
    start_date: string;
    end_date: string;
    total_days: number;
    reason: string;
    status: string;
    leave_types: { code: string; name: string } | null;
    employees: { employee_code: string; full_name: string } | null;
  }>;
}

export default function LeavePage() {
  const [data, setData] = useState<LeavePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [totalDays, setTotalDays] = useState("1");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/v1/leave/requests", { cache: "no-store" })
      .then(async (res) => {
        if (!active) return;
        const json = await res.json();
        if (!res.ok) {
          setError(json.error?.message ?? "Không thể tải dữ liệu nghỉ phép.");
          return;
        }
        const payload = json.data as LeavePayload;
        setError(null);
        setData(payload);
        if (payload.leaveTypes.length > 0) {
          setLeaveTypeId((p) => p || payload.leaveTypes[0].id);
        }
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
    const res = await fetch("/api/v1/leave/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leaveTypeId,
        startDate,
        endDate,
        totalDays: Number(totalDays),
        reason,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErr(json.error?.message ?? "Gửi đơn nghỉ phép thất bại.");
      return;
    }
    setMsg("Đã gửi đơn nghỉ phép (PENDING).");
    setReason("");
    setReloadTick((t) => t + 1);
  }

  async function handleDecision(requestId: string, decision: "APPROVED" | "REJECTED") {
    setMsg(null);
    setErr(null);
    const res = await fetch("/api/v1/leave/requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, decision }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErr(json.error?.message ?? "Không thể duyệt đơn.");
      return;
    }
    setMsg(`Đã ${decision === "APPROVED" ? "duyệt" : "từ chối"} đơn nghỉ phép.`);
    setReloadTick((t) => t + 1);
  }

  if (loading) return <div className="py-12 text-center text-sm text-slate-500">Đang tải...</div>;
  if (error || !data) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle className="h-5 w-5" />
          Cần đăng nhập để truy cập Quản lý Nghỉ phép
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
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <CalendarOff className="h-5 w-5 text-amber-600" />
          Quản lý Nghỉ phép &amp; Quỹ phép năm
        </h1>
        <p className="text-xs text-slate-500">
          Phép tồn năm cũ tự động hết hạn sau 31/03 • Chặn tự duyệt đơn của chính mình (SoD).
        </p>
      </div>

      {err && <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{err}</div>}
      {msg && <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">{msg}</div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Gửi Đơn Xin Nghỉ phép</h2>
          <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-xs">
            <div>
              <label className="block font-medium text-slate-700">Loại nghỉ phép</label>
              <select
                value={leaveTypeId}
                onChange={(e) => setLeaveTypeId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2"
              >
                {data.leaveTypes.map((lt) => (
                  <option key={lt.id} value={lt.id}>
                    {lt.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-medium text-slate-700">Từ ngày *</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700">Đến ngày *</label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5"
                />
              </div>
            </div>
            <div>
              <label className="block font-medium text-slate-700">Số ngày nghỉ</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                required
                value={totalDays}
                onChange={(e) => setTotalDays(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Lý do *</label>
              <input
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="VD: Giải quyết việc gia đình"
                className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
              />
            </div>
            <button type="submit" className="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-semibold text-white">
              Gửi đơn nghỉ phép
            </button>
          </form>
        </section>

        <section className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">Số dư Quỹ phép năm</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 text-xs">
              {data.balances.map((b) => (
                <div key={b.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="font-semibold text-slate-900">
                    {b.employees?.employee_code} — {b.employees?.full_name}
                  </div>
                  <div className="mt-1 text-slate-600">
                    Cấp: {b.entitled_days} • Đã dùng: {b.used_days} • Chờ duyệt: {b.pending_days}
                  </div>
                  <div className="mt-1 font-bold text-emerald-700">
                    Khả dụng: {b.available_days} ngày
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">Danh sách Đơn Nghỉ phép</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Nhân viên</th>
                    <th className="px-3 py-2">Loại</th>
                    <th className="px-3 py-2">Thời gian</th>
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
                      <td className="px-3 py-2">{r.leave_types?.name}</td>
                      <td className="px-3 py-2">
                        {r.start_date} → {r.end_date} ({r.total_days}d)
                      </td>
                      <td className="px-3 py-2 font-mono">{r.status}</td>
                      <td className="px-3 py-2 text-right">
                        {r.status === "PENDING" && (
                          <div className="inline-flex gap-1">
                            <button
                              type="button"
                              onClick={() => handleDecision(r.id, "APPROVED")}
                              className="inline-flex items-center gap-0.5 rounded bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white"
                            >
                              <CheckCircle2 className="h-3 w-3" /> Duyệt
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDecision(r.id, "REJECTED")}
                              className="inline-flex items-center gap-0.5 rounded bg-red-600 px-2 py-1 text-[11px] font-semibold text-white"
                            >
                              <XCircle className="h-3 w-3" /> Từ chối
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

