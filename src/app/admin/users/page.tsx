"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Users,
  UserPlus,
  ShieldCheck,
  KeyRound,
  Lock,
  Unlock,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Eye,
  EyeOff,
  UserCheck,
  Building2,
  Calendar,
  Sparkles,
} from "lucide-react";
import { EmptyState, SkeletonBlock } from "@/components/ui/StateViews";

interface RoleItem {
  id: string;
  code: string;
  name: string;
  description?: string;
}

interface UserItem {
  id: string;
  email: string;
  status: "ACTIVE" | "LOCKED" | "DISABLED";
  employeeId: string | null;
  employeeCode: string | null;
  fullName: string;
  departmentName: string;
  roles: Array<{ id: string; code: string; name: string }>;
  createdAt: string;
  lastLoginAt: string | null;
}

interface EmployeeOption {
  id: string;
  employeeCode: string;
  fullName: string;
  departmentName: string;
}

interface ApiResponse {
  users: UserItem[];
  availableRoles: RoleItem[];
  employees: EmployeeOption[];
}

const ROLE_BADGE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  SUPER_ADMIN: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  DIRECTOR: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  HR_ADMIN: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  ACCOUNTANT: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200" },
  DEPARTMENT_MANAGER: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  HR_STAFF: { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200" },
  EMPLOYEE: { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200" },
  AUDITOR: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
};

export default function AdminUsersPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modals State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  // Active User for editing
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);

  // Form: Create User
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createEmployeeId, setCreateEmployeeId] = useState("");
  const [createRoles, setCreateRoles] = useState<string[]>(["EMPLOYEE"]);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [submittingCreate, setSubmittingCreate] = useState(false);

  // Form: Edit Roles
  const [editingRoles, setEditingRoles] = useState<string[]>([]);
  const [submittingRoles, setSubmittingRoles] = useState(false);

  // Form: Reset Password
  const [resetPassword, setResetPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [submittingPassword, setSubmittingPassword] = useState(false);

  // Load Data
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch("/api/v1/admin/users", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!active) return;
        if (!res.ok) {
          setError(json.error?.message ?? "Không thể tải danh sách người dùng.");
          return;
        }
        setData(json.data);
        setError(null);
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

  const reload = useCallback(() => {
    setReloadTick((t) => t + 1);
  }, []);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    if (!data?.users) return [];
    return data.users.filter((u) => {
      const matchSearch =
        search.trim() === "" ||
        u.fullName.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        (u.employeeCode && u.employeeCode.toLowerCase().includes(search.toLowerCase()));

      const matchRole =
        roleFilter === "ALL" || u.roles.some((r) => r.code === roleFilter);

      const matchStatus = statusFilter === "ALL" || u.status === statusFilter;

      return matchSearch && matchRole && matchStatus;
    });
  }, [data?.users, search, roleFilter, statusFilter]);

  // Generate safe random password
  function generateRandomPassword() {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
    let pwd = "";
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd;
  }

  // Handle Employee selection when creating user
  function handleSelectEmployeeForUser(empId: string) {
    setCreateEmployeeId(empId);
    if (!empId) return;
    const emp = data?.employees.find((e) => e.id === empId);
    if (emp) {
      // Auto-suggest email based on code
      const suggestedEmail = `${emp.employeeCode.toLowerCase()}@thekyvang.vn`;
      setCreateEmail(suggestedEmail);
      if (!createPassword) {
        setCreatePassword("Tkv@2026!");
      }
    }
  }

  // Submit Create User
  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingCreate(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/v1/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: createEmail,
          password: createPassword,
          employeeId: createEmployeeId || null,
          roleCodes: createRoles,
          status: "ACTIVE",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Tạo người dùng thất bại.");
        return;
      }
      setSuccessMsg(`Đã tạo tài khoản thành công cho ${createEmail}.`);
      setIsCreateModalOpen(false);
      setCreateEmail("");
      setCreatePassword("");
      setCreateEmployeeId("");
      setCreateRoles(["EMPLOYEE"]);
      reload();
    } finally {
      setSubmittingCreate(false);
    }
  }

  // Submit Update Roles
  async function handleUpdateRoles(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;
    setSubmittingRoles(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/v1/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          roleCodes: editingRoles,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Cập nhật phân quyền thất bại.");
        return;
      }
      setSuccessMsg(`Đã cập nhật phân quyền cho tài khoản ${selectedUser.email}.`);
      setIsRoleModalOpen(false);
      reload();
    } finally {
      setSubmittingRoles(false);
    }
  }

  // Submit Reset Password
  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;
    setSubmittingPassword(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/v1/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          newPassword: resetPassword,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Đặt lại mật khẩu thất bại.");
        return;
      }
      setSuccessMsg(`Đã đặt lại mật khẩu mới cho ${selectedUser.email}.`);
      setIsPasswordModalOpen(false);
      setResetPassword("");
      reload();
    } finally {
      setSubmittingPassword(false);
    }
  }

  // Toggle User Status (Lock / Unlock)
  async function handleToggleStatus(user: UserItem) {
    const nextStatus = user.status === "ACTIVE" ? "LOCKED" : "ACTIVE";
    const confirmText =
      nextStatus === "LOCKED"
        ? `Bạn có chắc muốn KHÓA tài khoản ${user.email}? Người dùng sẽ không thể đăng nhập.`
        : `MỞ KHÓA tài khoản ${user.email}?`;
    if (!window.confirm(confirmText)) return;

    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/v1/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          status: nextStatus,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Cập nhật trạng thái thất bại.");
        return;
      }
      setSuccessMsg(
        nextStatus === "LOCKED"
          ? `Đã khóa tài khoản ${user.email}.`
          : `Đã mở khóa tài khoản ${user.email}.`
      );
      reload();
    } catch {
      setError("Lỗi kết nối máy chủ.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 text-xl font-bold text-slate-900">
            <UserCheck className="h-6 w-6 text-amber-600" />
            Quản lý Người dùng &amp; Phân quyền RBAC
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Khởi tạo tài khoản nhân viên, gán vai trò quyền hạn và quản lý mật khẩu bảo mật theo tiêu chuẩn Enterprise.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reload}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Làm mới
          </button>
          <button
            type="button"
            onClick={() => {
              setCreateEmail("");
              setCreatePassword("Tkv@2026!");
              setCreateEmployeeId("");
              setCreateRoles(["EMPLOYEE"]);
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-amber-700"
          >
            <UserPlus className="h-4 w-4" />
            Thêm người dùng mới
          </button>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 animate-in fade-in">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg(null)} className="ml-auto text-emerald-400 hover:text-emerald-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Tổng tài khoản</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{data?.users.length ?? 0}</div>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 shadow-xs">
          <div className="text-xs font-medium text-emerald-700">Đang hoạt động</div>
          <div className="mt-1 text-2xl font-bold text-emerald-800">
            {data?.users.filter((u) => u.status === "ACTIVE").length ?? 0}
          </div>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4 shadow-xs">
          <div className="text-xs font-medium text-rose-700">Tài khoản bị khóa</div>
          <div className="mt-1 text-2xl font-bold text-rose-800">
            {data?.users.filter((u) => u.status === "LOCKED").length ?? 0}
          </div>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 shadow-xs">
          <div className="text-xs font-medium text-amber-700">Nhân sự chưa có User</div>
          <div className="mt-1 text-2xl font-bold text-amber-800">
            {Math.max(
              0,
              (data?.employees.length ?? 0) -
                (data?.users.filter((u) => u.employeeId).length ?? 0)
            )}
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên, email, mã nhân viên..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:bg-white focus:outline-hidden"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs text-slate-700 focus:outline-hidden"
          >
            <option value="ALL">Tất cả vai trò</option>
            {data?.availableRoles.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs text-slate-700 focus:outline-hidden"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Hoạt động (Active)</option>
            <option value="LOCKED">Bị khóa (Locked)</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        {loading ? (
          <div className="p-6">
            <SkeletonBlock rows={5} />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Không tìm thấy người dùng"
              description="Thử thay đổi bộ lọc tìm kiếm hoặc thêm người dùng mới."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Người dùng / Nhân viên</th>
                  <th className="px-4 py-3">Phòng ban</th>
                  <th className="px-4 py-3">Vai trò quyền hạn</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Ngày tạo</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredUsers.map((u) => {
                  const initial = u.fullName.charAt(0).toUpperCase();
                  const isLocked = u.status === "LOCKED";
                  return (
                    <tr key={u.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white shadow-xs">
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                              <span>{u.fullName}</span>
                              {u.employeeCode && (
                                <span className="rounded-md bg-slate-100 px-1.5 py-0.2 text-[10px] font-mono text-slate-600">
                                  {u.employeeCode}
                                </span>
                              )}
                            </div>
                            <div className="truncate text-[11px] text-slate-500">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-slate-600">
                          <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{u.departmentName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((r) => {
                            const style =
                              ROLE_BADGE_STYLES[r.code] ?? ROLE_BADGE_STYLES.EMPLOYEE;
                            return (
                              <span
                                key={r.code}
                                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${style.bg} ${style.text} ${style.border}`}
                              >
                                {r.name.split("(")[0].trim()}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isLocked ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 border border-red-200">
                            <Lock className="h-3 w-3" />
                            Đã khóa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            Hoạt động
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-500">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString("vi-VN") : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {/* Phân quyền */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUser(u);
                              setEditingRoles(u.roles.map((r) => r.code));
                              setIsRoleModalOpen(true);
                            }}
                            title="Phân quyền vai trò"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 hover:text-amber-700"
                          >
                            <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                            Phân quyền
                          </button>

                          {/* Đổi Pass */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUser(u);
                              setResetPassword("Tkv@2026!");
                              setIsPasswordModalOpen(true);
                            }}
                            title="Đổi mật khẩu"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 hover:text-amber-700"
                          >
                            <KeyRound className="h-3.5 w-3.5 text-amber-600" />
                            Đổi pass
                          </button>

                          {/* Khóa / Mở khóa */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u)}
                            title={isLocked ? "Mở khóa tài khoản" : "Khóa tài khoản"}
                            className={`inline-flex items-center justify-center rounded-lg border p-1 text-[11px] ${
                              isLocked
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                : "border-slate-200 bg-white text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                            }`}
                          >
                            {isLocked ? (
                              <Unlock className="h-3.5 w-3.5" />
                            ) : (
                              <Lock className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* MODAL 1: TẠO NGƯỜI DÙNG MỚI */}
      {/* ============================================================ */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <UserPlus className="h-5 w-5 text-amber-600" />
                Thêm Người Dùng &amp; Phân Quyền Mới
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="mt-4 space-y-4 text-xs">
              {/* Chọn Nhân viên */}
              <div>
                <label className="block font-semibold text-slate-700">
                  Liên kết với Nhân viên (Tùy chọn)
                </label>
                <select
                  value={createEmployeeId}
                  onChange={(e) => handleSelectEmployeeForUser(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-amber-500 focus:outline-hidden"
                >
                  <option value="">-- Tài khoản quản trị độc lập (Không gắn nhân viên) --</option>
                  {data?.employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.employeeCode} — {emp.fullName} ({emp.departmentName})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  Chọn nhân viên để tự động đồng bộ thông tin hồ sơ và bảng chấm công.
                </p>
              </div>

              {/* Email */}
              <div>
                <label className="block font-semibold text-slate-700">
                  Email đăng nhập <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  placeholder="nguyenvana@thekyvang.vn"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-amber-500 focus:outline-hidden"
                />
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block font-semibold text-slate-700">
                    Mật khẩu khởi tạo <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setCreatePassword(generateRandomPassword())}
                    className="flex items-center gap-1 text-[11px] font-medium text-amber-600 hover:underline"
                  >
                    <Sparkles className="h-3 w-3" />
                    Tạo pass ngẫu nhiên
                  </button>
                </div>
                <div className="relative mt-1">
                  <input
                    type={showCreatePassword ? "text" : "password"}
                    required
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    className="w-full rounded-xl border border-slate-300 py-2 pl-3 pr-10 text-xs text-slate-900 focus:border-amber-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword(!showCreatePassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Chọn vai trò quyền hạn */}
              <div>
                <label className="block font-semibold text-slate-700">
                  Vai trò phân quyền (Chọn 1 hoặc nhiều) <span className="text-red-500">*</span>
                </label>
                <div className="mt-1.5 max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-2.5">
                  {data?.availableRoles.map((r) => {
                    const checked = createRoles.includes(r.code);
                    return (
                      <label
                        key={r.code}
                        className={`flex items-start gap-2.5 rounded-lg p-2 transition-colors cursor-pointer ${
                          checked ? "bg-amber-50/80 border border-amber-200" : "hover:bg-slate-100"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCreateRoles([...createRoles, r.code]);
                            } else {
                              setCreateRoles(createRoles.filter((c) => c !== r.code));
                            }
                          }}
                          className="mt-0.5 h-4 w-4 rounded-sm border-slate-300 text-amber-600 focus:ring-amber-500"
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 text-[11px]">{r.name}</div>
                          {r.description && (
                            <div className="text-[10px] text-slate-500 leading-tight">
                              {r.description}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingCreate}
                  className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {submittingCreate ? "Đang tạo tài khoản..." : "Tạo tài khoản & Phân quyền"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: CẬP NHẬT PHÂN QUYỀN VAI TRÒ */}
      {/* ============================================================ */}
      {isRoleModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                  <ShieldCheck className="h-5 w-5 text-blue-600" />
                  Cập nhật Phân quyền Vai trò
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Tài khoản: <strong className="text-slate-800">{selectedUser.fullName}</strong> ({selectedUser.email})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRoleModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateRoles} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Chọn các vai trò phân quyền cho người dùng này:
                </label>
                <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                  {data?.availableRoles.map((r) => {
                    const checked = editingRoles.includes(r.code);
                    return (
                      <label
                        key={r.code}
                        className={`flex items-start gap-2.5 rounded-lg p-2.5 transition-colors cursor-pointer border ${
                          checked
                            ? "bg-blue-50/80 border-blue-200 shadow-xs"
                            : "bg-white border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditingRoles([...editingRoles, r.code]);
                            } else {
                              setEditingRoles(editingRoles.filter((c) => c !== r.code));
                            }
                          }}
                          className="mt-0.5 h-4 w-4 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 text-xs">{r.name}</div>
                          {r.description && (
                            <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                              {r.description}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingRoles || editingRoles.length === 0}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {submittingRoles ? "Đang lưu..." : "Lưu phân quyền mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 3: ĐẶT LẠI MẬT KHẨU (RESET PASSWORD) */}
      {/* ============================================================ */}
      {isPasswordModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                  <KeyRound className="h-5 w-5 text-amber-600" />
                  Đặt Lại Mật Khẩu Người Dùng
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Tài khoản: <strong className="text-slate-800">{selectedUser.email}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="mt-4 space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between">
                  <label className="block font-semibold text-slate-700">
                    Mật khẩu mới <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setResetPassword(generateRandomPassword())}
                    className="flex items-center gap-1 text-[11px] font-medium text-amber-600 hover:underline"
                  >
                    <Sparkles className="h-3 w-3" />
                    Tạo pass ngẫu nhiên
                  </button>
                </div>
                <div className="relative mt-1">
                  <input
                    type={showResetPassword ? "text" : "password"}
                    required
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="Nhập mật khẩu mới tối thiểu 6 ký tự"
                    className="w-full rounded-xl border border-slate-300 py-2 pl-3 pr-10 text-xs text-slate-900 focus:border-amber-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Người dùng sẽ sử dụng mật khẩu mới này để đăng nhập ngay lập tức.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingPassword || resetPassword.length < 6}
                  className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {submittingPassword ? "Đang lưu..." : "Xác nhận đổi mật khẩu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
