"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ShieldCheck, FileDown, RefreshCw } from "lucide-react";

interface AuditEventRow {
  id: string;
  actor_user_id: string | null;
  actor_role: string | null;
  action: string;
  target_entity: string;
  target_id: string | null;
  created_at: string;
}

interface AccessLogRow {
  id: string;
  actor_role: string | null;
  access_type: string;
  target_entity: string;
  target_id: string | null;
  reason: string | null;
  created_at: string;
}

interface ExportLogRow {
  id: string;
  actor_role: string | null;
  module_code: string;
  export_format: string;
  row_count: number;
  file_sha256: string | null;
  created_at: string;
}

export default function AuditCenterPage() {
  const [tab, setTab] = useState<"audit" | "access" | "export">("audit");
  const [auditEvents, setAuditEvents] = useState<AuditEventRow[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLogRow[]>([]);
  const [exportLogs, setExportLogs] = useState<ExportLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/v1/audit/logs?limit=100", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          throw new Error(
            json.error?.message ?? json.error ?? "Không thể tải nhật ký Audit"
          );
        }
        return json;
      })
      .then((data) => {
        if (!active) return;
        setAuditEvents(data.auditEvents ?? []);
        setAccessLogs(data.accessLogs ?? []);
        setExportLogs(data.exportLogs ?? []);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Lỗi tải Audit Logs");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadTick]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Activity className="h-5 w-5 text-slate-700" />
            Trung tâm Nhật ký Bất biến &amp; Kiểm toán
          </h1>
          <p className="text-sm text-slate-600">
            Theo dõi audit_events (biến động dữ liệu), access_logs (giải mã PII) &amp; export_logs.
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
          <div className="font-semibold">Thông báo phân quyền</div>
          <div className="mt-1">{error}</div>
          <Link
            href="/login"
            className="mt-2 inline-block rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
          >
            Đăng nhập với quyền HR_ADMIN / AUDITOR / SUPER_ADMIN
          </Link>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("audit")}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold ${
            tab === "audit"
              ? "bg-slate-900 text-white"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Activity className="h-3.5 w-3.5" />
          Audit Events ({auditEvents.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("access")}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold ${
            tab === "access"
              ? "bg-slate-900 text-white"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          PII Access Logs ({accessLogs.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("export")}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold ${
            tab === "export"
              ? "bg-slate-900 text-white"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <FileDown className="h-3.5 w-3.5" />
          Export Logs ({exportLogs.length})
        </button>
      </div>

      {/* Table Container */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        {loading ? (
          <div className="py-8 text-sm text-slate-500">Đang tải nhật ký...</div>
        ) : tab === "audit" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Thời gian</th>
                  <th className="py-2 pr-3">Vai trò</th>
                  <th className="py-2 pr-3">Hành động</th>
                  <th className="py-2 pr-3">Bảng dữ liệu</th>
                  <th className="py-2">Target ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditEvents.map((ev) => (
                  <tr key={ev.id}>
                    <td className="py-2 pr-3 font-mono text-slate-600">
                      {ev.created_at.slice(0, 19).replace("T", " ")}
                    </td>
                    <td className="py-2 pr-3 font-semibold text-slate-800">
                      {ev.actor_role ?? "SYSTEM"}
                    </td>
                    <td className="py-2 pr-3 font-mono text-amber-700">{ev.action}</td>
                    <td className="py-2 pr-3">{ev.target_entity}</td>
                    <td className="py-2 font-mono text-[11px] text-slate-500">
                      {ev.target_id ?? "—"}
                    </td>
                  </tr>
                ))}
                {auditEvents.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">
                      Chưa ghi nhận audit_events nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : tab === "access" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Thời gian</th>
                  <th className="py-2 pr-3">Vai trò</th>
                  <th className="py-2 pr-3">Loại truy cập</th>
                  <th className="py-2 pr-3">Đối tượng</th>
                  <th className="py-2">Lý do</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accessLogs.map((ac) => (
                  <tr key={ac.id}>
                    <td className="py-2 pr-3 font-mono text-slate-600">
                      {ac.created_at.slice(0, 19).replace("T", " ")}
                    </td>
                    <td className="py-2 pr-3 font-semibold text-slate-800">
                      {ac.actor_role ?? "—"}
                    </td>
                    <td className="py-2 pr-3 font-mono text-sky-700">{ac.access_type}</td>
                    <td className="py-2 pr-3">{ac.target_entity}</td>
                    <td className="py-2 text-slate-600">{ac.reason ?? "—"}</td>
                  </tr>
                ))}
                {accessLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">
                      Chưa ghi nhận access_logs nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Thời gian</th>
                  <th className="py-2 pr-3">Vai trò</th>
                  <th className="py-2 pr-3">Phân hệ</th>
                  <th className="py-2 pr-3">Định dạng</th>
                  <th className="py-2 pr-3">Số dòng</th>
                  <th className="py-2">SHA-256</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {exportLogs.map((ex) => (
                  <tr key={ex.id}>
                    <td className="py-2 pr-3 font-mono text-slate-600">
                      {ex.created_at.slice(0, 19).replace("T", " ")}
                    </td>
                    <td className="py-2 pr-3 font-semibold text-slate-800">
                      {ex.actor_role ?? "—"}
                    </td>
                    <td className="py-2 pr-3 font-mono text-emerald-700">
                      {ex.module_code}
                    </td>
                    <td className="py-2 pr-3">{ex.export_format}</td>
                    <td className="py-2 pr-3">{ex.row_count}</td>
                    <td className="py-2 font-mono text-[11px] text-slate-500">
                      {ex.file_sha256 ? `${ex.file_sha256.slice(0, 16)}...` : "—"}
                    </td>
                  </tr>
                ))}
                {exportLogs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500">
                      Chưa ghi nhận export_logs nào.
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
