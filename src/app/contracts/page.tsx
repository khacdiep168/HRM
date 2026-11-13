"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FileSignature,
  AlertCircle,
  Clock,
  Download,
  Search,
  Sparkles,
} from "lucide-react";
import {
  CONTRACT_TYPE_LABELS,
  labelOf,
} from "@/lib/i18n/vi-labels";
import { SkeletonBlock } from "@/components/ui/StateViews";

interface ContractItem {
  id: string;
  contract_no: string;
  contract_type: string;
  signed_date: string;
  effective_from: string;
  effective_to: string | null;
  status: string;
  employees: { employee_code: string; full_name: string } | null;
}

interface ContractsPayload {
  contracts: ContractItem[];
  employees: Array<{ id: string; employee_code: string; full_name: string }>;
  bankAccounts: Array<{
    employee_id: string;
    bank_code: string;
    bank_name: string;
    account_no_masked: string;
  }>;
}

export default function ContractsPage() {
  const [data, setData] = useState<ContractsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  // Tabs: LIST | CREATE | TEMPLATES
  const [activeTab, setActiveTab] = useState<"LIST" | "CREATE" | "TEMPLATES">("LIST");

  // Expiry Filter
  type ExpiryTab = "ALL" | "EXPIRING_30" | "EXPIRING_60" | "EXPIRING_90" | "EXPIRED";
  const [expiryTab, setExpiryTab] = useState<ExpiryTab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Form State for Creating Contract
  const [employeeId, setEmployeeId] = useState("");
  const [contractNo, setContractNo] = useState("");
  const [contractType, setContractType] = useState<"FIXED_TERM" | "INDEFINITE" | "PROBATION">("FIXED_TERM");
  const [signedDate, setSignedDate] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [baseSalary, setBaseSalary] = useState("15000000");
  const [probationSalary, setProbationSalary] = useState("12750000"); // 85% of 15M
  const [probationPositionTier, setProbationPositionTier] = useState<"COLLEGE_DEGREE" | "VOCATIONAL" | "OTHER">("COLLEGE_DEGREE");
  const [bankCode, setBankCode] = useState("VCB");
  const [bankName, setBankName] = useState("Vietcombank");
  const [accountNo, setAccountNo] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Word Export Template State
  const [selectedTemplate, setSelectedTemplate] = useState<"PROBATION" | "FIXED_12M" | "INDEFINITE">("FIXED_12M");
  const [targetEmpForWord, setTargetEmpForWord] = useState<string>("");

  useEffect(() => {
    let active = true;
    fetch("/api/v1/contracts", { cache: "no-store" })
      .then(async (res) => {
        if (!active) return;
        const json = await res.json();
        if (!res.ok) {
          setError(json.error?.message ?? "Không thể tải hợp đồng lao động.");
          return;
        }
        const payload = json.data as ContractsPayload;
        setError(null);
        setData(payload);
        if (payload.employees.length > 0) {
          setEmployeeId((p) => p || payload.employees[0].id);
          setTargetEmpForWord((p) => p || payload.employees[0].id);
        }
      })
      .catch(() => {
        if (active) setError("Lỗi kết nối server.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadTick]);

  const contracts = useMemo(() => data?.contracts ?? [], [data]);
  const employees = useMemo(() => data?.employees ?? [], [data]);

  // Count past fixed term contracts for selected employee
  const selectedEmpPastFixedContracts = useMemo(() => {
    if (!employeeId) return 0;
    return contracts.filter(
      (c) => c.employees && employees.find((e) => e.id === employeeId)?.employee_code === c.employees.employee_code && c.contract_type === "FIXED_TERM"
    ).length;
  }, [employeeId, contracts, employees]);

  // Check labor compliance rules for current creation form
  const complianceAlerts = useMemo(() => {
    const alerts: Array<{ type: "ERROR" | "WARNING" | "INFO"; text: string }> = [];

    // Rule 1: Max 2 fixed-term contracts (BLLĐ 2019 Art. 20)
    if (contractType === "FIXED_TERM" && selectedEmpPastFixedContracts >= 2) {
      alerts.push({
        type: "ERROR",
        text: `Nhân viên này đã ký ${selectedEmpPastFixedContracts} lần HĐ xác định thời hạn. Theo Khoản 2 Điều 20 BLLĐ 2019, lần ký tiếp theo BẮT BUỘC là Hợp đồng không xác định thời hạn.`,
      });
    }

    // Rule 2: Probation duration (BLLĐ 2019 Art. 25)
    if (contractType === "PROBATION" && effectiveFrom && effectiveTo) {
      const from = new Date(effectiveFrom);
      const to = new Date(effectiveTo);
      const days = Math.round((to.getTime() - from.getTime()) / (1000 * 3600 * 24));

      let maxDays = 60;
      if (probationPositionTier === "VOCATIONAL") maxDays = 30;
      if (probationPositionTier === "OTHER") maxDays = 6;

      if (days > maxDays) {
        alerts.push({
          type: "ERROR",
          text: `Thời gian thử việc đã chọn là ${days} ngày, vượt quá trần ${maxDays} ngày theo Điều 25 BLLĐ 2019 cho cấp bậc này.`,
        });
      }
    }

    // Rule 3: Probation salary >= 85% of official salary (BLLĐ 2019 Art. 26)
    if (contractType === "PROBATION") {
      const base = Number(baseSalary) || 0;
      const prob = Number(probationSalary) || 0;
      if (base > 0 && prob < base * 0.85) {
        alerts.push({
          type: "ERROR",
          text: `Lương thử việc (${prob.toLocaleString("vi-VN")} ₫) thấp hơn 85% mức lương chính thức (${(base * 0.85).toLocaleString("vi-VN")} ₫) theo Điều 26 BLLĐ 2019.`,
        });
      }
    }

    return alerts;
  }, [contractType, selectedEmpPastFixedContracts, effectiveFrom, effectiveTo, probationPositionTier, baseSalary, probationSalary]);

  const [todayTime, setTodayTime] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTodayTime(new Date().setHours(0, 0, 0, 0));
  }, []);

  // Calculate days remaining until expiry for each contract
  const enrichedContracts = useMemo(() => {
    return contracts.map((c) => {
      let daysRemaining: number | null = null;
      let isExpired = false;
      let suggestion = "";

      if (c.effective_to && todayTime !== null) {
        const toDate = new Date(c.effective_to);
        toDate.setHours(0, 0, 0, 0);
        daysRemaining = Math.round((toDate.getTime() - todayTime) / (1000 * 3600 * 24));
        isExpired = daysRemaining < 0;
      }

      // Smart renewal suggestions
      if (c.contract_type === "PROBATION") {
        suggestion = "Đạt thử việc ➔ Ký HĐLĐ 12 hoặc 24 tháng (Khoản 1 Điều 20)";
      } else if (c.contract_type === "FIXED_TERM") {
        suggestion = "Hết hạn lần 1 ➔ Ký tiếp HĐ xác định thời hạn lần 2 hoặc Vô thời hạn";
      } else if (c.contract_type === "INDEFINITE") {
        suggestion = "Hợp đồng vô thời hạn (Không cần ký lại)";
      }

      return {
        ...c,
        daysRemaining,
        isExpired,
        suggestion,
      };
    });
  }, [contracts, todayTime]);

  // Expiry counts
  const expiryCounts = useMemo(() => {
    let exp30 = 0;
    let exp60 = 0;
    let exp90 = 0;
    let expired = 0;

    for (const c of enrichedContracts) {
      if (c.daysRemaining !== null) {
        if (c.daysRemaining < 0) expired++;
        else if (c.daysRemaining <= 30) exp30++;
        else if (c.daysRemaining <= 60) exp60++;
        else if (c.daysRemaining <= 90) exp90++;
      }
    }

    return { all: enrichedContracts.length, exp30, exp60, exp90, expired };
  }, [enrichedContracts]);

  // Filtered contracts
  const filteredContracts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return enrichedContracts.filter((c) => {
      const matchQuery =
        !query ||
        c.contract_no.toLowerCase().includes(query) ||
        (c.employees?.full_name ?? "").toLowerCase().includes(query) ||
        (c.employees?.employee_code ?? "").toLowerCase().includes(query);

      let matchExpiry = true;
      if (expiryTab === "EXPIRING_30") {
        matchExpiry = c.daysRemaining !== null && c.daysRemaining >= 0 && c.daysRemaining <= 30;
      } else if (expiryTab === "EXPIRING_60") {
        matchExpiry = c.daysRemaining !== null && c.daysRemaining >= 0 && c.daysRemaining <= 60;
      } else if (expiryTab === "EXPIRING_90") {
        matchExpiry = c.daysRemaining !== null && c.daysRemaining >= 0 && c.daysRemaining <= 90;
      } else if (expiryTab === "EXPIRED") {
        matchExpiry = Boolean(c.isExpired);
      }

      return matchQuery && matchExpiry;
    });
  }, [enrichedContracts, searchQuery, expiryTab]);

  // Submit contract
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);

    // Block if there are critical compliance errors
    const hasComplianceError = complianceAlerts.some((a) => a.type === "ERROR");
    if (hasComplianceError) {
      setErr("Không thể lưu: Vui lòng sửa các cảnh báo vi phạm Bộ luật Lao động 2019 bên dưới.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/v1/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          contractNo,
          contractType,
          signedDate,
          effectiveFrom,
          effectiveTo: effectiveTo || null,
          probationRate: contractType === "PROBATION" ? Math.max(0.85, (Number(probationSalary) || 0) / (Number(baseSalary) || 1)) : 1,
          bankCode: accountNo ? bankCode : undefined,
          bankName: accountNo ? bankName : undefined,
          accountNo: accountNo || undefined,
          accountHolder: accountHolder || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error?.message ?? "Tạo hợp đồng thất bại.");
        return;
      }
      setMsg("Đã tạo HĐLĐ thành công, kích hoạt lưu trữ 10 năm theo Luật Lao động.");
      setContractNo("");
      setAccountNo("");
      setActiveTab("LIST");
      setReloadTick((t) => t + 1);
    } finally {
      setSaving(false);
    }
  }

  // Generate and Download Word Document
  function handleDownloadWordDoc() {
    const emp = employees.find((e) => e.id === targetEmpForWord);
    if (!emp) return;

    const typeTitle =
      selectedTemplate === "PROBATION"
        ? "HỢP ĐỒNG THỬ VIỆC"
        : selectedTemplate === "FIXED_12M"
        ? "HỢP ĐỒNG LAO ĐỘNG XÁC ĐỊNH THỜI HẠN (12 THÁNG)"
        : "HỢP ĐỒNG LAO ĐỘNG KHÔNG XÁC ĐỊNH THỜI HẠN";

    const wordContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${typeTitle}</title>
        <style>
          body { font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.5; margin: 40px; }
          h1, h2, h3 { text-align: center; margin: 0; }
          .header-box { text-align: center; margin-bottom: 25px; }
          .title { font-size: 16pt; font-bold: true; text-transform: uppercase; margin-top: 20px; }
          .bold { font-weight: bold; }
          .field { font-weight: bold; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header-box">
          <h3>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</h3>
          <h4>Độc lập - Tự do - Hạnh phúc</h4>
          <p>-------------------------</p>
        </div>

        <h2 class="title">${typeTitle}</h2>
        <p style="text-align: center; font-style: italic;">Số: HD-${emp.employee_code}/2026/TKV</p>

        <p>Hôm nay, ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}, tại Tây Ninh, chúng tôi gồm có:</p>

        <p class="bold">BÊN NGƯỜI SỬ DỤNG LAO ĐỘNG (BÊN A):</p>
        <p>- Tên doanh nghiệp: <b>CÔNG TY TNHH THƯƠNG MẠI THẾ KỶ VÀNG</b></p>
        <p>- Mã số thuế: 3900336463</p>
        <p>- Đại diện: <b>Ông Nguyễn Minh Tuấn</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Chức vụ: Giám đốc</p>
        <p>- Địa chỉ: Khu kinh tế Cửa khẩu Mộc Bài, xã Bến Cầu, tỉnh Tây Ninh</p>

        <p class="bold">BÊN NGƯỜI LAO ĐỘNG (BÊN B):</p>
        <p>- Họ và tên: <span class="field">${emp.full_name}</span></p>
        <p>- Mã nhân viên: <span class="field">${emp.employee_code}</span></p>
        <p>- Quốc tịch: Việt Nam</p>

        <p class="bold">ĐIỀU 1: CÔNG VIỆC VÀ ĐỊA ĐIỂM LÀM VIỆC</p>
        <p>- Vị trí chuyên môn: Nhân viên nghiệp vụ</p>
        <p>- Địa điểm làm việc: Trụ sở chính &amp; các chi nhánh của Công ty tại Tây Ninh</p>

        <p class="bold">ĐIỀU 2: CHẾ ĐỘ LƯƠNG VÀ BẢO HIỂM</p>
        <p>- Mức lương cơ bản: <b>15.000.000 VNĐ/tháng</b></p>
        <p>- Phụ cấp ăn trưa: 1.000.000 VNĐ/tháng (miễn thuế TNCN)</p>
        <p>- Chế độ BHXH, BHYT, BHTN: Đóng đầy đủ theo quy định của Luật Bảo hiểm xã hội và Vùng III Tây Ninh.</p>

        <table>
          <tr>
            <td style="width: 50%; text-align: center;">
              <b>ĐẠI DIỆN BÊN A</b><br>
              <i>(Ký và đóng dấu)</i><br><br><br><br>
              <b>Nguyễn Minh Tuấn</b>
            </td>
            <td style="width: 50%; text-align: center;">
              <b>ĐẠI DIỆN BÊN B</b><br>
              <i>(Ký và ghi rõ họ tên)</i><br><br><br><br>
              <b>${emp.full_name}</b>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([wordContent], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Hop_dong_lao_dong_${emp.employee_code}_${emp.full_name.replace(/\s+/g, "_")}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonBlock rows={3} />
        <SkeletonBlock rows={8} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900">
        <div className="flex items-center gap-2 font-bold">
          <AlertCircle className="h-5 w-5 text-rose-600" />
          Không thể tải dữ liệu hợp đồng
        </div>
        <p className="mt-2 text-xs">{error}</p>
        <button
          onClick={() => {
            setLoading(true);
            setReloadTick((t) => t + 1);
          }}
          className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <FileSignature className="h-6 w-6 text-amber-600" />
            Hợp đồng Lao động &amp; Cảnh báo Luật định BLLĐ 2019
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Kiểm tra trần thử việc 60 ngày • Chặn ký quá 2 lần HĐ xác định thời hạn • Gợi ý ký tiếp • Soạn thảo &amp; Xuất file Word.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab buttons */}
          <div className="flex rounded-xl border border-slate-200 bg-white p-1 text-xs font-semibold shadow-sm">
            <button
              onClick={() => setActiveTab("LIST")}
              className={`rounded-lg px-3.5 py-1.5 transition-all ${
                activeTab === "LIST"
                  ? "bg-slate-900 font-bold text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Danh sách HĐ ({contracts.length})
            </button>
            <button
              onClick={() => setActiveTab("CREATE")}
              className={`rounded-lg px-3.5 py-1.5 transition-all ${
                activeTab === "CREATE"
                  ? "bg-slate-900 font-bold text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              + Lập HĐLĐ mới
            </button>
            <button
              onClick={() => setActiveTab("TEMPLATES")}
              className={`rounded-lg px-3.5 py-1.5 transition-all ${
                activeTab === "TEMPLATES"
                  ? "bg-slate-900 font-bold text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              📄 Mẫu HĐ &amp; Xuất Word
            </button>
          </div>
        </div>
      </div>

      {msg && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{msg}</div>}
      {err && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{err}</div>}

      {/* TAB 1: LIST CONTRACTS WITH 30-60-90 DAYS EXPIRY FILTER & SMART SUGGESTIONS */}
      {activeTab === "LIST" && (
        <div className="space-y-4">
          {/* Expiry Filter Bar */}
          <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setExpiryTab("ALL")}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                expiryTab === "ALL"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span>Tất cả</span>
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${expiryTab === "ALL" ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-700"}`}>
                {expiryCounts.all}
              </span>
            </button>

            <button
              onClick={() => setExpiryTab("EXPIRING_30")}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                expiryTab === "EXPIRING_30"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Cần ký trong 30 ngày tới</span>
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${expiryTab === "EXPIRING_30" ? "bg-rose-700 text-white" : "bg-rose-200 text-rose-800"}`}>
                {expiryCounts.exp30}
              </span>
            </button>

            <button
              onClick={() => setExpiryTab("EXPIRING_60")}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                expiryTab === "EXPIRING_60"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span>Trong 60 ngày tới</span>
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${expiryTab === "EXPIRING_60" ? "bg-amber-700 text-white" : "bg-slate-100 text-slate-700"}`}>
                {expiryCounts.exp60}
              </span>
            </button>

            <button
              onClick={() => setExpiryTab("EXPIRING_90")}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                expiryTab === "EXPIRING_90"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span>Trong 90 ngày tới</span>
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${expiryTab === "EXPIRING_90" ? "bg-sky-700 text-white" : "bg-slate-100 text-slate-700"}`}>
                {expiryCounts.exp90}
              </span>
            </button>

            <button
              onClick={() => setExpiryTab("EXPIRED")}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                expiryTab === "EXPIRED"
                  ? "bg-slate-700 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span>Đã hết hạn</span>
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${expiryTab === "EXPIRED" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700"}`}>
                {expiryCounts.expired}
              </span>
            </button>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo số hợp đồng, họ tên, mã nhân viên..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-3 pl-9 text-xs outline-none focus:border-amber-500"
            />
          </div>

          {/* Contracts Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Mã &amp; Họ tên NV</th>
                    <th className="px-4 py-3">Số HĐLĐ</th>
                    <th className="px-4 py-3">Loại hợp đồng</th>
                    <th className="px-4 py-3">Thời hạn hiệu lực</th>
                    <th className="px-4 py-3">Tình trạng hạn</th>
                    <th className="px-4 py-3">Gợi ý loại HĐ ký tiếp (BLLĐ 2019)</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredContracts.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{c.employees?.full_name ?? "—"}</div>
                        <div className="font-mono text-[11px] text-slate-400">{c.employees?.employee_code ?? "—"}</div>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-800">{c.contract_no}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                          {labelOf(CONTRACT_TYPE_LABELS, c.contract_type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">
                        <div>{c.effective_from} ➔ {c.effective_to ?? "Không thời hạn"}</div>
                      </td>
                      <td className="px-4 py-3">
                        {c.daysRemaining === null ? (
                          <span className="font-semibold text-emerald-700">Vô thời hạn</span>
                        ) : c.daysRemaining < 0 ? (
                          <span className="rounded-md bg-rose-100 px-2 py-0.5 font-bold text-rose-800">
                            Quá hạn {Math.abs(c.daysRemaining)} ngày
                          </span>
                        ) : c.daysRemaining <= 30 ? (
                          <span className="rounded-md bg-amber-100 px-2 py-0.5 font-bold text-amber-900">
                            Còn {c.daysRemaining} ngày
                          </span>
                        ) : (
                          <span className="text-slate-500 font-medium">Còn {c.daysRemaining} ngày</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 border border-emerald-200">
                          <Sparkles className="h-3 w-3 text-emerald-600" />
                          {c.suggestion}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            setTargetEmpForWord(employees.find((e) => e.employee_code === c.employees?.employee_code)?.id ?? "");
                            setActiveTab("TEMPLATES");
                          }}
                          className="font-bold text-amber-700 hover:text-amber-800"
                        >
                          Xuất Word
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredContracts.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        Không có hợp đồng nào thuộc diện lọc hiện tại.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CREATE CONTRACT WITH LABOR CODE 2019 COMPLIANCE CHECKS */}
      {activeTab === "CREATE" && (
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <FileSignature className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Lập Hợp đồng Lao động Mới</h2>
              <p className="text-xs text-slate-500">Hệ thống tự động kiểm tra tính tuân thủ Bộ luật Lao động 2019</p>
            </div>
          </div>

          {/* Compliance Alerts Box */}
          {complianceAlerts.length > 0 && (
            <div className="mt-4 space-y-2">
              {complianceAlerts.map((a, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2.5 rounded-xl p-3 text-xs ${
                    a.type === "ERROR"
                      ? "border border-rose-200 bg-rose-50 text-rose-800 font-semibold"
                      : "border border-amber-200 bg-amber-50 text-amber-800"
                  }`}
                >
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div>{a.text}</div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-xs">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="font-bold text-slate-800">Nhân viên nhận hợp đồng *</label>
                <select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.employee_code} — {e.full_name}
                    </option>
                  ))}
                </select>
                <div className="mt-1 text-[11px] text-slate-500">
                  Đã ký {selectedEmpPastFixedContracts} lần HĐ xác định thời hạn trước đây
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-800">Số hiệu HĐLĐ *</label>
                <input
                  required
                  placeholder="VD: HD-2026-TKV-055"
                  value={contractNo}
                  onChange={(e) => setContractNo(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 font-mono text-xs uppercase"
                />
              </div>

              <div>
                <label className="font-bold text-slate-800">Loại hợp đồng lao động *</label>
                <select
                  value={contractType}
                  onChange={(e) => setContractType(e.target.value as typeof contractType)}
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold"
                >
                  <option value="PROBATION">Hợp đồng thử việc (Tối đa 60 ngày)</option>
                  <option value="FIXED_TERM">Xác định thời hạn (Tối đa 2 lần)</option>
                  <option value="INDEFINITE">Không xác định thời hạn (Bắt buộc từ lần 3)</option>
                </select>
              </div>

              {contractType === "PROBATION" && (
                <div>
                  <label className="font-bold text-slate-800">Cấp bậc chuyên môn (Xác định trần thử việc) *</label>
                  <select
                    value={probationPositionTier}
                    onChange={(e) => setProbationPositionTier(e.target.value as typeof probationPositionTier)}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs"
                  >
                    <option value="COLLEGE_DEGREE">Cao đẳng, Đại học trở lên (Tối đa 60 ngày)</option>
                    <option value="VOCATIONAL">Trung cấp, công nhân kỹ thuật (Tối đa 30 ngày)</option>
                    <option value="OTHER">Lao động phổ thông, khác (Tối đa 6 ngày)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-800">Ngày ký kết *</label>
                <input
                  type="date"
                  required
                  value={signedDate}
                  onChange={(e) => setSignedDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-800">Hiệu lực từ ngày *</label>
                <input
                  type="date"
                  required
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-xs"
                />
              </div>

              {contractType !== "INDEFINITE" && (
                <div>
                  <label className="font-bold text-slate-800">Hiệu lực đến ngày *</label>
                  <input
                    type="date"
                    required
                    value={effectiveTo}
                    onChange={(e) => setEffectiveTo(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-xs"
                  />
                </div>
              )}
            </div>

            {/* Salary Setup */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="font-bold text-slate-900">Mức lương thỏa thuận &amp; Chế độ</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-slate-700">Mức lương chính thức (đ/tháng)</label>
                  <input
                    type="number"
                    value={baseSalary}
                    onChange={(e) => {
                      setBaseSalary(e.target.value);
                      if (contractType === "PROBATION") {
                        setProbationSalary(String(Math.round(Number(e.target.value) * 0.85)));
                      }
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2 font-mono"
                  />
                </div>
                {contractType === "PROBATION" && (
                  <div>
                    <label className="text-slate-700">Lương thử việc (Tối thiểu 85%)</label>
                    <input
                      type="number"
                      value={probationSalary}
                      onChange={(e) => setProbationSalary(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2 font-mono font-bold text-emerald-700"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Bank Account */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="font-bold text-slate-900">Tài khoản ngân hàng nhận lương (Tùy chọn)</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-slate-700">Ngân hàng</label>
                  <input
                    value={bankName}
                    onChange={(e) => {
                      setBankName(e.target.value);
                      setBankCode(e.target.value.slice(0, 4).toUpperCase());
                    }}
                    placeholder="Vietcombank / BIDV"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2"
                  />
                </div>
                <div>
                  <label className="text-slate-700">Số tài khoản</label>
                  <input
                    value={accountNo}
                    onChange={(e) => setAccountNo(e.target.value)}
                    placeholder="Số tài khoản ngân hàng"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2 font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-slate-700">Tên chủ tài khoản</label>
                  <input
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    placeholder="NGUYEN VAN A"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2 uppercase"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setActiveTab("LIST")}
                className="rounded-xl border border-slate-200 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-amber-600 px-6 py-2.5 font-bold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
              >
                {saving ? "Đang lưu..." : "Lưu Hợp đồng Lao động"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: TEMPLATES & WORD EXPORT */}
      {activeTab === "TEMPLATES" && (
        <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Mẫu Hợp đồng Soạn thảo &amp; Xuất file Word</h2>
              <p className="text-xs text-slate-500">Mẫu chuẩn theo Bộ luật Lao động 2019 của Công ty TNHH Thương mại Thế Kỷ Vàng</p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={targetEmpForWord}
                onChange={(e) => setTargetEmpForWord(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold"
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    Điền cho: {e.employee_code} — {e.full_name}
                  </option>
                ))}
              </select>

              <button
                onClick={handleDownloadWordDoc}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800"
              >
                <Download className="h-4 w-4" />
                Xuất file Word (.doc)
              </button>
            </div>
          </div>

          {/* Template Selection Tabs */}
          <div className="mt-4 flex gap-2 border-b border-slate-100 pb-3 text-xs font-semibold">
            <button
              onClick={() => setSelectedTemplate("FIXED_12M")}
              className={`rounded-lg px-3 py-1.5 ${
                selectedTemplate === "FIXED_12M" ? "bg-amber-100 text-amber-900 font-bold" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              HĐLĐ Xác định thời hạn (12 tháng)
            </button>
            <button
              onClick={() => setSelectedTemplate("PROBATION")}
              className={`rounded-lg px-3 py-1.5 ${
                selectedTemplate === "PROBATION" ? "bg-amber-100 text-amber-900 font-bold" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Hợp đồng Thử việc (60 ngày)
            </button>
            <button
              onClick={() => setSelectedTemplate("INDEFINITE")}
              className={`rounded-lg px-3 py-1.5 ${
                selectedTemplate === "INDEFINITE" ? "bg-amber-100 text-amber-900 font-bold" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              HĐLĐ Không xác định thời hạn
            </button>
          </div>

          {/* Merge Tags Guide */}
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-600">
            <span className="font-bold text-slate-800">Các biến trường thông minh tự động điền:</span>
            <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-mono">
              <span className="rounded bg-white px-2 py-0.5 border">{"{{ho_ten}}"}</span>
              <span className="rounded bg-white px-2 py-0.5 border">{"{{ma_nv}}"}</span>
              <span className="rounded bg-white px-2 py-0.5 border">{"{{luong_co_ban}}"}</span>
              <span className="rounded bg-white px-2 py-0.5 border">{"{{chuc_danh}}"}</span>
              <span className="rounded bg-white px-2 py-0.5 border">{"{{dia_chi}}"}</span>
              <span className="rounded bg-white px-2 py-0.5 border">{"{{ngay_hieu_luc}}"}</span>
            </div>
          </div>

          {/* Preview Box */}
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs font-serif text-sm leading-relaxed text-slate-800">
            <div className="text-center font-bold">
              <div className="text-base">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
              <div className="text-xs">Độc lập - Tự do - Hạnh phúc</div>
              <div className="mt-3 text-lg uppercase tracking-wide">
                {selectedTemplate === "PROBATION"
                  ? "HỢP ĐỒNG THỬ VIỆC"
                  : selectedTemplate === "FIXED_12M"
                  ? "HỢP ĐỒNG LAO ĐỘNG XÁC ĐỊNH THỜI HẠN"
                  : "HỢP ĐỒNG LAO ĐỘNG KHÔNG XÁC ĐỊNH THỜI HẠN"}
              </div>
            </div>

            <div className="mt-6 space-y-3 text-xs">
              <p><b>BÊN NGƯỜI SỬ DỤNG LAO ĐỘNG (BÊN A):</b> CÔNG TY TNHH THƯƠNG MẠI THẾ KỶ VÀNG (MST: 3900336463)</p>
              <p>Đại diện: <b>Ông Nguyễn Minh Tuấn</b> — Giám đốc</p>
              <p>
                <b>BÊN NGƯỜI LAO ĐỘNG (BÊN B):</b>{" "}
                <span className="font-bold text-amber-700">
                  {employees.find((e) => e.id === targetEmpForWord)?.full_name ?? "Nguyễn Văn A"} (Mã NV: {employees.find((e) => e.id === targetEmpForWord)?.employee_code ?? "TKV-0001"})
                </span>
              </p>
              <p><b>Điều 1:</b> Thực hiện công việc chuyên môn theo sự phân công của Ban Giám đốc và Trưởng bộ phận.</p>
              <p><b>Điều 2:</b> Mức lương cơ bản thỏa thuận: <b>15.000.000 ₫/tháng</b> + Phụ cấp ăn trưa 1.000.000 ₫.</p>
              <p><b>Điều 3:</b> Thời gian làm việc 8 giờ/ngày, 44 giờ/tuần; Chế độ bảo hiểm theo quy định Vùng III Tây Ninh.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
