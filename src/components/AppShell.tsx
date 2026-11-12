"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Users,
  ShieldCheck,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Utensils,
  Wallet,
  CalendarOff,
  Clock3,
  FileSignature,
  UserPlus,
  Target,
  GraduationCap,
  Package,
  Activity,
  Menu,
  X,
  ChevronRight,
  Calculator,
  CheckSquare,
  ReceiptText,
  Settings,
} from "lucide-react";
import { FEATURE_FLAGS } from "@/lib/config/feature-flags";
import { getSupabaseBrowserAuthClient } from "@/lib/supabase/client";

interface MeState {
  authenticated: boolean;
  user?: {
    email: string;
    fullName: string;
    roles: string[];
    mfaVerified: boolean;
  };
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
  flag?: keyof typeof FEATURE_FLAGS;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Tổng quan",
    items: [{ href: "/", label: "Bảng điều khiển", icon: LayoutDashboard }],
  },
  {
    title: "Hằng ngày",
    items: [
      { href: "/attendance", label: "Chấm công", icon: MapPinned },
      { href: "/leave", label: "Nghỉ phép", icon: CalendarOff },
      { href: "/overtime", label: "Tăng ca (OT)", icon: Clock3 },
      {
        href: "/approvals",
        label: "Việc cần duyệt",
        icon: CheckSquare,
        roles: ["DEPARTMENT_MANAGER", "HR_ADMIN", "DIRECTOR"],
      },
    ],
  },
  {
    title: "Hằng tháng",
    items: [
      {
        href: "/payroll",
        label: "Bảng lương & Thuế",
        icon: Wallet,
        roles: ["HR_ADMIN", "HR_STAFF", "ACCOUNTANT", "DIRECTOR"],
      },
      { href: "/payslips", label: "Phiếu lương của tôi", icon: ReceiptText },
      {
        href: "/allowances",
        label: "Phụ cấp & Thưởng",
        icon: Utensils,
        roles: ["HR_ADMIN", "HR_STAFF", "ACCOUNTANT"],
      },
    ],
  },
  {
    title: "Nhân sự",
    items: [
      { href: "/employees", label: "Hồ sơ nhân sự", icon: Users },
      { href: "/contracts", label: "Hợp đồng & STK", icon: FileSignature },
      {
        href: "/org",
        label: "Sơ đồ tổ chức",
        icon: Building2,
        roles: ["HR_ADMIN", "HR_STAFF", "DEPARTMENT_MANAGER", "DIRECTOR"],
      },
      {
        href: "/recruitment",
        label: "Tuyển dụng",
        icon: UserPlus,
        roles: ["HR_ADMIN", "HR_STAFF", "DIRECTOR"],
        flag: "recruitment",
      },
      {
        href: "/performance",
        label: "Đánh giá KPI",
        icon: Target,
        flag: "performance",
      },
      {
        href: "/learning",
        label: "Đào tạo",
        icon: GraduationCap,
        flag: "learning",
      },
      {
        href: "/assets",
        label: "Tài sản",
        icon: Package,
        flag: "assets",
      },
      {
        href: "/bhxh-1-lan",
        label: "Tính BHXH 1 lần",
        icon: Calculator,
        flag: "bhxh1Lan",
      },
    ],
  },
  {
    title: "Quản trị",
    items: [
      {
        href: "/admin",
        label: "Cài đặt & Tham số",
        icon: Settings,
        roles: ["SUPER_ADMIN", "HR_ADMIN", "ACCOUNTANT", "DIRECTOR"],
      },
      {
        href: "/audit",
        label: "Nhật ký Audit",
        icon: Activity,
        roles: ["HR_ADMIN", "ACCOUNTANT", "DIRECTOR", "AUDITOR"],
      },
      { href: "/privacy", label: "Quyền riêng tư PDPL", icon: ShieldCheck },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<MeState | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (pathname === "/login") return;
    let active = true;
    fetch("/api/v1/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!active) return;
        const d = json?.data;
        if (d?.userId) {
          setMe({
            authenticated: true,
            user: {
              email: d.email ?? "",
              fullName: d.employeeProfile?.full_name ?? d.email ?? "Người dùng",
              roles: Array.isArray(d.roles) ? d.roles : ["EMPLOYEE"],
              mfaVerified: Boolean(d.mfaVerified),
            },
          });
        } else {
          setMe({ authenticated: false });
        }
      })
      .catch(() => {
        if (active) setMe({ authenticated: false });
      });
    return () => {
      active = false;
    };
  }, [pathname]);

  const userRoles = useMemo(() => me?.user?.roles ?? [], [me]);

  const visibleGroups = useMemo(() => {
    return NAV_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((item) => {
        if (item.flag && !FEATURE_FLAGS[item.flag]) return false;
        if (item.roles && item.roles.length > 0) {
          return item.roles.some((r) => userRoles.includes(r));
        }
        return true;
      }),
    })).filter((g) => g.items.length > 0);
  }, [userRoles]);

  const allVisibleItems = useMemo(
    () => visibleGroups.flatMap((g) => g.items),
    [visibleGroups]
  );

  const mobileQuickItems = useMemo(() => {
    const isManager = userRoles.some((r) =>
      ["DEPARTMENT_MANAGER", "HR_ADMIN", "DIRECTOR"].includes(r)
    );
    const isPayroll = userRoles.some((r) =>
      ["HR_ADMIN", "HR_STAFF", "ACCOUNTANT", "DIRECTOR"].includes(r)
    );
    const items: Array<{
      href: string;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
    }> = [
      { href: "/", label: "Tổng quan", icon: LayoutDashboard },
      { href: "/attendance", label: "Chấm công", icon: MapPinned },
    ];
    if (isManager) {
      items.push({ href: "/approvals", label: "Duyệt", icon: CheckSquare });
    } else {
      items.push({ href: "/leave", label: "Nghỉ phép", icon: CalendarOff });
    }
    if (isPayroll) {
      items.push({ href: "/payroll", label: "Bảng lương", icon: Wallet });
    } else {
      items.push({ href: "/payslips", label: "Phiếu lương", icon: ReceiptText });
    }
    return items;
  }, [userRoles]);

  async function handleSignOut() {
    const supabase = getSupabaseBrowserAuthClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    await fetch("/api/v1/auth/logout", { method: "POST" }).catch(() => {});
    setMe({ authenticated: false });
    setMobileOpen(false);
    router.push("/login");
    router.refresh();
  }

  // Hide navigation completely on /login or when unauthenticated
  if (pathname === "/login" || (me !== null && !me.authenticated)) {
    return <div className="min-h-screen bg-slate-50 text-slate-900">{children}</div>;
  }

  const currentNav = allVisibleItems.find((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
  );

  const sidebarContent = (
    <div className="flex h-full flex-col bg-slate-950 text-slate-200">
      <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-4">
        <Link
          href="/"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-sm font-extrabold text-white shadow-sm">
            TKV
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-white">
              THẾ KỶ VÀNG
            </div>
            <div className="text-[11px] text-slate-400">HRM • Tây Ninh</div>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
          aria-label="Đóng menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {visibleGroups.map((group) => (
          <div key={group.title}>
            <div className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {group.title}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`group flex min-h-[40px] items-center justify-between rounded-xl px-3 py-2 text-[13px] font-medium transition ${
                      isActive
                        ? "bg-amber-500/15 text-amber-400 shadow-inner"
                        : "text-slate-300 hover:bg-slate-900 hover:text-white"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon
                        className={`h-4 w-4 ${
                          isActive
                            ? "text-amber-400"
                            : "text-slate-400 group-hover:text-slate-200"
                        }`}
                      />
                      {item.label}
                    </span>
                    {isActive && <ChevronRight className="h-3.5 w-3.5 text-amber-400" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-800/80 p-3">
        {me?.user && (
          <div className="rounded-xl bg-slate-900/90 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-white">
                  {me.user.fullName}
                </div>
                <div className="truncate text-[11px] text-amber-400">
                  {me.user.roles.join(", ")}
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                title="Đăng xuất"
                aria-label="Đăng xuất"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 text-slate-300 transition hover:bg-slate-800 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 lg:flex">
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:block lg:w-64">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 w-72 max-w-[85vw] shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 lg:hidden"
                aria-label="Mở menu điều hướng"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <div className="text-sm font-bold text-slate-900 sm:text-base">
                  {currentNav?.label ?? "THẾ KỶ VÀNG HRM"}
                </div>
                <div className="hidden text-[11px] text-slate-500 sm:block">
                  Công ty TNHH Thương mại Thế Kỷ Vàng • Tây Ninh
                </div>
              </div>
            </div>

            {me?.user && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-600 text-xs font-bold text-white">
                    {me.user.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden text-left sm:block">
                    <div className="text-xs font-semibold leading-none text-slate-900">
                      {me.user.fullName}
                    </div>
                    <div className="mt-0.5 text-[10px] leading-none text-slate-500">
                      {me.user.roles[0]}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Đăng xuất</span>
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-5 pb-24 sm:px-6 lg:py-7 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Quick Bar (44px+ touch targets) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/95 backdrop-blur-md lg:hidden">
        {mobileQuickItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-[52px] flex-col items-center justify-center py-1.5 text-[10px] font-medium ${
                isActive ? "text-amber-600" : "text-slate-500"
              }`}
            >
              <Icon className="mb-0.5 h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex min-h-[52px] flex-col items-center justify-center py-1.5 text-[10px] font-medium text-slate-500"
        >
          <Menu className="mb-0.5 h-4 w-4" />
          <span>Tất cả</span>
        </button>
      </nav>
    </div>
  );
}
