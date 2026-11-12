"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Building2,
  Users,
  ShieldCheck,
  LayoutDashboard,
  LogIn,
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
} from "lucide-react";
import { getSupabaseBrowserAuthClient } from "@/lib/supabase/client";

interface MeResponse {
  authenticated: boolean;
  user?: {
    email: string;
    fullName: string;
    roles: string[];
    mfaVerified: boolean;
  };
}

interface NavGroup {
  title: string;
  items: Array<{
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }>;
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Tổng quan",
    items: [{ href: "/", label: "Bảng điều khiển", icon: LayoutDashboard }],
  },
  {
    title: "Tổ chức & Nhân sự",
    items: [
      { href: "/org", label: "Sơ đồ Tổ chức", icon: Building2 },
      { href: "/employees", label: "Hồ sơ Nhân sự", icon: Users },
      { href: "/contracts", label: "Hợp đồng & STK", icon: FileSignature },
      { href: "/recruitment", label: "Tuyển dụng & Offer", icon: UserPlus },
    ],
  },
  {
    title: "Chấm công & Phúc lợi",
    items: [
      { href: "/attendance", label: "Chấm công GPS/Face", icon: MapPinned },
      { href: "/leave", label: "Nghỉ phép", icon: CalendarOff },
      { href: "/overtime", label: "Tăng ca (OT)", icon: Clock3 },
      { href: "/allowances", label: "Phụ cấp & Thưởng", icon: Utensils },
    ],
  },
  {
    title: "Tiền lương & Phát triển",
    items: [
      { href: "/payroll", label: "Bảng lương & Thuế", icon: Wallet },
      { href: "/bhxh-1-lan", label: "Tính BHXH 1 lần", icon: Calculator },
      { href: "/performance", label: "Đánh giá KPI", icon: Target },
      { href: "/learning", label: "Đào tạo & Chứng chỉ", icon: GraduationCap },
      { href: "/assets", label: "Tài sản & Bàn giao", icon: Package },
    ],
  },
  {
    title: "Tuân thủ & Kiểm toán",
    items: [
      { href: "/privacy", label: "Quyền riêng tư PDPL", icon: ShieldCheck },
      { href: "/audit", label: "Nhật ký Audit", icon: Activity },
    ],
  },
];

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

const MOBILE_QUICK_ITEMS = [
  { href: "/", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/employees", label: "Nhân sự", icon: Users },
  { href: "/attendance", label: "Chấm công", icon: MapPinned },
  { href: "/payroll", label: "Lương", icon: Wallet },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/v1/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (active) setMe(d);
      })
      .catch(() => {
        if (active) setMe({ authenticated: false });
      });
    return () => {
      active = false;
    };
  }, [pathname]);

  async function handleSignOut() {
    const supabase = getSupabaseBrowserAuthClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setMe({ authenticated: false });
    setMobileOpen(false);
    router.push("/login");
    router.refresh();
  }

  if (pathname === "/login") {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">{children}</div>
    );
  }

  const currentNav = ALL_NAV_ITEMS.find((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
  );

  const sidebarContent = (
    <div className="flex h-full flex-col bg-slate-950 text-slate-200">
      {/* Brand */}
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
            <div className="text-[11px] text-slate-400">
              Enterprise HRM • Vùng III
            </div>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
          aria-label="Đóng menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
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
                    className={`group flex items-center justify-between rounded-xl px-3 py-2 text-[13px] font-medium transition ${
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

      {/* Sidebar Footer / User Info */}
      <div className="border-t border-slate-800/80 p-3">
        {me?.authenticated && me.user ? (
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
                className="rounded-lg border border-slate-700 p-1.5 text-slate-300 transition hover:bg-slate-800 hover:text-white"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <Link
            href="/login"
            onClick={() => setMobileOpen(false)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-500"
          >
            <LogIn className="h-3.5 w-3.5" />
            Đăng nhập hệ thống
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 lg:flex">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:block lg:w-64">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
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

      {/* Main Content Area */}
      <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
        {/* Sticky Top Bar */}
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 lg:hidden"
                aria-label="Mở menu điều hướng"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div>
                <div className="text-sm font-bold text-slate-900 sm:text-base">
                  {currentNav?.label ?? "THẾ KỶ VÀNG HRM"}
                </div>
                <div className="hidden text-[11px] text-slate-500 sm:block">
                  Công ty TNHH Thương mại Thế Kỷ Vàng • MST 3900336463
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 md:inline-flex">
                QĐ 13/2026/QĐ-TKV
              </span>
              {me?.authenticated && me.user ? (
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-600 text-[11px] font-bold text-white">
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
              ) : (
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Đăng nhập
                </Link>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 pb-24 sm:px-6 lg:py-7 lg:pb-8">
          {children}
        </main>

        <footer className="hidden border-t border-slate-200 bg-white py-3.5 text-xs text-slate-500 lg:block">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6">
            <div>
              CÔNG TY TNHH THƯƠNG MẠI THẾ KỶ VÀNG (MST: 3900336463) • Vùng III Tây Ninh
            </div>
            <div className="flex items-center gap-2 text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>RLS Enabled • PII AES-256-GCM • Supabase + Vercel sin1</span>
            </div>
          </div>
        </footer>
      </div>

      {/* Mobile Bottom Quick Bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/95 backdrop-blur-md lg:hidden">
        {MOBILE_QUICK_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-2 text-[10px] font-medium ${
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
          className="flex flex-col items-center justify-center py-2 text-[10px] font-medium text-slate-500"
        >
          <Menu className="mb-0.5 h-4 w-4" />
          <span>Tất cả</span>
        </button>
      </nav>
    </div>
  );
}
