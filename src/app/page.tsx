"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Users,
  CalendarOff,
  Clock3,
  FileSignature,
  Wallet,
  Package,
  GraduationCap,
  MapPin,
  ArrowRight,
  LogIn,
  ShieldCheck,
  Activity,
  Building2,
  MapPinned,
  UserPlus,
} from "lucide-react";

interface DashboardPayload {
  company: { legal_name: string; tax_code: string };
  metrics: {
    totalEmployees: number;
    activeEmployees: number;
    probationEmployees: number;
    pendingLeave: number;
    pendingOvertime: number;
    expiringContractsCount: number;
    totalAssets: number;
    assignedAssets: number;
    mandatoryCourses: number;
    completedEnrollments: number;
    totalEnrollments: number;
  };
  latestPayrollRun: {
    id: string;
    run_type: string;
    status: string;
    total_employees: number;
    total_net_payable: number;
    payroll_periods: { period_code: string } | null;
  } | null;
  expiringContracts: Array<{
    id: string;
    contract_no: string;
    effective_to: string;
    employees: { employee_code: string; full_name: string } | null;
  }>;
  departmentBreakdown: Array<{ name: string; count: number }>;
  recentAudit: Array<{
    id: string;
    actor_role: string | null;
    action: string;
    target_entity: string;
    created_at: string;
  }>;
  locations: Array<{
    id: string;
    code: string;
    name: string;
    address: string;
    geofence_radius_m: number;
  }>;
}

const fmtVnd = (n: number) => `${Math.round(Number(n)).toLocaleString("vi-VN")} đ`;

export default function HomePage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [unauthenticated, setUnauthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/v1/dashboard", { cache: "no-store" })
      .then(async (res) => {
        if (!active) return;
        if (res.status === 401) {
          setUnauthenticated(true);
          return;
        }
        const json = await res.json();
        if (res.ok && json.data) {
          setData(json.data);
          setUnauthenticated(false);
        }
      })
      .catch(() => {
        // ignore network errors cleanly
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-32 animate-pulse rounded-2xl bg-slate-200/70" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200/70" />
          ))}
        </div>
      </div>
    );
  }

  if (unauthenticated || !data) {
    return (
      <div className="space-y-6">
        <section className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950 p-6 text-white shadow-lg sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Phase 1–4 Enterprise HRM • QĐ 13/2026/QĐ-TKV
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
            Hệ thống Quản trị Nhân sự &amp; Tiền lương Thế Kỷ Vàng
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
            Quản lý tập trung hồ sơ nhân sự, chấm công GPS/Face ID, nghỉ phép, tăng ca,
            bảng lương BHXH &amp; thuế TNCN, KPI, đào tạo và tài sản công ty trên nền tảng
            bảo mật PDPL (AES-256-GCM + RLS).
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
            >
              <LogIn className="h-4 w-4" />
              Đăng nhập để bắt đầu
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const m = data.metrics;
  const maxDept = Math.max(...data.departmentBreakdown.map((d) => d.count), 1);

  return (
    <div className="space-y-6">
      {/* Executive Welcome & Quick Actions */}
      <section className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 p-5 text-white shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
              <Building2 className="h-3 w-3" />
              {data.company.legal_name} • MST {data.company.tax_code}
            </div>
            <h1 className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">
              Bảng điều khiển Nhân sự Tổng hợp
            </h1>
            <p className="mt-1 text-xs text-slate-300 sm:text-sm">
              Theo dõi biến động nhân sự, phê duyệt đơn từ, kỳ lương và tuân thủ theo thời gian thực.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/attendance"
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-semibold text-slate-950 transition hover:bg-amber-400"
            >
              <MapPinned className="h-3.5 w-3.5" />
              Chấm công GPS
            </Link>
            <Link
              href="/employees"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Hồ sơ Nhân sự
            </Link>
            <Link
              href="/payroll"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              <Wallet className="h-3.5 w-3.5" />
              Bảng lương
            </Link>
          </div>
        </div>
      </section>

      {/* Primary KPI Cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link
          href="/employees"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-amber-300 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Tổng nhân sự hiện hữu</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900">{m.totalEmployees}</div>
          <div className="mt-1 text-xs text-slate-600">
            Chính thức: <span className="font-semibold text-emerald-700">{m.activeEmployees}</span> • Thử việc:{" "}
            <span className="font-semibold text-amber-700">{m.probationEmployees}</span>
          </div>
        </Link>

        <Link
          href="/leave"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-amber-300 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Đơn chờ phê duyệt</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <CalendarOff className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900">
            {m.pendingLeave + m.pendingOvertime}
          </div>
          <div className="mt-1 text-xs text-slate-600">
            Nghỉ phép: <span className="font-semibold">{m.pendingLeave}</span> • Tăng ca OT:{" "}
            <span className="font-semibold">{m.pendingOvertime}</span>
          </div>
        </Link>

        <Link
          href="/payroll"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-amber-300 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Kỳ lương gần nhất</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900">
            {data.latestPayrollRun?.payroll_periods?.period_code ?? "Chưa có"}
          </div>
          <div className="mt-1 text-xs text-slate-600">
            {data.latestPayrollRun
              ? `${data.latestPayrollRun.status} • ${fmtVnd(data.latestPayrollRun.total_net_payable)}`
              : "Chưa chạy bảng lương"}
          </div>
        </Link>

        <Link
          href="/assets"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-amber-300 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Tài sản &amp; Đào tạo</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900">
            {m.assignedAssets}/{m.totalAssets} TS
          </div>
          <div className="mt-1 text-xs text-slate-600">
            Đào tạo hoàn thành:{" "}
            <span className="font-semibold">
              {m.completedEnrollments}/{m.totalEnrollments}
            </span>{" "}
            lượt
          </div>
        </Link>
      </section>

      {/* Main Analytics & Alerts Grid */}
      <section className="grid gap-6 lg:grid-cols-3">
        {/* Department Headcount Breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Phân bổ nhân sự theo phòng ban
            </h2>
            <Link
              href="/org"
              className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:underline"
            >
              Xem sơ đồ <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {data.departmentBreakdown.map((dept) => {
              const pct = Math.round((dept.count / maxDept) * 100);
              return (
                <div key={dept.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{dept.name}</span>
                    <span className="font-semibold text-slate-900">{dept.count} NV</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {data.departmentBreakdown.length === 0 && (
              <div className="py-6 text-center text-xs text-slate-500">
                Chưa có dữ liệu phân bổ phòng ban.
              </div>
            )}
          </div>
        </div>

        {/* Alerts & Action Items */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <FileSignature className="h-4 w-4 text-amber-600" />
                HĐLĐ sắp hết hạn ({m.expiringContractsCount})
              </h2>
              <Link href="/contracts" className="text-xs font-medium text-amber-700 hover:underline">
                Chi tiết
              </Link>
            </div>
            <div className="mt-3 space-y-2">
              {data.expiringContracts.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-xl bg-amber-50/70 px-3 py-2 text-xs"
                >
                  <div>
                    <div className="font-semibold text-slate-900">
                      {c.employees?.full_name ?? "Nhân viên"}
                    </div>
                    <div className="text-[11px] text-slate-600">{c.contract_no}</div>
                  </div>
                  <span className="font-mono text-[11px] font-semibold text-amber-800">
                    {c.effective_to}
                  </span>
                </div>
              ))}
              {data.expiringContracts.length === 0 && (
                <div className="py-3 text-xs text-slate-500">
                  Không có hợp đồng hết hạn trong 45 ngày tới.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Activity className="h-4 w-4 text-slate-700" />
                Hoạt động gần đây
              </h2>
              <Link href="/audit" className="text-xs font-medium text-amber-700 hover:underline">
                Audit Log
              </Link>
            </div>
            <div className="mt-3 divide-y divide-slate-100">
              {data.recentAudit.map((ev) => (
                <div key={ev.id} className="py-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-slate-800">{ev.action}</span>
                    <span className="text-[10px] text-slate-400">
                      {ev.created_at.slice(11, 16)}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {ev.actor_role ?? "SYSTEM"} • {ev.target_entity}
                  </div>
                </div>
              ))}
              {data.recentAudit.length === 0 && (
                <div className="py-3 text-xs text-slate-500">Chưa có hoạt động nào.</div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Locations & Quick Module Links */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <MapPin className="h-4 w-4 text-amber-600" />
            4 Chi nhánh &amp; Địa điểm làm việc (Vùng III — Tây Ninh)
          </div>
          <div className="mt-3 divide-y divide-slate-100">
            {data.locations.map((loc) => (
              <div key={loc.id} className="flex items-center justify-between py-2.5 text-xs">
                <div>
                  <div className="font-semibold text-slate-900">{loc.name}</div>
                  <div className="text-[11px] text-slate-500">{loc.address}</div>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-[11px] text-slate-700">
                  Geofence {loc.geofence_radius_m}m
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <GraduationCap className="h-4 w-4 text-sky-600" />
            Truy cập nhanh các phân hệ nghiệp vụ
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2.5 text-xs sm:grid-cols-3">
            {[
              { href: "/recruitment", label: "Tuyển dụng & Offer", icon: UserPlus },
              { href: "/overtime", label: "Tăng ca (OT)", icon: Clock3 },
              { href: "/allowances", label: "Tiền ăn & Phụ cấp", icon: Wallet },
              { href: "/performance", label: "Đánh giá KPI", icon: Activity },
              { href: "/learning", label: "Đào tạo & Chứng chỉ", icon: GraduationCap },
              { href: "/privacy", label: "Tuân thủ PDPL", icon: ShieldCheck },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 font-medium text-slate-700 transition hover:border-amber-300 hover:bg-amber-50/40 hover:text-slate-900"
                >
                  <Icon className="h-4 w-4 text-amber-600" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
