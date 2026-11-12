"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap, Plus, Award, RefreshCw, ShieldAlert } from "lucide-react";

interface CourseRow {
  id: string;
  code: string;
  title: string;
  category: string;
  duration_hours: number;
  is_mandatory: boolean;
  validity_months: number | null;
}

interface EmployeeOption {
  id: string;
  employee_code: string;
  full_name: string;
}

interface EnrollmentRow {
  id: string;
  status: string;
  score: number | null;
  completed_at: string | null;
  certificate_expires_at: string | null;
  courses: { code: string; title: string; is_mandatory: boolean } | null;
  employees: { employee_code: string; full_name: string } | null;
}

export default function LearningPage() {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // Enroll form
  const [courseId, setCourseId] = useState("");
  const [employeeId, setEmployeeId] = useState("");

  // New course form
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("COMPLIANCE");
  const [durationHours, setDurationHours] = useState("2");
  const [isMandatory, setIsMandatory] = useState(true);
  const [validityMonths, setValidityMonths] = useState("12");

  useEffect(() => {
    let active = true;
    fetch("/api/v1/learning", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          throw new Error(
            json.error?.message ?? json.error ?? "Không thể tải dữ liệu đào tạo"
          );
        }
        return json;
      })
      .then((data) => {
        if (!active) return;
        const c: CourseRow[] = data.courses ?? [];
        const e: EmployeeOption[] = data.employees ?? [];
        setCourses(c);
        setEnrollments(data.enrollments ?? []);
        setEmployees(e);
        if (c.length > 0) setCourseId((prev) => prev || c[0].id);
        if (e.length > 0) setEmployeeId((prev) => prev || e[0].id);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Lỗi tải dữ liệu");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadTick]);

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/v1/learning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "enrollment",
          course_id: courseId,
          employee_id: employeeId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message ?? json.error ?? "Không thể ghi danh khóa học");
      }
      setNotice("Đã ghi danh nhân viên vào khóa đào tạo.");
      setReloadTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi ghi danh");
    }
  }

  async function handleCreateCourse(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/v1/learning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "course",
          code,
          title,
          category,
          duration_hours: Number(durationHours),
          is_mandatory: isMandatory,
          validity_months: validityMonths ? Number(validityMonths) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message ?? json.error ?? "Không thể tạo khóa học");
      }
      setCode("");
      setTitle("");
      setNotice("Đã thêm khóa học mới.");
      setReloadTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi tạo khóa học");
    }
  }

  async function handleComplete(id: string, score: number) {
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/v1/learning", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "COMPLETED", score }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message ?? json.error ?? "Không thể cấp chứng chỉ");
      }
      setNotice("Đã hoàn thành khóa học & tự động tính hạn chứng chỉ.");
      setReloadTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi cập nhật hoàn thành");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <GraduationCap className="h-5 w-5 text-sky-600" />
            Đào tạo &amp; Chứng chỉ Bắt buộc
          </h1>
          <p className="text-sm text-slate-600">
            Quản lý khóa học PDPL, PCCC kho bãi, nghiệp vụ POS &amp; theo dõi thời hạn chứng chỉ.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReloadTick((t) => t + 1)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Làm mới
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold">Thông báo</div>
          <div className="mt-1">{error}</div>
          <Link
            href="/login"
            className="mt-2 inline-block rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
          >
            Đăng nhập hệ thống
          </Link>
        </div>
      )}

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      {/* Courses catalog */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((c) => (
          <div
            key={c.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-sky-700">
                {c.code}
              </span>
              {c.is_mandatory && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                  <ShieldAlert className="h-3 w-3" />
                  Bắt buộc
                </span>
              )}
            </div>
            <div className="mt-1.5 font-semibold text-slate-900">{c.title}</div>
            <div className="mt-1 text-xs text-slate-500">
              {c.category} • {c.duration_hours} giờ •{" "}
              {c.validity_months ? `Hiệu lực ${c.validity_months} tháng` : "Vô thời hạn"}
            </div>
          </div>
        ))}
      </section>

      {/* Forms */}
      <section className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleEnroll}
          className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Plus className="h-4 w-4 text-sky-600" />
            Ghi danh đào tạo nhân viên
          </div>
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            required
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">-- Chọn khóa học --</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.title}
              </option>
            ))}
          </select>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            required
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">-- Chọn nhân viên --</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.employee_code} — {emp.full_name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700"
          >
            Ghi danh ngay
          </button>
        </form>

        <form
          onSubmit={handleCreateCourse}
          className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Award className="h-4 w-4 text-sky-600" />
            Thêm khóa đào tạo mới (HR)
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              placeholder="Mã khóa (vd: CRS-ATVSLD)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="COMPLIANCE">COMPLIANCE</option>
              <option value="SAFETY">SAFETY</option>
              <option value="OPERATIONS">OPERATIONS</option>
              <option value="TECHNICAL">TECHNICAL</option>
              <option value="SOFT_SKILLS">SOFT_SKILLS</option>
            </select>
          </div>
          <input
            type="text"
            placeholder="Tên khóa đào tạo"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              type="number"
              step="0.5"
              min={0.5}
              placeholder="Số giờ"
              value={durationHours}
              onChange={(e) => setDurationHours(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="number"
              min={1}
              placeholder="Hiệu lực (tháng)"
              value={validityMonths}
              onChange={(e) => setValidityMonths(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={isMandatory}
                onChange={(e) => setIsMandatory(e.target.checked)}
              />
              Bắt buộc
            </label>
          </div>
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Tạo khóa học
          </button>
        </form>
      </section>

      {/* Enrollments Table */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="text-sm font-semibold text-slate-900">
          Theo dõi học tập &amp; Chứng chỉ ({enrollments.length})
        </h2>
        {loading ? (
          <div className="py-6 text-sm text-slate-500">Đang tải...</div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Khóa học</th>
                  <th className="py-2 pr-3">Nhân viên</th>
                  <th className="py-2 pr-3">Trạng thái</th>
                  <th className="py-2 pr-3">Điểm</th>
                  <th className="py-2 pr-3">Hạn chứng chỉ</th>
                  <th className="py-2">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {enrollments.map((en) => (
                  <tr key={en.id}>
                    <td className="py-2.5 pr-3">
                      <span className="font-mono text-sky-700">
                        {en.courses?.code ?? "—"}
                      </span>{" "}
                      — {en.courses?.title ?? ""}
                    </td>
                    <td className="py-2.5 pr-3 font-medium text-slate-900">
                      {en.employees
                        ? `${en.employees.employee_code} — ${en.employees.full_name}`
                        : "—"}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          en.status === "COMPLETED"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {en.status}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">{en.score ?? "—"}</td>
                    <td className="py-2.5 pr-3 font-mono text-slate-600">
                      {en.certificate_expires_at ?? "—"}
                    </td>
                    <td className="py-2.5">
                      {en.status !== "COMPLETED" && (
                        <button
                          type="button"
                          onClick={() => handleComplete(en.id, 90)}
                          className="rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-700"
                        >
                          Xác nhận đạt (90đ)
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {enrollments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500">
                      Chưa có lượt ghi danh đào tạo nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
