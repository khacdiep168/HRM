"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Settings, ShieldCheck } from "lucide-react";
import { FEATURE_FLAGS } from "@/lib/config/feature-flags";
import { formatDateVi } from "@/lib/i18n/format";
import { EmptyState, ErrorRetry, SkeletonBlock } from "@/components/ui/StateViews";

interface LegalRuleRow {
  id: string;
  rule_code: string;
  effective_from: string;
  effective_to: string | null;
  status: string;
  parameters: Record<string, unknown>;
}

export default function AdminPage() {
  const [rules, setRules] = useState<LegalRuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [ruleCode, setRuleCode] = useState("VN_2027_UPDATE");
  const [ruleVersion, setRuleVersion] = useState("VN-2027-Q1");
  const [effectiveFrom, setEffectiveFrom] = useState("2027-01-01");
  const [region3MinWage, setRegion3MinWage] = useState("4450000");
  const [bhxhRef, setBhxhRef] = useState("2340000");
  const [selfDed, setSelfDed] = useState("15500000");
  const [depDed, setDepDed] = useState("6200000");
  const [sourceCitation, setSourceCitation] = useState("Nghị định lương tối thiểu vùng");

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/v1/admin/legal-rules", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!active) return;
        if (!res.ok) {
          setError(json.error?.message ?? "Không thể tải cấu hình tham số.");
          return;
        }
        setRules(json.data ?? []);
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

  async function handleAddRule(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/legal-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ruleCode,
          ruleVersion,
          effectiveFrom,
          region3MinWage: Number(region3MinWage),
          bhxhReferenceLevel: Number(bhxhRef),
          selfDeduction: Number(selfDed),
          dependentDeduction: Number(depDed),
          lunchCashExemptCap: 730000,
          sourceCitation,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Không thể lưu tham số pháp lý.");
        return;
      }
      setMsg("Đã lưu phiên bản tham số pháp lý mới vào legal_rule_registry.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <Settings className="h-5 w-5 text-amber-600" />
          Quản trị Hệ thống &amp; Tham số Pháp luật
        </h1>
        <p className="text-xs text-slate-500">
          Cấu hình tham số BHXH / Thuế TNCN / Lương tối thiểu theo ngày hiệu lực và trạng thái bảo mật.
        </p>
      </div>

      {msg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
          {msg}
        </div>
      )}

      {/* Legal Rule Registry */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900">
          1. Tham số Luật theo Hiệu lực (`legal_rule_registry`)
        </h2>
        <form onSubmit={handleAddRule} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            value={ruleCode}
            onChange={(e) => setRuleCode(e.target.value)}
            placeholder="Mã quy tắc"
            className="min-h-[44px] rounded-xl border border-slate-300 px-3 text-xs"
          />
          <input
            value={ruleVersion}
            onChange={(e) => setRuleVersion(e.target.value)}
            placeholder="Phiên bản"
            className="min-h-[44px] rounded-xl border border-slate-300 px-3 text-xs"
          />
          <input
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            className="min-h-[44px] rounded-xl border border-slate-300 px-3 text-xs"
          />
          <input
            type="number"
            value={region3MinWage}
            onChange={(e) => setRegion3MinWage(e.target.value)}
            placeholder="Lương tối thiểu Vùng III"
            className="min-h-[44px] rounded-xl border border-slate-300 px-3 text-xs"
          />
          <input
            type="number"
            value={bhxhRef}
            onChange={(e) => setBhxhRef(e.target.value)}
            placeholder="Mức tham chiếu BHXH"
            className="min-h-[44px] rounded-xl border border-slate-300 px-3 text-xs"
          />
          <input
            type="number"
            value={selfDed}
            onChange={(e) => setSelfDed(e.target.value)}
            placeholder="Giảm trừ bản thân"
            className="min-h-[44px] rounded-xl border border-slate-300 px-3 text-xs"
          />
          <input
            type="number"
            value={depDed}
            onChange={(e) => setDepDed(e.target.value)}
            placeholder="Giảm trừ NPT"
            className="min-h-[44px] rounded-xl border border-slate-300 px-3 text-xs"
          />
          <input
            value={sourceCitation}
            onChange={(e) => setSourceCitation(e.target.value)}
            placeholder="Căn cứ văn bản"
            className="min-h-[44px] rounded-xl border border-slate-300 px-3 text-xs"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Thêm phiên bản tham số
          </button>
        </form>

        <div className="mt-4">
          {loading ? (
            <SkeletonBlock rows={3} />
          ) : error ? (
            <ErrorRetry message={error} onRetry={load} />
          ) : rules.length === 0 ? (
            <EmptyState
              title="Chưa có bản ghi tham số trong DB"
              description="Hệ thống đang dùng bộ tham số dự phòng VN-2026-H2. Hãy thêm bản ghi mới ở biểu mẫu trên."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">Mã quy tắc</th>
                    <th className="py-2 pr-3">Hiệu lực từ</th>
                    <th className="py-2 pr-3">Đến ngày</th>
                    <th className="py-2 pr-3">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rules.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 pr-3 font-mono font-semibold">{r.rule_code}</td>
                      <td className="py-2 pr-3">{formatDateVi(r.effective_from)}</td>
                      <td className="py-2 pr-3">
                        {r.effective_to ? formatDateVi(r.effective_to) : "Không thời hạn"}
                      </td>
                      <td className="py-2 pr-3">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Feature Flags */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900">
          2. Trạng thái Module Mở rộng (Feature Flags)
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {Object.entries(FEATURE_FLAGS).map(([k, enabled]) => (
            <div
              key={k}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
            >
              <div className="font-semibold text-slate-800">{k}</div>
              <div className={enabled ? "text-emerald-700" : "text-slate-500"}>
                {enabled ? "Đang bật" : "Đang ẩn (Mặc định tắt)"}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Technical Infrastructure Status (Moved from Employee Footer) */}
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs text-emerald-900">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-4 w-4 text-emerald-700" />
          Hạ tầng &amp; Bảo mật: RLS Enabled • PII AES-256-GCM • Supabase PostgreSQL + Vercel sin1
        </div>
      </section>
    </div>
  );
}
