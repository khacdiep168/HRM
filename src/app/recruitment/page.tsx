"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserPlus, AlertCircle } from "lucide-react";

interface RecruitmentPayload {
  requisitions: Array<{
    id: string;
    title: string;
    headcount: number;
    status: string;
    departments: { name: string } | null;
    positions: { title: string; headcount_limit: number } | null;
  }>;
  applications: Array<{
    id: string;
    stage: string;
    status: string;
    candidates: { full_name: string; email: string | null; phone_last4: string | null } | null;
    job_requisitions: { title: string } | null;
  }>;
  departments: Array<{ id: string; code: string; name: string }>;
  positions: Array<{ id: string; code: string; title: string; headcount_limit: number }>;
}

export default function RecruitmentPage() {
  const [data, setData] = useState<RecruitmentPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  const [deptId, setDeptId] = useState("");
  const [posId, setPosId] = useState("");
  const [title, setTitle] = useState("");
  const [headcount, setHeadcount] = useState("1");

  const [candReqId, setCandReqId] = useState("");
  const [candName, setCandName] = useState("");
  const [candPhone, setCandPhone] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/v1/recruitment", { cache: "no-store" })
      .then(async (res) => {
        if (!active) return;
        const json = await res.json();
        if (!res.ok) {
          setError(json.error?.message ?? "Không thể tải dữ liệu tuyển dụng.");
          return;
        }
        const payload = json.data as RecruitmentPayload;
        setError(null);
        setData(payload);
        setDeptId((p) => p || payload.departments[0]?.id || "");
        setPosId((p) => p || payload.positions[0]?.id || "");
        setCandReqId((p) => p || payload.requisitions[0]?.id || "");
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

  async function handleCreateRequisition(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    const res = await fetch("/api/v1/recruitment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "REQUISITION",
        departmentId: deptId,
        positionId: posId,
        title,
        headcount: Number(headcount),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErr(json.error?.message ?? "Tạo đề xuất tuyển dụng thất bại.");
      return;
    }
    setMsg("Đã tạo đề xuất tuyển dụng.");
    setTitle("");
    setReloadTick((t) => t + 1);
  }

  async function handleCreateCandidate(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    const res = await fetch("/api/v1/recruitment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "CANDIDATE",
        requisitionId: candReqId,
        fullName: candName,
        phone: candPhone || undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErr(json.error?.message ?? "Thêm ứng viên thất bại.");
      return;
    }
    setMsg("Đã thêm ứng viên (SĐT mã hóa AES-256-GCM, retention 12 tháng).");
    setCandName("");
    setCandPhone("");
    setReloadTick((t) => t + 1);
  }

  if (loading) return <div className="py-12 text-center text-sm text-slate-500">Đang tải...</div>;
  if (error || !data) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle className="h-5 w-5" />
          Cần đăng nhập để truy cập Tuyển dụng
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
          <UserPlus className="h-5 w-5 text-amber-600" />
          Tuyển dụng (ATS) &amp; Kiểm soát Định biên
        </h1>
        <p className="text-xs text-slate-500">
          Kiểm tra định biên vị trí trước khi mở tuyển • Ứng viên tự động gắn hạn lưu trữ 12 tháng theo PDPL 91/2025.
        </p>
      </div>

      {err && <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{err}</div>}
      {msg && <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">{msg}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Mở Đề xuất Tuyển dụng</h2>
          <form onSubmit={handleCreateRequisition} className="mt-3 space-y-2.5 text-xs">
            <select
              value={deptId}
              onChange={(e) => setDeptId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-2"
            >
              {data.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
            <select
              value={posId}
              onChange={(e) => setPosId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-2"
            >
              {data.positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} (Định biên: {p.headcount_limit})
                </option>
              ))}
            </select>
            <div className="grid grid-cols-3 gap-2">
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Tiêu đề vị trí cần tuyển"
                className="col-span-2 rounded-lg border border-slate-300 px-2.5 py-1.5"
              />
              <input
                type="number"
                min={1}
                required
                value={headcount}
                onChange={(e) => setHeadcount(e.target.value)}
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono"
              />
            </div>
            <button type="submit" className="w-full rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white">
              Tạo Đề xuất Tuyển dụng
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Tiếp nhận Hồ sơ Ứng viên</h2>
          <form onSubmit={handleCreateCandidate} className="mt-3 space-y-2.5 text-xs">
            <select
              value={candReqId}
              onChange={(e) => setCandReqId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-2"
            >
              {data.requisitions.length === 0 ? (
                <option value="">Tạo đề xuất tuyển dụng trước</option>
              ) : (
                data.requisitions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title} ({r.headcount} người)
                  </option>
                ))
              )}
            </select>
            <input
              required
              value={candName}
              onChange={(e) => setCandName(e.target.value)}
              placeholder="Họ tên ứng viên *"
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
            />
            <input
              value={candPhone}
              onChange={(e) => setCandPhone(e.target.value)}
              placeholder="Số điện thoại (AES-256-GCM)"
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
            />
            <button
              type="submit"
              disabled={!candReqId}
              className="w-full rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              Thêm Ứng viên
            </button>
          </form>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">
          Danh sách Ứng viên ({data.applications.length})
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Ứng viên</th>
                <th className="px-3 py-2">Vị trí ứng tuyển</th>
                <th className="px-3 py-2">SĐT (Che)</th>
                <th className="px-3 py-2">Vòng</th>
                <th className="px-3 py-2">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.applications.map((a) => (
                <tr key={a.id}>
                  <td className="px-3 py-2 font-medium text-slate-900">{a.candidates?.full_name}</td>
                  <td className="px-3 py-2">{a.job_requisitions?.title}</td>
                  <td className="px-3 py-2 font-mono">
                    {a.candidates?.phone_last4 ? `******${a.candidates.phone_last4}` : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono">{a.stage}</td>
                  <td className="px-3 py-2 font-mono">{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

