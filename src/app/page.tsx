"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarOff,
  CheckSquare,
  Clock3,
  FileSignature,
  MapPinned,
  ReceiptText,
  Users,
  Wallet,
} from "lucide-react";
import { ErrorRetry, SkeletonBlock } from "@/components/ui/StateViews";
import { formatCurrencyVi, formatDateVi, translateEnumVi } from "@/lib/i18n/format";

interface DashboardPayload {
  scope: "EMPLOYEE" | "MANAGER" | "EXEC_HR";
  company: { legal_name: string; tax_code: string };
  selfMetrics?: {
    todayCheckins: number;
    monthWorkDays: number;
    remainingLeaveDays: number;
    pendingRequests: number;
    latestNetPay: number | null;
  };
  managerMetrics?: {
    presentToday: number;
    pendingLeave: number;
    pendingOvertime: number;
    pendingExceptions: number;
    totalPendingApprovals: number;
  };
  metrics?: {
    totalEmployees: number;
    presentToday: number;
    lateToday: number;
    pendingApprovals: number;
    expiringContractsCount: number;
    lowLeaveEmployeesCount: number;
  };
  latestPayrollRun?: {
    id: string;
    run_type: string;
    status: string;
    total_employees: number;
    total_net_payable: number;
    payroll_periods: { period_code: string } | null;
  } | null;
  expiringContracts?: Array<{
    id: string;
    contract_no: string;
    effective_to: string;
    employees: { employee_code: string; full_name: string } | null;
  }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/v1/dashboard", { cache: "no-store" })
      .then(async (res) => {
        if (!active) return;
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          setError(json.error?.message ?? "Không thể tải bảng điều khiển.");
          return;
        }
        const json = await res.json();
        setData(json.data);
      })
      .catch(() => {
        if (active) setError("Lỗi kết nối máy chủ.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadTick]);

  if (loading) return <SkeletonBlock rows={5} />;
  if (error || !data) {
    return (
      <ErrorRetry
        message={error ?? "Vui lòng đăng nhập lại để xem dữ liệu."}
        onRetry={load}
      />
    );
  }

  // 1. EMPLOYEE MOBILE-FIRST PORTAL
  if (data.scope === "EMPLOYEE" && data.selfMetrics) {
    const m = data.selfMetrics;
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Cổng Nhân viên</h1>
          <p className="text-xs text-slate-500">{data.company.legal_name}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="text-xs text-slate-500">Chấm công hôm nay</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {m.todayCheckins > 0 ? `${m.todayCheckins} lượt` : "Chưa chấm"}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="text-xs text-slate-500">Công tháng này</div>
            <div className="mt-1 text-2xl font-bold text-emerald-700">
              {m.monthWorkDays} công
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="text-xs text-slate-500">Phép năm còn lại</div>
            <div className="mt-1 text-2xl font-bold text-blue-700">
              {m.remainingLeaveDays} ngày
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="text-xs text-slate-500">Thực nhận kỳ gần nhất</div>
            <div className="mt-1 text-xl font-bold text-amber-700">
              {m.latestNetPay !== null ? formatCurrencyVi(m.latestNetPay) : "Chưa có"}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Link
            href="/attendance"
            className="flex min-h-[64px] items-center justify-between rounded-2xl bg-slate-900 p-4 text-white shadow-xs transition hover:bg-slate-800"
          >
            <div className="flex items-center gap-3">
              <MapPinned className="h-5 w-5 text-amber-400" />
              <div>
                <div className="text-sm font-bold">Chấm công GPS</div>
                <div className="text-[11px] text-slate-300">Vào / Ra ca làm việc</div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4" />
          </Link>

          <Link
            href="/leave"
            className="flex min-h-[64px] items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-xs transition hover:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              <CalendarOff className="h-5 w-5 text-amber-600" />
              <div>
                <div className="text-sm font-bold">Xin nghỉ phép / OT</div>
                <div className="text-[11px] text-slate-500">
                  Đang chờ duyệt: {m.pendingRequests} đơn
                </div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400" />
          </Link>

          <Link
            href="/payslips"
            className="flex min-h-[64px] items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-xs transition hover:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              <ReceiptText className="h-5 w-5 text-emerald-600" />
              <div>
                <div className="text-sm font-bold">Phiếu lương của tôi</div>
                <div className="text-[11px] text-slate-500">Xem chi tiết &amp; tải PDF</div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400" />
          </Link>
        </div>
      </div>
    );
  }

  // 2. MANAGER DASHBOARD
  if (data.scope === "MANAGER" && data.managerMetrics) {
    const mm = data.managerMetrics;
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Tổng quan Quản lý</h1>
          <p className="text-xs text-slate-500">Theo dõi quân số hôm nay và xử lý đơn chờ duyệt.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="text-xs text-slate-500">Đi làm hôm nay</div>
            <div className="mt-1 text-2xl font-bold text-emerald-700">{mm.presentToday}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="text-xs text-slate-500">Nghỉ phép chờ duyệt</div>
            <div className="mt-1 text-2xl font-bold text-amber-600">{mm.pendingLeave}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="text-xs text-slate-500">Tăng ca chờ duyệt</div>
            <div className="mt-1 text-2xl font-bold text-amber-600">{mm.pendingOvertime}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="text-xs text-slate-500">Giải trình công chờ duyệt</div>
            <div className="mt-1 text-2xl font-bold text-rose-600">{mm.pendingExceptions}</div>
          </div>
        </div>

        <Link
          href="/approvals"
          className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <CheckSquare className="h-4 w-4 text-amber-400" />
          Mở Việc cần duyệt ({mm.totalPendingApprovals} đơn)
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  // 3. HR / ACCOUNTANT / DIRECTOR 6-KPI DASHBOARD
  const em = data.metrics!;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Tổng quan Điều hành &amp; Nhân sự</h1>
        <p className="text-xs text-slate-500">
          {data.company.legal_name} • MST {data.company.tax_code}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Đi làm hôm nay</span>
            <Users className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900">
            {em.presentToday} / {em.totalEmployees}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Đi trễ hôm nay</span>
            <Clock3 className="h-4 w-4 text-rose-600" />
          </div>
          <div className="mt-1 text-2xl font-bold text-rose-600">{em.lateToday}</div>
        </div>

        <Link
          href="/approvals"
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-amber-300"
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Đơn chờ duyệt</span>
            <CheckSquare className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-1 text-2xl font-bold text-amber-600">{em.pendingApprovals}</div>
        </Link>

        <Link
          href="/payroll"
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-amber-300"
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Quỹ lương kỳ gần nhất</span>
            <Wallet className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-1 text-xl font-bold text-slate-900">
            {data.latestPayrollRun
              ? formatCurrencyVi(data.latestPayrollRun.total_net_payable)
              : "Chưa có kỳ"}
          </div>
          {data.latestPayrollRun && (
            <div className="mt-0.5 text-[11px] text-slate-500">
              {data.latestPayrollRun.payroll_periods?.period_code} •{" "}
              {translateEnumVi(data.latestPayrollRun.status)}
            </div>
          )}
        </Link>

        <Link
          href="/contracts"
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-amber-300"
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Hợp đồng sắp hết hạn (45 ngày)</span>
            <FileSignature className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900">
            {em.expiringContractsCount}
          </div>
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Nhân sự sắp hết phép (≤ 2 ngày)</span>
            <CalendarOff className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-1 text-2xl font-bold text-blue-700">
            {em.lowLeaveEmployeesCount}
          </div>
        </div>
      </div>

      {data.expiringContracts && data.expiringContracts.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900">Hợp đồng sắp hết hạn</h2>
          <div className="mt-2 divide-y divide-slate-100 text-xs">
            {data.expiringContracts.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2">
                <span>
                  <span className="font-semibold">{c.employees?.employee_code}</span> —{" "}
                  {c.employees?.full_name} ({c.contract_no})
                </span>
                <span className="font-mono text-amber-700">{formatDateVi(c.effective_to)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
