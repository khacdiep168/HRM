"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  CheckSquare,
  X,
  AlertTriangle,
  Clock,
  AlertCircle,
  FolderArchive,
  ChevronRight,
} from "lucide-react";
import { EmptyState, ErrorRetry, SkeletonBlock } from "@/components/ui/StateViews";
import { formatDateVi, translateEnumVi } from "@/lib/i18n/format";

interface ApprovalItem {
  key: string;
  type: "LEAVE" | "OT" | "EXCEPTION";
  id: string;
  empCode: string;
  empName: string;
  summary: string;
  dateLabel: string;
  reason: string;
  createdAt: string;
  isUrgent?: boolean;
  isOverdue?: boolean;
  daysRemaining?: number;
}

interface MissingDocEmployee {
  id: string;
  code: string;
  name: string;
  department: string;
  missingItems: string[];
}

export default function ApprovalsPage() {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Deadline Filter Tabs
  type DeadlineTab = "NEXT_7_DAYS" | "OVERDUE" | "NEXT_14_DAYS" | "NEXT_30_DAYS" | "AFTER_30_DAYS" | "ALL";
  const [deadlineTab, setDeadlineTab] = useState<DeadlineTab>("NEXT_7_DAYS");

  // Missing documents aggregated drawer state
  const [showMissingDocsDrawer, setShowMissingDocsDrawer] = useState(false);
  const [missingDocStaff, setMissingDocStaff] = useState<MissingDocEmployee[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/v1/approvals", { cache: "no-store" }),
      fetch("/api/v1/employees", { cache: "no-store" }),
    ])
      .then(async ([approvalsRes, empRes]) => {
        const json = await approvalsRes.json();
        if (!active) return;
        if (!approvalsRes.ok) {
          setError(json.error?.message ?? "Không có quyền truy cập mục Việc cần duyệt.");
          return;
        }

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const leaves: ApprovalItem[] = (json.data?.leaves ?? []).map(
          (l: Record<string, unknown>) => {
            const emp = l.employees as { employee_code?: string; full_name?: string } | null;
            const lt = l.leave_types as { name?: string } | null;
            const created = new Date(String(l.created_at ?? now));
            const daysAge = Math.round((now.getTime() - created.getTime()) / (1000 * 3600 * 24));
            const isOverdue = daysAge > 3;

            return {
              key: `LEAVE:${l.id}`,
              type: "LEAVE",
              id: String(l.id),
              empCode: emp?.employee_code ?? "",
              empName: emp?.full_name ?? "Nhân viên",
              summary: `Nghỉ phép (${lt?.name ?? "Phép"}) • ${l.total_days} ngày`,
              dateLabel: `${formatDateVi(String(l.start_date))} → ${formatDateVi(String(l.end_date))}`,
              reason: String(l.reason ?? ""),
              createdAt: String(l.created_at ?? ""),
              isUrgent: isOverdue,
              isOverdue,
              daysRemaining: 7 - daysAge,
            };
          }
        );

        const ots: ApprovalItem[] = (json.data?.overtimes ?? []).map(
          (o: Record<string, unknown>) => {
            const emp = o.employees as { employee_code?: string; full_name?: string } | null;
            const hours =
              (o.requested_hours as number | string | undefined) ??
              (o.planned_hours as number | string | undefined) ??
              0;
            const created = new Date(String(o.created_at ?? now));
            const daysAge = Math.round((now.getTime() - created.getTime()) / (1000 * 3600 * 24));
            const isOverdue = daysAge > 2;

            return {
              key: `OT:${o.id}`,
              type: "OT",
              id: String(o.id),
              empCode: emp?.employee_code ?? "",
              empName: emp?.full_name ?? "Nhân viên",
              summary: `Tăng ca (${translateEnumVi(String(o.ot_day_type ?? "WEEKDAY"))}) • ${hours} giờ`,
              dateLabel: formatDateVi(String(o.work_date)),
              reason: String(o.reason ?? ""),
              createdAt: String(o.created_at ?? ""),
              isUrgent: isOverdue || Number(hours) >= 6,
              isOverdue,
              daysRemaining: 7 - daysAge,
            };
          }
        );

        const excs: ApprovalItem[] = (json.data?.exceptions ?? []).map(
          (e: Record<string, unknown>) => {
            const emp = e.employees as { employee_code?: string; full_name?: string } | null;
            const created = new Date(String(e.created_at ?? now));
            const daysAge = Math.round((now.getTime() - created.getTime()) / (1000 * 3600 * 24));
            const isOverdue = daysAge > 5;

            return {
              key: `EXCEPTION:${e.id}`,
              type: "EXCEPTION",
              id: String(e.id),
              empCode: emp?.employee_code ?? "",
              empName: emp?.full_name ?? "Nhân viên",
              summary: `Giải trình công (${translateEnumVi(String(e.exception_type ?? ""))})`,
              dateLabel: formatDateVi(String(e.work_date)),
              reason: String(e.explanation_note ?? ""),
              createdAt: String(e.created_at ?? ""),
              isUrgent: isOverdue,
              isOverdue,
              daysRemaining: 7 - daysAge,
            };
          }
        );

        setItems([...leaves, ...ots, ...excs]);
        setSelected(new Set());

        // Process missing docs from employees API
        if (empRes.ok) {
          const empJson = await empRes.json();
          const emps = (empJson.data ?? []) as Array<Record<string, unknown>>;
          const missingList: MissingDocEmployee[] = [];

          for (const e of emps) {
            const missing: string[] = [];
            if (!e.active_contract) missing.push("Chưa ký HĐLĐ");
            const phone = String(e.phone_masked ?? "");
            if (!phone || phone.includes("—")) missing.push("Thiếu SĐT");
            if (!e.national_id_masked) missing.push("Thiếu CCCD");

            if (missing.length > 0) {
              missingList.push({
                id: String(e.id),
                code: String(e.employee_code),
                name: String(e.full_name),
                department: "Kho vận / Cửa hàng",
                missingItems: missing,
              });
            }
          }
          setMissingDocStaff(missingList);
        }
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

  // Separate overdue & urgent items (which always show regardless of filter)
  const overdueAndUrgentItems = useMemo(() => {
    return items.filter((i) => i.isOverdue || i.isUrgent);
  }, [items]);

  // Tab counts
  const tabCounts = useMemo(() => {
    let overdue = 0;
    let next7 = 0;
    let next14 = 0;
    let next30 = 0;
    let after30 = 0;

    for (const i of items) {
      if (i.isOverdue) overdue++;
      const days = i.daysRemaining ?? 5;
      if (days >= 0 && days <= 7) next7++;
      if (days > 7 && days <= 14) next14++;
      if (days > 14 && days <= 30) next30++;
      if (days > 30) after30++;
    }

    return { all: items.length, overdue, next7, next14, next30, after30 };
  }, [items]);

  // Filtered items based on deadline tab
  const filteredItems = useMemo(() => {
    return items.filter((i) => {
      if (deadlineTab === "ALL") return true;
      if (deadlineTab === "OVERDUE") return i.isOverdue;
      const days = i.daysRemaining ?? 5;
      if (deadlineTab === "NEXT_7_DAYS") return days >= 0 && days <= 7;
      if (deadlineTab === "NEXT_14_DAYS") return days >= 0 && days <= 14;
      if (deadlineTab === "NEXT_30_DAYS") return days >= 0 && days <= 30;
      if (deadlineTab === "AFTER_30_DAYS") return days > 30;
      return true;
    });
  }, [items, deadlineTab]);

  const allSelected = useMemo(
    () => filteredItems.length > 0 && selected.size === filteredItems.length,
    [filteredItems.length, selected.size]
  );

  function toggleOne(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredItems.map((i) => i.key)));
    }
  }

  async function handleBatch(
    action: "APPROVE" | "REJECT",
    targetItems?: Array<{ type: "LEAVE" | "OT" | "EXCEPTION"; id: string }>
  ) {
    const payloadItems =
      targetItems ??
      items
        .filter((i) => selected.has(i.key))
        .map((i) => ({ type: i.type, id: i.id }));
    if (payloadItems.length === 0) return;

    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/v1/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, items: payloadItems }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Không thể xử lý yêu cầu.");
        return;
      }
      setMsg(
        `Đã ${action === "APPROVE" ? "duyệt" : "từ chối"} ${json.data?.processedCount ?? payloadItems.length} đơn.`
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Việc cần xử lý &amp; Phê duyệt ({items.length})
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Lọc theo hạn • Việc gấp/quá hạn luôn hiển thị • Gộp nhiệm vụ bổ sung hồ sơ giấy tờ • Duyệt hàng loạt 1 chạm.
          </p>
        </div>

        {filteredItems.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleAll}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <CheckSquare className="h-4 w-4" />
              {allSelected ? "Bỏ chọn" : "Chọn tất cả"}
            </button>
            <button
              type="button"
              disabled={busy || selected.size === 0}
              onClick={() => handleBatch("APPROVE")}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              Duyệt đã chọn ({selected.size})
            </button>
            <button
              type="button"
              disabled={busy || selected.size === 0}
              onClick={() => handleBatch("REJECT")}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              Từ chối ({selected.size})
            </button>
          </div>
        )}
      </div>

      {msg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
          {msg}
        </div>
      )}

      {/* AGGREGATED TASK: MISSING DOCUMENTS CARD */}
      {missingDocStaff.length > 0 && (
        <div
          onClick={() => setShowMissingDocsDrawer(true)}
          className="cursor-pointer rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 transition-all hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs">
                <FolderArchive className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">
                    Nhiệm vụ Nhân sự: Bổ sung hồ sơ giấy tờ còn thiếu
                  </span>
                  <span className="rounded-full bg-amber-200/80 px-2.5 py-0.5 text-xs font-black text-amber-900">
                    {missingDocStaff.length} nhân sự
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-slate-600">
                  Phát hiện nhân sự chưa nộp đủ CCCD gắn chip, HĐLĐ hoặc SĐT. Bấm để mở danh sách chi tiết.
                </div>
              </div>
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-amber-900 shadow-xs hover:bg-amber-100"
            >
              Xem danh sách <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* STICKY OVERDUE / URGENT HIGHLIGHT BANNER */}
      {overdueAndUrgentItems.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4">
          <div className="flex items-center gap-2 font-bold text-rose-800 text-xs uppercase tracking-wide">
            <AlertTriangle className="h-4 w-4 text-rose-600" />
            Việc gấp &amp; Đã quá hạn ({overdueAndUrgentItems.length} đơn) — Luôn hiển thị ưu tiên
          </div>
          <div className="mt-2 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {overdueAndUrgentItems.map((item) => (
              <div
                key={`urgent-${item.key}`}
                className="flex items-center justify-between rounded-xl border border-rose-200 bg-white p-3 shadow-xs"
              >
                <div>
                  <div className="font-bold text-slate-900 text-xs">
                    {item.empName} ({item.empCode})
                  </div>
                  <div className="text-[11px] text-slate-600 truncate max-w-[200px]">{item.summary}</div>
                </div>
                <button
                  onClick={() => handleBatch("APPROVE", [{ type: item.type, id: item.id }])}
                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700"
                >
                  Duyệt ngay
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DEADLINE FILTER TABS (Default: NEXT_7_DAYS) */}
      <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setDeadlineTab("NEXT_7_DAYS")}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
            deadlineTab === "NEXT_7_DAYS"
              ? "bg-slate-900 text-white shadow-sm"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          <span>Trong 7 ngày tới (Mặc định)</span>
          <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${deadlineTab === "NEXT_7_DAYS" ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-700"}`}>
            {tabCounts.next7}
          </span>
        </button>

        <button
          onClick={() => setDeadlineTab("OVERDUE")}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
            deadlineTab === "OVERDUE"
              ? "bg-rose-600 text-white shadow-sm"
              : "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
          }`}
        >
          <AlertCircle className="h-3.5 w-3.5" />
          <span>Đã quá hạn</span>
          <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${deadlineTab === "OVERDUE" ? "bg-rose-700 text-white" : "bg-rose-200 text-rose-800"}`}>
            {tabCounts.overdue}
          </span>
        </button>

        <button
          onClick={() => setDeadlineTab("NEXT_14_DAYS")}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
            deadlineTab === "NEXT_14_DAYS"
              ? "bg-amber-600 text-white shadow-sm"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          <span>Trong 14 ngày tới</span>
          <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${deadlineTab === "NEXT_14_DAYS" ? "bg-amber-700 text-white" : "bg-slate-100 text-slate-700"}`}>
            {tabCounts.next14}
          </span>
        </button>

        <button
          onClick={() => setDeadlineTab("NEXT_30_DAYS")}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
            deadlineTab === "NEXT_30_DAYS"
              ? "bg-sky-600 text-white shadow-sm"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          <span>Trong 30 ngày tới</span>
          <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${deadlineTab === "NEXT_30_DAYS" ? "bg-sky-700 text-white" : "bg-slate-100 text-slate-700"}`}>
            {tabCounts.next30}
          </span>
        </button>

        <button
          onClick={() => setDeadlineTab("ALL")}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
            deadlineTab === "ALL"
              ? "bg-slate-700 text-white shadow-sm"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          <span>Tất cả</span>
          <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${deadlineTab === "ALL" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700"}`}>
            {tabCounts.all}
          </span>
        </button>
      </div>

      {/* Main Approval List */}
      {loading ? (
        <SkeletonBlock rows={4} />
      ) : error ? (
        <ErrorRetry message={error} onRetry={load} />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title="Không có đơn nào cần xử lý trong diện lọc này"
          description="Tất cả các đơn đã được duyệt hoặc chưa phát sinh yêu cầu mới."
        />
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const isChecked = selected.has(item.key);
            return (
              <div
                key={item.key}
                onClick={() => toggleOne(item.key)}
                className={`flex cursor-pointer flex-col gap-3 rounded-2xl border bg-white p-4 transition-all hover:shadow-xs sm:flex-row sm:items-center sm:justify-between ${
                  isChecked
                    ? "border-emerald-500 bg-emerald-50/20"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleOne(item.key)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-700">
                        {item.empCode}
                      </span>
                      <span className="font-bold text-slate-900 text-sm">
                        {item.empName}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          item.type === "LEAVE"
                            ? "bg-purple-100 text-purple-800"
                            : item.type === "OT"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-sky-100 text-sky-800"
                        }`}
                      >
                        {item.type === "LEAVE"
                          ? "Nghỉ phép"
                          : item.type === "OT"
                          ? "Tăng ca"
                          : "Giải trình công"}
                      </span>
                      {item.isUrgent && (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                          Gấp
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs font-medium text-slate-800">
                      {item.summary} • <span className="text-slate-500">{item.dateLabel}</span>
                    </div>
                    {item.reason && (
                      <div className="mt-1 text-xs text-slate-500 italic">
                        &quot;{item.reason}&quot;
                      </div>
                    )}
                  </div>
                </div>

                <div
                  className="flex items-center gap-2 sm:self-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      handleBatch("APPROVE", [{ type: item.type, id: item.id }])
                    }
                    className="inline-flex min-h-[38px] items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Duyệt
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      handleBatch("REJECT", [{ type: item.type, id: item.id }])
                    }
                    className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    Từ chối
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SLIDE-OVER DRAWER FOR AGGREGATED MISSING DOCUMENTS */}
      {showMissingDocsDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs">
          <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <span className="font-mono text-xs font-bold text-amber-700">NHIỆM VỤ NHÂN SỰ</span>
                <h2 className="text-lg font-bold text-slate-900">
                  Danh sách nhân sự còn thiếu hồ sơ giấy tờ ({missingDocStaff.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowMissingDocsDrawer(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-3 text-xs text-slate-600">
              Nhân sự cần hoàn tất các giấy tờ dưới đây trước kỳ chốt lương để đảm bảo tuân thủ pháp luật và quyền lợi BHXH:
            </p>

            <div className="mt-4 space-y-3">
              {missingDocStaff.map((staff) => (
                <div
                  key={staff.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 hover:bg-slate-100/50"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{staff.name}</span>
                        <span className="font-mono text-xs font-semibold text-amber-700">
                          {staff.code}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">{staff.department}</div>
                    </div>

                    <Link
                      href="/employees"
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Mở hồ sơ
                    </Link>
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {staff.missingItems.map((item, idx) => (
                      <span
                        key={idx}
                        className="rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-800"
                      >
                        ⚠️ {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
