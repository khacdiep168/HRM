"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileSignature, AlertCircle } from "lucide-react";
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_TYPE_LABELS,
  labelOf,
} from "@/lib/i18n/vi-labels";

interface ContractsPayload {
  contracts: Array<{
    id: string;
    contract_no: string;
    contract_type: string;
    signed_date: string;
    effective_from: string;
    effective_to: string | null;
    status: string;
    employees: { employee_code: string; full_name: string } | null;
  }>;
  employees: Array<{ id: string; employee_code: string; full_name: string }>;
  bankAccounts: Array<{
    employee_id: string;
    bank_code: string;
    bank_name: string;
    account_no_masked: string;
  }>;
}

export default function ContractsPage() {
  const [data, setData] = useState<ContractsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  const [employeeId, setEmployeeId] = useState("");
  const [contractNo, setContractNo] = useState("");
  const [contractType, setContractType] = useState<"FIXED_TERM" | "INDEFINITE" | "PROBATION">("FIXED_TERM");
  const [signedDate, setSignedDate] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [bankCode, setBankCode] = useState("VCB");
  const [bankName, setBankName] = useState("Vietcombank");
  const [accountNo, setAccountNo] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/v1/contracts", { cache: "no-store" })
      .then(async (res) => {
        if (!active) return;
        const json = await res.json();
        if (!res.ok) {
          setError(json.error?.message ?? "Không thể tải hợp đồng lao động.");
          return;
        }
        const payload = json.data as ContractsPayload;
        setError(null);
        setData(payload);
        if (payload.employees.length > 0) setEmployeeId((p) => p || payload.employees[0].id);
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
    const res = await fetch("/api/v1/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId,
        contractNo,
        contractType,
        signedDate,
        effectiveFrom,
        effectiveTo: effectiveTo || null,
        bankCode: accountNo ? bankCode : undefined,
        bankName: accountNo ? bankName : undefined,
        accountNo: accountNo || undefined,
        accountHolder: accountHolder || undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErr(json.error?.message ?? "Tạo hợp đồng thất bại.");
      return;
    }
    setMsg("Đã tạo HĐLĐ, kích hoạt Legal Hold 10 năm và mã hóa STK ngân hàng.");
    setContractNo("");
    setAccountNo("");
    setReloadTick((t) => t + 1);
  }

  if (loading) return <div className="py-12 text-center text-sm text-slate-500">Đang tải...</div>;
  if (error || !data) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle className="h-5 w-5" />
          Cần đăng nhập để truy cập Hợp đồng Lao động
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
          <FileSignature className="h-5 w-5 text-amber-600" />
          Hợp đồng Lao động &amp; Tài khoản Ngân hàng (AES-256-GCM)
        </h1>
        <p className="text-xs text-slate-500">
          Chặn trùng thời gian hiệu lực • Tự động bật Legal Hold lưu trữ 10 năm theo Luật Lao động &amp; Kế toán.
        </p>
      </div>

      {err && <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{err}</div>}
      {msg && <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">{msg}</div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Tạo Hợp đồng Lao động mới</h2>
          <form onSubmit={handleSubmit} className="mt-4 space-y-2.5 text-xs">
            <div>
              <label className="block font-medium text-slate-700">Nhân viên *</label>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2"
              >
                {data.employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.employee_code} — {e.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-medium text-slate-700">Số HĐLĐ *</label>
                <input
                  required
                  value={contractNo}
                  onChange={(e) => setContractNo(e.target.value)}
                  placeholder="HD-2026-001"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700">Loại HĐ</label>
                <select
                  value={contractType}
                  onChange={(e) => setContractType(e.target.value as typeof contractType)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5"
                >
                  <option value="FIXED_TERM">Xác định thời hạn</option>
                  <option value="INDEFINITE">Không xác định thời hạn</option>
                  <option value="PROBATION">Thử việc</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block font-medium text-slate-700">Ngày ký *</label>
                <input
                  type="date"
                  required
                  value={signedDate}
                  onChange={(e) => setSignedDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-1.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700">Hiệu lực từ *</label>
                <input
                  type="date"
                  required
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-1.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700">Đến ngày</label>
                <input
                  type="date"
                  value={effectiveTo}
                  onChange={(e) => setEffectiveTo(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-1.5 py-1.5"
                />
              </div>
            </div>
            <div className="border-t pt-2 font-semibold text-slate-800">
              STK Ngân hàng nhận lương (tùy chọn)
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value)}
                placeholder="VCB / BIDV"
                className="rounded-lg border border-slate-300 px-2 py-1.5"
              />
              <input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Tên ngân hàng"
                className="rounded-lg border border-slate-300 px-2 py-1.5"
              />
            </div>
            <input
              value={accountNo}
              onChange={(e) => setAccountNo(e.target.value)}
              placeholder="Số tài khoản (sẽ mã hóa AES-256-GCM)"
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5"
            />
            <input
              value={accountHolder}
              onChange={(e) => setAccountHolder(e.target.value)}
              placeholder="Tên chủ tài khoản không dấu"
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5"
            />
            <button type="submit" className="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-semibold text-white">
              Lưu Hợp đồng
            </button>
          </form>
        </section>

        <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Danh sách Hợp đồng Lao động</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Số HĐ</th>
                  <th className="px-3 py-2">Nhân viên</th>
                  <th className="px-3 py-2">Loại</th>
                  <th className="px-3 py-2">Hiệu lực</th>
                  <th className="px-3 py-2">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.contracts.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2 font-mono font-semibold text-slate-900">{c.contract_no}</td>
                    <td className="px-3 py-2">
                      {c.employees?.employee_code} — {c.employees?.full_name}
                    </td>
                    <td className="px-3 py-2">
                      {labelOf(CONTRACT_TYPE_LABELS, c.contract_type)}
                    </td>
                    <td className="px-3 py-2">
                      {c.effective_from} → {c.effective_to ?? "Không thời hạn"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                          c.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {labelOf(CONTRACT_STATUS_LABELS, c.status)}
                      </span>
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

