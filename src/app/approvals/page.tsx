"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, CheckSquare, X } from "lucide-react";
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
}

export default function ApprovalsPage() {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/v1/approvals", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!active) return;
        if (!res.ok) {
          setError(json.error?.message ?? "Không có quyền truy cập mục Việc cần duyệt.");
          return;
        }
        const leaves: ApprovalItem[] = (json.data?.leaves ?? []).map(
          (l: Record<string, unknown>) => {
            const emp = l.employees as { employee_code?: string; full_name?: string } | null;
            const lt = l.leave_types as { name?: string } | null;
            return {
              key: `LEAVE:${l.id}`,
              type: "LEAVE",
              id: String(l.id),
              empCode: emp?.employee_code ?? "",
              empName: emp?.full_name ?? "Nhân viên",
              summary: `Nghỉ phép (${lt?.name ?? "Phép"}) • ${l.total_days} ngày`,
              dateLabel: `${formatDateVi(String(l.start_date))} → ${formatDateVi(String(l.end_date))}`,
              reason: String(l.reason ?? ""),
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
            return {
              key: `OT:${o.id}`,
              type: "OT",
              id: String(o.id),
              empCode: emp?.employee_code ?? "",
              empName: emp?.full_name ?? "Nhân viên",
              summary: `Tăng ca (${translateEnumVi(String(o.ot_day_type ?? "WEEKDAY"))}) • ${hours} giờ`,
              dateLabel: formatDateVi(String(o.work_date)),
              reason: String(o.reason ?? ""),
            };
          }
        );
        const excs: ApprovalItem[] = (json.data?.exceptions ?? []).map(
          (e: Record<string, unknown>) => {
            const emp = e.employees as { employee_code?: string; full_name?: string } | null;
            return {
              key: `EXCEPTION:${e.id}`,
              type: "EXCEPTION",
              id: String(e.id),
              empCode: emp?.employee_code ?? "",
              empName: emp?.full_name ?? "Nhân viên",
              summary: `Giải trình công (${translateEnumVi(String(e.exception_type ?? ""))})`,
              dateLabel: formatDateVi(String(e.work_date)),
              reason: String(e.explanation_note ?? ""),
            };
          }
        );
        setItems([...leaves, ...ots, ...excs]);
        setSelected(new Set());
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

  const allSelected = useMemo(
    () => items.length > 0 && selected.size === items.length,
    [items.length, selected.size]
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
      setSelected(new Set(items.map((i) => i.key)));
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Việc cần duyệt ({items.length})
          </h1>
          <p className="text-xs text-slate-500">
            Gộp đơn Nghỉ phép, Tăng ca (OT) và Giải trình chấm công — hỗ trợ duyệt hàng loạt.
          </p>
        </div>

        {items.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleAll}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <CheckSquare className="h-4 w-4" />
              {allSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
            </button>
            <button
              type="button"
              disabled={busy || selected.size === 0}
              onClick={() => handleBatch("APPROVE")}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              Duyệt đã chọn ({selected.size})
            </button>
            <button
              type="button"
              disabled={busy || selected.size === 0}
              onClick={() => handleBatch("REJECT")}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-rose-600 px-4 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              Từ chối ({selected.size})
            </button>
          </div>
        )}
      </div>

      {msg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
          {msg}
        </div>
      )}

      {loading ? (
        <SkeletonBlock rows={4} />
      ) : error ? (
        <ErrorRetry message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          title="Không có đơn nào đang chờ duyệt"
          description="Tất cả đơn nghỉ phép, tăng ca và giải trình chấm công của nhân viên đã được xử lý."
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const checked = selected.has(item.key);
            return (
              <div
                key={item.key}
                className={`rounded-2xl border bg-white p-4 shadow-xs transition ${
                  checked ? "border-amber-400 bg-amber-50/30" : "border-slate-200"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOne(item.key)}
                      className="mt-1 h-5 w-5 rounded border-slate-300 text-amber-600"
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {item.empCode} — {item.empName}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                          {item.summary}
                        </span>
                      </div>
                      <div className="mt-1 text-xs font-medium text-amber-700">
                        Thời gian: {item.dateLabel}
                      </div>
                      {item.reason && (
                        <p className="mt-1 text-xs text-slate-600">Lý do: {item.reason}</p>
                      )}
                    </div>
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        handleBatch("APPROVE", [{ type: item.type, id: item.id }])
                      }
                      className="inline-flex min-h-[44px] items-center gap-1 rounded-xl bg-emerald-600 px-3.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
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
                      className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-rose-300 bg-white px-3.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" />
                      Từ chối
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
