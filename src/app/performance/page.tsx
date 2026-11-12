"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Target, Plus, CheckCircle2, Award, RefreshCw, Search } from "lucide-react";

interface CycleRow {
  id: string;
  code: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface EmployeeOption {
  id: string;
  employee_code: string;
  full_name: string;
}

interface GoalRow {
  id: string;
  cycle_id: string;
  employee_id: string;
  title: string;
  metric_target: string | null;
  weight_percent: number;
  progress_percent: number;
  status: string;
  employees: { employee_code: string; full_name: string } | null;
  performance_cycles: { code: string; name: string } | null;
}

interface ReviewRow {
  id: string;
  cycle_id: string;
  employee_id: string;
  self_score: number | null;
  manager_score: number | null;
  final_rating: string | null;
  summary_note: string | null;
  status: string;
  employees: { employee_code: string; full_name: string } | null;
  performance_cycles: { code: string; name: string } | null;
}

export default function PerformancePage() {
  const [cycles, setCycles] = useState<CycleRow[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // Create goal form
  const [cycleId, setCycleId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [goalTitle, setGoalTitle] = useState("");
  const [metricTarget, setMetricTarget] = useState("");
  const [weightPercent, setWeightPercent] = useState("25");

  // Create review form
  const [revCycleId, setRevCycleId] = useState("");
  const [revEmployeeId, setRevEmployeeId] = useState("");
  const [selfScore, setSelfScore] = useState("85");
  const [summaryNote, setSummaryNote] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/v1/performance", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          throw new Error(
            json.error?.message ?? json.error ?? "Không thể tải dữ liệu KPI"
          );
        }
        return json;
      })
      .then((data) => {
        if (!active) return;
        const c: CycleRow[] = data.cycles ?? [];
        const e: EmployeeOption[] = data.employees ?? [];
        setCycles(c);
        setGoals(data.goals ?? []);
        setReviews(data.reviews ?? []);
        setEmployees(e);
        if (c.length > 0) {
          setCycleId((prev) => prev || c[0].id);
          setRevCycleId((prev) => prev || c[0].id);
        }
        if (e.length > 0) {
          setEmployeeId((prev) => prev || e[0].id);
          setRevEmployeeId((prev) => prev || e[0].id);
        }
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

  async function handleCreateGoal(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/v1/performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "goal",
          cycle_id: cycleId,
          employee_id: employeeId,
          title: goalTitle,
          metric_target: metricTarget || undefined,
          weight_percent: Number(weightPercent),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message ?? json.error ?? "Không thể tạo mục tiêu KPI");
      }
      setGoalTitle("");
      setMetricTarget("");
      setNotice("Đã giao mục tiêu KPI thành công.");
      setReloadTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi tạo mục tiêu");
    }
  }

  async function handleGoalProgress(id: string, progress: number) {
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/v1/performance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "goal",
          id,
          progress_percent: progress,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message ?? json.error ?? "Không thể cập nhật tiến độ");
      }
      setNotice(`Đã cập nhật tiến độ mục tiêu lên ${progress}%.`);
      setReloadTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi cập nhật tiến độ");
    }
  }

  async function handleCreateReview(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/v1/performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "review",
          cycle_id: revCycleId,
          employee_id: revEmployeeId,
          self_score: selfScore ? Number(selfScore) : undefined,
          summary_note: summaryNote || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message ?? json.error ?? "Không thể tạo phiếu đánh giá");
      }
      setSummaryNote("");
      setNotice("Đã khởi tạo phiếu tự đánh giá.");
      setReloadTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi tạo phiếu đánh giá");
    }
  }

  async function handleFinalizeReview(
    id: string,
    rating: "A_OUTSTANDING" | "B_EXCEEDS" | "C_MEETS" | "D_NEEDS_IMPROVEMENT",
    score: number
  ) {
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/v1/performance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "review",
          id,
          manager_score: score,
          final_rating: rating,
          status: "FINALIZED",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message ?? json.error ?? "Không thể chốt xếp loại");
      }
      setNotice(`Đã chốt xếp loại ${rating} (${score} điểm).`);
      setReloadTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi chốt xếp loại");
    }
  }

  const q = searchQuery.trim().toLowerCase();
  const filteredGoals = goals.filter(
    (g) =>
      !q ||
      g.title.toLowerCase().includes(q) ||
      g.employees?.full_name.toLowerCase().includes(q) ||
      g.employees?.employee_code.toLowerCase().includes(q)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Target className="h-5 w-5 text-amber-600" />
            Đánh giá KPI &amp; Mục tiêu
          </h1>
          <p className="text-sm text-slate-600">
            Quản lý chu kỳ đánh giá, giao mục tiêu theo trọng số &amp; xếp loại A/B/C/D.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm nhân viên / mục tiêu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white py-1.5 pr-3 pl-8 text-xs focus:border-amber-500 focus:outline-none"
            />
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

      {/* Cycles Summary */}
      <section className="grid gap-3 sm:grid-cols-3">
        {cycles.map((c) => (
          <div
            key={c.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-amber-700">
                {c.code}
              </span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                {c.status}
              </span>
            </div>
            <div className="mt-1 font-semibold text-slate-900">{c.name}</div>
            <div className="mt-1 text-xs text-slate-500">
              {c.start_date} → {c.end_date}
            </div>
          </div>
        ))}
      </section>

      {/* Forms Grid */}
      <section className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleCreateGoal}
          className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Plus className="h-4 w-4 text-amber-600" />
            Giao mục tiêu KPI mới
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={cycleId}
              onChange={(e) => setCycleId(e.target.value)}
              required
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">-- Chọn chu kỳ --</option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">-- Chọn nhân viên --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.employee_code} — {emp.full_name}
                </option>
              ))}
            </select>
          </div>
          <input
            type="text"
            placeholder="Tên mục tiêu (vd: Đạt doanh số chi nhánh Gò Dầu 100%)"
            value={goalTitle}
            onChange={(e) => setGoalTitle(e.target.value)}
            required
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              placeholder="Chỉ tiêu đo lường (vd: >= 500 triệu/tháng)"
              value={metricTarget}
              onChange={(e) => setMetricTarget(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="number"
              min={1}
              max={100}
              placeholder="Trọng số (%)"
              value={weightPercent}
              onChange={(e) => setWeightPercent(e.target.value)}
              required
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700"
          >
            Lưu mục tiêu KPI
          </button>
        </form>

        <form
          onSubmit={handleCreateReview}
          className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Award className="h-4 w-4 text-amber-600" />
            Khởi tạo phiếu tự đánh giá
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={revCycleId}
              onChange={(e) => setRevCycleId(e.target.value)}
              required
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">-- Chọn chu kỳ --</option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
            <select
              value={revEmployeeId}
              onChange={(e) => setRevEmployeeId(e.target.value)}
              required
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">-- Chọn nhân viên --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.employee_code} — {emp.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="number"
              min={0}
              max={100}
              placeholder="Điểm tự đánh giá (0-100)"
              value={selfScore}
              onChange={(e) => setSelfScore(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Ghi chú kết quả nổi bật"
              value={summaryNote}
              onChange={(e) => setSummaryNote(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Gửi tự đánh giá
          </button>
        </form>
      </section>

      {/* Goals Table */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="text-sm font-semibold text-slate-900">
          Danh sách mục tiêu KPI ({filteredGoals.length})
        </h2>
        {loading ? (
          <div className="py-6 text-sm text-slate-500">Đang tải...</div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Chu kỳ</th>
                  <th className="py-2 pr-3">Nhân viên</th>
                  <th className="py-2 pr-3">Mục tiêu</th>
                  <th className="py-2 pr-3">Trọng số</th>
                  <th className="py-2 pr-3">Tiến độ</th>
                  <th className="py-2 pr-3">Trạng thái</th>
                  <th className="py-2">Cập nhật nhanh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredGoals.map((g) => (
                  <tr key={g.id}>
                    <td className="py-2.5 pr-3 font-mono text-slate-600">
                      {g.performance_cycles?.code ?? "—"}
                    </td>
                    <td className="py-2.5 pr-3 font-medium text-slate-900">
                      {g.employees
                        ? `${g.employees.employee_code} — ${g.employees.full_name}`
                        : "—"}
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="font-medium text-slate-900">{g.title}</div>
                      {g.metric_target && (
                        <div className="text-[11px] text-slate-500">{g.metric_target}</div>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">{g.weight_percent}%</td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-amber-500"
                            style={{ width: `${g.progress_percent}%` }}
                          />
                        </div>
                        <span className="font-semibold text-amber-700">
                          {g.progress_percent}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3">{g.status}</td>
                    <td className="flex gap-1.5 py-2.5">
                      <button
                        type="button"
                        onClick={() => handleGoalProgress(g.id, 50)}
                        className="rounded border border-slate-200 px-2 py-1 text-[11px] hover:bg-slate-50"
                      >
                        50%
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGoalProgress(g.id, 100)}
                        className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-[11px] text-white hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        100%
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredGoals.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-500">
                      Chưa có mục tiêu KPI nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Reviews Table */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="text-sm font-semibold text-slate-900">
          Phiếu đánh giá kỳ ({reviews.length})
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-2 pr-3">Chu kỳ</th>
                <th className="py-2 pr-3">Nhân viên</th>
                <th className="py-2 pr-3">Tự chấm</th>
                <th className="py-2 pr-3">Quản lý chấm</th>
                <th className="py-2 pr-3">Xếp loại</th>
                <th className="py-2 pr-3">Trạng thái</th>
                <th className="py-2">Chốt đánh giá (SoD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reviews.map((r) => (
                <tr key={r.id}>
                  <td className="py-2.5 pr-3 font-mono text-slate-600">
                    {r.performance_cycles?.code ?? "—"}
                  </td>
                  <td className="py-2.5 pr-3 font-medium text-slate-900">
                    {r.employees
                      ? `${r.employees.employee_code} — ${r.employees.full_name}`
                      : "—"}
                  </td>
                  <td className="py-2.5 pr-3">{r.self_score ?? "—"}</td>
                  <td className="py-2.5 pr-3 font-semibold">{r.manager_score ?? "—"}</td>
                  <td className="py-2.5 pr-3 font-semibold text-amber-700">
                    {r.final_rating ?? "—"}
                  </td>
                  <td className="py-2.5 pr-3">{r.status}</td>
                  <td className="flex gap-1.5 py-2.5">
                    {r.status !== "FINALIZED" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleFinalizeReview(r.id, "A_OUTSTANDING", 95)}
                          className="rounded bg-amber-600 px-2 py-1 text-[11px] text-white hover:bg-amber-700"
                        >
                          Chốt A (95)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFinalizeReview(r.id, "B_EXCEEDS", 85)}
                          className="rounded bg-slate-800 px-2 py-1 text-[11px] text-white hover:bg-slate-900"
                        >
                          Chốt B (85)
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {reviews.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    Chưa có phiếu đánh giá nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
