"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Plus,
  Search,
  Calendar,
  ShieldCheck,
  X,
  FileText,
} from "lucide-react";

interface SeniorityFundRow {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  departmentName: string;
  hireDate: string;
  seniorityDisplay: string;
  seniorityYears: number;
  baseDays: number;
  seniorityBonus: number;
  totalAnnualLeave: number;
  isProrated: boolean;
  workedMonthsInYear: number;
  usedDays: number;
  upcomingApprovedDays: number;
  pendingDays: number;
  remainingDays: number;
}

interface LeaveRequestItem {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  status: string;
  leave_types: { code: string; name: string } | null;
  employees: { employee_code: string; full_name: string } | null;
}

interface LeaveDataPayload {
  leaveTypes: Array<{ id: string; code: string; name: string }>;
  seniorityFunds: SeniorityFundRow[];
  requests: LeaveRequestItem[];
  stats: {
    pendingCount: number;
    duePendingCount: number;
    upcoming14dCount: number;
    approvedCount: number;
    rejectedCount: number;
  };
  asOfDate: string;
}

export default function LeavePage() {
  const [data, setData] = useState<LeaveDataPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  // Active tab
  const [activeTab, setActiveTab] = useState<"requests" | "fund" | "policy">("fund");

  // Filters for Quỹ phép năm
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("ALL");

  // Modal create leave request
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [totalDays, setTotalDays] = useState("1");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Employee detail modal
  const [selectedEmployee, setSelectedEmployee] = useState<SeniorityFundRow | null>(null);

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
        setError(null);
        setData(json.data as LeaveDataPayload);
        if (json.data?.leaveTypes?.length > 0) {
          setLeaveTypeId((p) => p || json.data.leaveTypes[0].id);
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

  async function handleCreateLeave(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    setSubmitting(true);
    try {
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
      setMsg("Đã tạo đơn nghỉ phép thành công (trạng thái: Chờ duyệt).");
      setShowCreateModal(false);
      setReason("");
      setReloadTick((t) => t + 1);
    } catch {
      setErr("Lỗi kết nối khi gửi đơn nghỉ phép.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDecision(requestId: string, decision: "APPROVED" | "REJECTED") {
    setMsg(null);
    setErr(null);
    try {
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
    } catch {
      setErr("Lỗi kết nối khi xử lý đơn.");
    }
  }

  async function handleUpdateBaseDays(employeeId: string, baseDays: number) {
    try {
      const res = await fetch("/api/v1/leave/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: "UPDATE_BASE_DAYS",
          employeeId,
          baseDays,
        }),
      });
      if (res.ok) {
        setReloadTick((t) => t + 1);
      }
    } catch {
      // silent fallback
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle className="h-5 w-5" />
          Cần đăng nhập để truy cập Quản lý Nghỉ phép
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

  // Get unique departments for filter
  const departments = Array.from(
    new Set(data.seniorityFunds.map((s) => s.departmentName).filter(Boolean))
  );

  // Filter rows
  const filteredFunds = data.seniorityFunds.filter((row) => {
    const matchSearch =
      searchQuery === "" ||
      row.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      row.employeeCode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchDept =
      selectedDepartment === "ALL" || row.departmentName === selectedDepartment;
    return matchSearch && matchDept;
  });

  return (
    <div className="space-y-6">
      {/* Top context bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-emerald-100 px-2.5 py-1 font-medium text-emerald-800">
            Dữ liệu thực tế · CÔNG TY TNHH THƯƠNG MẠI THẾ KỶ VÀNG
          </span>
          <span className="rounded bg-slate-100 px-2.5 py-1 text-slate-700">
            Đơn vị: Tổng các công ty (2/2)
          </span>
          <span className="rounded bg-slate-100 px-2.5 py-1 text-slate-700">
            Tính đến: {data.asOfDate ? `${data.asOfDate.slice(8, 10)}/${data.asOfDate.slice(5, 7)}/${data.asOfDate.slice(0, 4)}` : "Hôm nay"}
          </span>
        </div>
        <div className="text-slate-400">Hệ thống HRM Enterprise 2.0</div>
      </div>

      {/* Main Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Nghỉ phép</h1>
          <p className="mt-1 text-xs text-slate-500">
            Đơn nghỉ được duyệt tự vào Tổng hợp công · quỹ phép năm tự tính theo Điều 113, 114
            BLLĐ 2019 và Điều 66 NĐ 145/2020, tính đến ngày hiện tại
          </p>
        </div>
        <div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800"
          >
            <Plus className="h-4 w-4" />
            + Tạo đơn nghỉ
          </button>
        </div>
      </div>

      {/* Messages */}
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

      {/* 4 Stat Cards matching Screenshot 1 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-bold text-slate-900">{data.stats.pendingCount}</div>
          <div className="mt-1 text-xs font-medium text-slate-600">đơn chờ duyệt</div>
          {data.stats.duePendingCount > 0 && (
            <div className="mt-1 text-xs font-semibold text-red-600">
              {data.stats.duePendingCount} đơn đã tới ngày nghỉ
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-bold text-slate-900">{data.stats.upcoming14dCount}</div>
          <div className="mt-1 text-xs font-medium text-slate-600">
            lượt nghỉ trong 14 ngày tới
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-bold text-slate-900">{data.stats.approvedCount}</div>
          <div className="mt-1 text-xs font-medium text-slate-600">đơn đã duyệt</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-bold text-slate-900">{data.stats.rejectedCount}</div>
          <div className="mt-1 text-xs font-medium text-slate-600">đơn từ chối</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-8 text-sm font-medium">
          <button
            onClick={() => setActiveTab("requests")}
            className={`border-b-2 pb-3 transition ${
              activeTab === "requests"
                ? "border-emerald-700 font-bold text-emerald-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Đơn nghỉ
          </button>
          <button
            onClick={() => setActiveTab("fund")}
            className={`border-b-2 pb-3 transition ${
              activeTab === "fund"
                ? "border-emerald-700 font-bold text-emerald-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Quỹ phép năm
          </button>
          <button
            onClick={() => setActiveTab("policy")}
            className={`border-b-2 pb-3 transition ${
              activeTab === "policy"
                ? "border-emerald-700 font-bold text-emerald-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Quy định phép năm
          </button>
        </nav>
      </div>

      {/* TAB 1: Quỹ phép năm (Active in Screenshot 1) */}
      {activeTab === "fund" && (
        <div className="space-y-4">
          {/* Search & Filter bar */}
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-slate-600">Tìm kiếm</label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tên, mã NV..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs focus:border-emerald-600 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600">Phòng ban</label>
              <div className="mt-1">
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:border-emerald-600 focus:bg-white focus:outline-none"
                >
                  <option value="ALL">Tất cả phòng ban</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Seniority & Annual Leave Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 font-semibold text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Mã NV</th>
                    <th className="px-4 py-3">Họ và tên</th>
                    <th className="px-3 py-3">Thâm niên</th>
                    <th className="px-3 py-3">Phép cơ bản</th>
                    <th className="px-3 py-3 text-center">Thâm niên +</th>
                    <th className="px-3 py-3 text-center">Tổng phép năm</th>
                    <th className="px-3 py-3 text-center">Đã nghỉ</th>
                    <th className="px-3 py-3 text-center">Đã duyệt sắp nghỉ</th>
                    <th className="px-3 py-3 text-center">Chờ duyệt</th>
                    <th className="px-4 py-3 text-center font-bold text-slate-900">Còn lại</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredFunds.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        Không tìm thấy nhân viên nào phù hợp.
                      </td>
                    </tr>
                  ) : (
                    filteredFunds.map((row) => (
                      <tr key={row.employeeId} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-mono text-slate-500">
                          {row.employeeCode}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setSelectedEmployee(row)}
                            className="font-medium text-emerald-700 hover:underline"
                          >
                            {row.fullName}
                          </button>
                          <div className="text-[11px] text-slate-400">
                            {row.departmentName}
                          </div>
                        </td>
                        <td className="px-3 py-3 font-medium text-slate-700">
                          {row.seniorityDisplay}
                        </td>
                        <td className="px-3 py-3">
                          <select
                            value={row.baseDays}
                            onChange={(e) =>
                              handleUpdateBaseDays(row.employeeId, Number(e.target.value))
                            }
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 shadow-sm focus:border-emerald-600 focus:outline-none"
                          >
                            <option value={12}>12 ngày (Chuẩn)</option>
                            <option value={14}>14 ngày (Nặng nhọc)</option>
                            <option value={16}>16 ngày (Đặc biệt NN)</option>
                          </select>
                        </td>
                        <td className="px-3 py-3 text-center font-semibold text-slate-700">
                          {row.seniorityBonus}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="font-semibold text-slate-900">
                            {row.totalAnnualLeave}
                          </span>
                          {row.isProrated && (
                            <div className="text-[10px] text-slate-400">
                              {row.workedMonthsInYear} tháng
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center text-slate-700">
                          {row.usedDays}
                        </td>
                        <td className="px-3 py-3 text-center text-slate-500">
                          {row.upcomingApprovedDays}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {row.pendingDays > 0 ? (
                            <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                              {row.pendingDays}
                            </span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-slate-900">
                          <span
                            className={`rounded-lg px-2 py-1 ${
                              row.remainingDays <= 2
                                ? "bg-red-50 text-red-700"
                                : row.remainingDays <= 5
                                ? "bg-amber-50 text-amber-800"
                                : "bg-emerald-50 text-emerald-800"
                            }`}
                          >
                            {row.remainingDays}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Đơn nghỉ */}
      {activeTab === "requests" && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 font-semibold text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Mã đơn / NV</th>
                    <th className="px-3 py-3">Loại nghỉ</th>
                    <th className="px-3 py-3">Thời gian nghỉ</th>
                    <th className="px-3 py-3">Số ngày</th>
                    <th className="px-4 py-3">Lý do</th>
                    <th className="px-3 py-3">Trạng thái</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.requests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Chưa có đơn xin nghỉ phép nào.
                      </td>
                    </tr>
                  ) : (
                    data.requests.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">
                            {r.employees?.full_name}
                          </div>
                          <div className="font-mono text-[11px] text-slate-400">
                            {r.employees?.employee_code}
                          </div>
                        </td>
                        <td className="px-3 py-3 font-medium text-slate-800">
                          {r.leave_types?.name}
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {r.start_date} → {r.end_date}
                        </td>
                        <td className="px-3 py-3 font-semibold text-slate-900">
                          {r.total_days} ngày
                        </td>
                        <td className="px-4 py-3 text-slate-600">{r.reason}</td>
                        <td className="px-3 py-3">
                          {r.status === "PENDING" && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                              Chờ duyệt
                            </span>
                          )}
                          {r.status === "APPROVED" && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                              Đã duyệt
                            </span>
                          )}
                          {r.status === "REJECTED" && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800">
                              Từ chối
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {r.status === "PENDING" ? (
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => handleDecision(r.id, "APPROVED")}
                                className="rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-700"
                              >
                                Duyệt
                              </button>
                              <button
                                onClick={() => handleDecision(r.id, "REJECTED")}
                                className="rounded bg-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-300"
                              >
                                Từ chối
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Quy định phép năm */}
      {activeTab === "policy" && (
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Điều 113 BLLĐ 2019
            </div>
            <div className="mt-2 text-xs font-semibold text-slate-700">
              Số ngày nghỉ hằng năm cơ bản:
            </div>
            <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
              <li>
                • <strong className="text-slate-800">12 ngày:</strong> Người lao động làm công
                việc trong điều kiện bình thường.
              </li>
              <li>
                • <strong className="text-slate-800">14 ngày:</strong> Lao động chưa thành niên,
                lao động là người khuyết tật, nghề/công việc nặng nhọc, độc hại, nguy hiểm.
              </li>
              <li>
                • <strong className="text-slate-800">16 ngày:</strong> Nghề, công việc đặc biệt
                nặng nhọc, độc hại, nguy hiểm.
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <Calendar className="h-5 w-5 text-blue-600" />
              Điều 114 BLLĐ 2019
            </div>
            <div className="mt-2 text-xs font-semibold text-slate-700">
              Tăng thêm theo thâm niên làm việc:
            </div>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              &ldquo;Cứ đủ <strong>05 năm</strong> làm việc cho một người sử dụng lao động thì số
              ngày nghỉ hằng năm của người lao động được tăng thêm tương ứng <strong>01 ngày</strong>
              .&rdquo;
            </p>
            <div className="mt-3 rounded-lg bg-blue-50 p-2.5 text-[11px] text-blue-900">
              VD: Làm việc đủ 5 năm: +1 ngày; đủ 10 năm: +2 ngày; đủ 15 năm: +3 ngày.
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <FileText className="h-5 w-5 text-amber-600" />
              Điều 66 NĐ 145/2020/NĐ-CP
            </div>
            <div className="mt-2 text-xs font-semibold text-slate-700">
              Cách tính cho người làm việc chưa đủ năm:
            </div>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              Số ngày nghỉ = [(Số ngày nghỉ cơ bản + Phép thâm niên nếu có) / 12] × Số tháng làm
              việc thực tế. Kết quả từ 0,5 trở lên được làm tròn thành 1 ngày.
            </p>
            <div className="mt-3 rounded-lg bg-amber-50 p-2.5 text-[11px] text-amber-900">
              Thời hạn hết hạn phép tồn năm trước: ngày 31/03 năm tiếp theo.
            </div>
          </div>
        </div>
      )}

      {/* Modal Tạo đơn nghỉ phép */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Tạo Đơn Xin Nghỉ Phép</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLeave} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700">Loại nghỉ phép *</label>
                <select
                  value={leaveTypeId}
                  onChange={(e) => setLeaveTypeId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-emerald-600 focus:outline-none"
                >
                  {data.leaveTypes.map((lt) => (
                    <option key={lt.id} value={lt.id}>
                      {lt.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700">Từ ngày *</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700">Đến ngày *</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Số ngày nghỉ *</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  required
                  value={totalDays}
                  onChange={(e) => setTotalDays(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Lý do nghỉ phép *</label>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="VD: Nghỉ phép năm giải quyết việc gia đình"
                  className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-xs focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-emerald-700 px-5 py-2 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {submitting ? "Đang gửi..." : "Gửi đơn"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Employee Seniority & Leave Detail Drawer */}
      {selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {selectedEmployee.fullName}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedEmployee.employeeCode} · {selectedEmployee.departmentName}
                </p>
              </div>
              <button
                onClick={() => setSelectedEmployee(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
                <div>
                  <span className="text-slate-500">Ngày vào làm:</span>
                  <div className="font-semibold text-slate-800">
                    {selectedEmployee.hireDate}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Thâm niên thực tế:</span>
                  <div className="font-semibold text-emerald-800">
                    {selectedEmployee.seniorityDisplay}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-3">
                <div className="font-bold text-slate-900">Chi tiết định mức phép năm 2026:</div>
                <div className="mt-2 space-y-1.5 text-slate-600">
                  <div className="flex justify-between">
                    <span>Phép năm cơ bản (Điều 113 BLLĐ):</span>
                    <strong className="text-slate-900">{selectedEmployee.baseDays} ngày</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Phép tăng theo thâm niên (Điều 114 BLLĐ):</span>
                    <strong className="text-emerald-700">
                      +{selectedEmployee.seniorityBonus} ngày (mỗi 5 năm +1)
                    </strong>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-1.5 font-bold text-slate-900">
                    <span>Tổng quỹ phép năm:</span>
                    <span>{selectedEmployee.totalAnnualLeave} ngày</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-slate-100 p-2.5">
                  <div className="text-[11px] text-slate-500">Đã nghỉ</div>
                  <div className="text-base font-bold text-slate-800">
                    {selectedEmployee.usedDays}
                  </div>
                </div>
                <div className="rounded-xl bg-amber-50 p-2.5">
                  <div className="text-[11px] text-amber-700">Chờ duyệt</div>
                  <div className="text-base font-bold text-amber-800">
                    {selectedEmployee.pendingDays}
                  </div>
                </div>
                <div className="rounded-xl bg-emerald-50 p-2.5">
                  <div className="text-[11px] text-emerald-700">Khả dụng còn lại</div>
                  <div className="text-base font-bold text-emerald-800">
                    {selectedEmployee.remainingDays} ngày
                  </div>
                </div>
              </div>

              <div className="pt-2 text-right">
                <button
                  onClick={() => setSelectedEmployee(null)}
                  className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
