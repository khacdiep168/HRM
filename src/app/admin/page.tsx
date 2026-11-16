"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  Camera,
  CheckCircle2,
  FileText,
  Globe,
  Mail,
  MapPin,
  Phone,
  Plus,
  Save,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
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

interface CompanyConfig {
  id: string;
  code: string;
  legalName: string;
  englishName: string | null;
  taxCode: string;
  address: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  representative: string | null;
  logoUrl: string | null;
  defaultCurrency: string;
  timezone: string;
  payrollCutoffDay: number;
  payrollAdvanceDay: number;
  updatedAt: string | null;
}

async function compressImageFile(file: File, maxDimension = 320, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/png", quality));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<"COMPANY" | "LEGAL_RULES" | "FEATURE_FLAGS">("COMPANY");

  // Company State
  const [company, setCompany] = useState<CompanyConfig | null>(null);
  const [compLoading, setCompLoading] = useState(true);
  const [compSaving, setCompSaving] = useState(false);
  const [compForm, setCompForm] = useState({
    legalName: "",
    englishName: "",
    taxCode: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    representative: "",
    logoUrl: "",
    payrollCutoffDay: 25,
    payrollAdvanceDay: 15,
  });

  // Legal Rules State
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

  const loadRules = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadTick((t) => t + 1);
  }, []);

  // Fetch Company Config
  useEffect(() => {
    let active = true;
    setCompLoading(true);
    fetch("/api/v1/admin/company", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!active) return;
        if (res.ok && json.data) {
          const c: CompanyConfig = json.data;
          setCompany(c);
          setCompForm({
            legalName: c.legalName || "",
            englishName: c.englishName || "",
            taxCode: c.taxCode || "",
            address: c.address || "",
            phone: c.phone || "",
            email: c.email || "",
            website: c.website || "",
            representative: c.representative || "",
            logoUrl: c.logoUrl || "",
            payrollCutoffDay: c.payrollCutoffDay || 25,
            payrollAdvanceDay: c.payrollAdvanceDay || 15,
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setCompLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadTick]);

  // Fetch Legal Rules
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

  // Save Company Config
  async function handleSaveCompany(e: React.FormEvent) {
    e.preventDefault();
    setCompSaving(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName: compForm.legalName.trim(),
          englishName: compForm.englishName.trim() || null,
          taxCode: compForm.taxCode.trim(),
          address: compForm.address.trim(),
          phone: compForm.phone.trim() || null,
          email: compForm.email.trim() || null,
          website: compForm.website.trim() || null,
          representative: compForm.representative.trim() || null,
          logoUrl: compForm.logoUrl || null,
          payrollCutoffDay: Number(compForm.payrollCutoffDay),
          payrollAdvanceDay: Number(compForm.payrollAdvanceDay),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Không thể lưu thông tin công ty.");
        return;
      }
      setMsg("Đã cập nhật thông tin pháp nhân & logo công ty thành công!");
      setReloadTick((t) => t + 1);
    } catch {
      setError("Lỗi kết nối khi lưu thông tin công ty.");
    } finally {
      setCompSaving(false);
    }
  }

  // Save Legal Rule
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
      await loadRules();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Settings className="h-5 w-5 text-amber-600" />
            Cài đặt Hệ thống &amp; Tham số Công ty
          </h1>
          <p className="text-xs text-slate-500">
            Cấu hình thông tin pháp nhân công ty, logo, tham số BHXH / Thuế TNCN và các tính năng hệ thống.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800"
          >
            <UserCheck className="h-4 w-4 text-amber-400" />
            Quản lý Người dùng &amp; Phân quyền →
          </Link>
        </div>
      </div>

      {msg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          {msg}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 text-xs font-semibold text-slate-600">
        <button
          type="button"
          onClick={() => setActiveTab("COMPANY")}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 transition-all ${
            activeTab === "COMPANY"
              ? "border-amber-600 font-bold text-amber-700"
              : "border-transparent hover:text-slate-900"
          }`}
        >
          <Building2 className="h-4 w-4" />
          Thông tin &amp; Thương hiệu Công ty
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("LEGAL_RULES")}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 transition-all ${
            activeTab === "LEGAL_RULES"
              ? "border-amber-600 font-bold text-amber-700"
              : "border-transparent hover:text-slate-900"
          }`}
        >
          <FileText className="h-4 w-4" />
          Tham số Pháp lý (BHXH / PIT / Lương tối thiểu)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("FEATURE_FLAGS")}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 transition-all ${
            activeTab === "FEATURE_FLAGS"
              ? "border-amber-600 font-bold text-amber-700"
              : "border-transparent hover:text-slate-900"
          }`}
        >
          <Settings className="h-4 w-4" />
          Module Mở rộng (Feature Flags)
        </button>
      </div>

      {/* TAB 1: COMPANY SETTINGS */}
      {activeTab === "COMPANY" && (
        <div className="space-y-6">
          {compLoading ? (
            <SkeletonBlock rows={5} />
          ) : (
            <form onSubmit={handleSaveCompany} className="space-y-6">
              {/* Logo & Brand Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <h2 className="text-sm font-bold text-slate-900">
                  Logo &amp; Nhận diện Thương hiệu
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Logo hiển thị ở Header, Sidebar menu và trên các biểu mẫu xuất phiếu lương, hợp đồng.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-6">
                  <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 shadow-xs">
                    {compForm.logoUrl ? (
                      <img
                        src={compForm.logoUrl}
                        alt="Logo công ty"
                        className="h-full w-full object-contain p-2"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-2 text-center text-slate-400">
                        <Building2 className="h-8 w-8 stroke-[1.5]" />
                        <span className="mt-1 text-[10px] font-semibold">Chưa có logo</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50">
                        <Upload className="h-3.5 w-3.5 text-amber-600" />
                        Tải logo từ máy tính
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const base64 = await compressImageFile(file, 256, 0.85);
                                setCompForm((prev) => ({ ...prev, logoUrl: base64 }));
                              } catch {
                                setError("Không thể đọc file logo ảnh.");
                              }
                            }
                          }}
                        />
                      </label>

                      {compForm.logoUrl && (
                        <button
                          type="button"
                          onClick={() => setCompForm((prev) => ({ ...prev, logoUrl: "" }))}
                          className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Gỡ logo
                        </button>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Định dạng PNG, JPG, SVG hoặc WebP. Hệ thống tự động tối ưu hiển thị sắc nét.
                    </div>
                  </div>
                </div>
              </div>

              {/* Company Profile Details */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <h2 className="text-sm font-bold text-slate-900">
                  Thông tin Pháp nhân Doanh nghiệp
                </h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                  <div className="sm:col-span-2">
                    <label className="font-semibold text-slate-700">Tên công ty đầy đủ (In hoa có dấu) *</label>
                    <input
                      required
                      value={compForm.legalName}
                      onChange={(e) => setCompForm({ ...compForm, legalName: e.target.value })}
                      placeholder="CÔNG TY TNHH THƯƠNG MẠI THẾ KỶ VÀNG"
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-semibold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700">Mã số thuế (MST) *</label>
                    <input
                      required
                      value={compForm.taxCode}
                      onChange={(e) => setCompForm({ ...compForm, taxCode: e.target.value })}
                      placeholder="3900336463"
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="font-medium text-slate-700">Tên tiếng Anh / Tên viết tắt</label>
                    <input
                      value={compForm.englishName}
                      onChange={(e) => setCompForm({ ...compForm, englishName: e.target.value })}
                      placeholder="THE KY VANG TRADING CO., LTD"
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="font-medium text-slate-700">Người đại diện pháp luật</label>
                    <input
                      value={compForm.representative}
                      onChange={(e) => setCompForm({ ...compForm, representative: e.target.value })}
                      placeholder="Phan Ngọc Bảo Châu"
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="font-medium text-slate-700">Số điện thoại liên hệ</label>
                    <div className="relative mt-1">
                      <Phone className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        value={compForm.phone}
                        onChange={(e) => setCompForm({ ...compForm, phone: e.target.value })}
                        placeholder="0276 388 9999"
                        className="w-full rounded-xl border border-slate-300 py-2 pr-3 pl-9 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-medium text-slate-700">Email công ty</label>
                    <div className="relative mt-1">
                      <Mail className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="email"
                        value={compForm.email}
                        onChange={(e) => setCompForm({ ...compForm, email: e.target.value })}
                        placeholder="contact@thekyvang.vn"
                        className="w-full rounded-xl border border-slate-300 py-2 pr-3 pl-9"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-medium text-slate-700">Website chính thức</label>
                    <div className="relative mt-1">
                      <Globe className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        value={compForm.website}
                        onChange={(e) => setCompForm({ ...compForm, website: e.target.value })}
                        placeholder="https://thekyvang.vn"
                        className="w-full rounded-xl border border-slate-300 py-2 pr-3 pl-9"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="font-semibold text-slate-700">Địa chỉ trụ sở chính *</label>
                    <div className="relative mt-1">
                      <MapPin className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        required
                        value={compForm.address}
                        onChange={(e) => setCompForm({ ...compForm, address: e.target.value })}
                        placeholder="Số 123 đường 30/4, Phường 3, TP. Tây Ninh, Tỉnh Tây Ninh"
                        className="w-full rounded-xl border border-slate-300 py-2 pr-3 pl-9"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Payroll Cycle Config */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <h2 className="text-sm font-bold text-slate-900">
                  Chu kỳ Chấm công &amp; Tạm ứng Lương
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Cấu hình các mốc ngày định kỳ để hệ thống tự động khóa bảng công và lập đề xuất tạm ứng.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 text-xs">
                  <div>
                    <label className="font-semibold text-slate-700">
                      Ngày chốt bảng công hàng tháng (1 - 28)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={28}
                      value={compForm.payrollCutoffDay}
                      onChange={(e) => setCompForm({ ...compForm, payrollCutoffDay: Number(e.target.value) })}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono font-bold"
                    />
                    <div className="mt-1 text-[11px] text-slate-400">
                      Ví dụ ngày 25: kỳ công tính từ ngày 26 tháng trước đến ngày 25 tháng này.
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700">
                      Ngày tạm ứng lương hàng tháng (1 - 28)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={28}
                      value={compForm.payrollAdvanceDay}
                      onChange={(e) => setCompForm({ ...compForm, payrollAdvanceDay: Number(e.target.value) })}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono font-bold"
                    />
                    <div className="mt-1 text-[11px] text-slate-400">
                      Mặc định ngày 15: hệ thống tự động tạo danh sách tạm ứng giữa kỳ.
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3">
                <button
                  type="submit"
                  disabled={compSaving}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {compSaving ? "Đang lưu cấu hình..." : "Lưu thông tin Công ty"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* TAB 2: LEGAL RULES */}
      {activeTab === "LEGAL_RULES" && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900">
              Thêm Phiên bản Tham số Luật (`legal_rule_registry`)
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
                <ErrorRetry message={error} onRetry={loadRules} />
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
        </div>
      )}

      {/* TAB 3: FEATURE FLAGS */}
      {activeTab === "FEATURE_FLAGS" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900">
            Trạng thái Module Mở rộng (Feature Flags)
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
      )}

      {/* Technical Infrastructure Status */}
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs text-emerald-900">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-4 w-4 text-emerald-700" />
          Hạ tầng &amp; Bảo mật: RLS Enabled • PII AES-256-GCM • Supabase PostgreSQL + Vercel sin1
        </div>
      </section>
    </div>
  );
}
