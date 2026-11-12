"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Plus,
  Eye,
  AlertCircle,
  X,
  Search,
  Building2,
  MapPin,
  Save,
  ChevronRight,
  Phone,
  Shield,
  FileSignature,
  Wallet,
  Upload,
  Download,
} from "lucide-react";
import { buildUtf8BomCsv, parseCsvText } from "@/lib/integrations/csv-helper";
import {
  CONTRACT_TYPE_LABELS,
  EMPLOYMENT_STATUS_LABELS,
  GENDER_LABELS,
  labelOf,
} from "@/lib/i18n/vi-labels";

interface OrgAssignmentRef {
  department_id: string;
  position_id: string;
  location_id: string;
  cost_center_id: string;
  is_primary: boolean;
}

interface EmployeeRow {
  id: string;
  employee_code: string;
  full_name: string;
  dob: string | null;
  gender: string | null;
  nationality: string;
  national_id_masked: string;
  phone_masked: string;
  work_email: string | null;
  personal_email: string | null;
  emergency_contact_name: string | null;
  employment_status: string;
  hire_date: string;
  social_insurance_no?: string | null;
  health_insurance_no?: string | null;
  pit_tax_code?: string | null;
  dependent_count?: number;
  active_contract?: {
    contract_no: string;
    contract_type: string;
    effective_from: string;
    effective_to: string | null;
  } | null;
  salary_info?: {
    base_salary: number;
    si_salary_base: number;
  } | null;
  bank_info?: {
    bank_name: string;
    account_last4: string;
  } | null;
  org_assignments?: OrgAssignmentRef[];
}

interface OrgRefs {
  departments: Array<{ id: string; code: string; name: string }>;
  positions: Array<{ id: string; department_id: string; code: string; title: string }>;
  locations: Array<{ id: string; code: string; name: string }>;
  costCenters: Array<{ id: string; code: string; name: string }>;
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PROBATION: "bg-amber-50 text-amber-700 border-amber-200",
  ONBOARDING: "bg-sky-50 text-sky-700 border-sky-200",
  ON_LEAVE: "bg-purple-50 text-purple-700 border-purple-200",
  TERMINATED: "bg-slate-100 text-slate-500 border-slate-200",
};

const fmtVnd = (n: number) => `${Math.round(Number(n)).toLocaleString("vi-VN")} đ`;

export default function EmployeesPage() {
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [orgRefs, setOrgRefs] = useState<OrgRefs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [formState, setFormState] = useState({
    employeeCode: "",
    fullName: "",
    dob: "",
    gender: "MALE",
    phone: "",
    workEmail: "",
    nationalId: "",
    hireDate: "",
    employmentStatus: "ACTIVE",
    departmentId: "",
    positionId: "",
    locationId: "",
    costCenterId: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Detail/Edit drawer
  const [selectedEmp, setSelectedEmp] = useState<EmployeeRow | null>(null);
  const [editState, setEditState] = useState({
    fullName: "",
    dob: "",
    gender: "MALE",
    hireDate: "",
    phone: "",
    personalEmail: "",
    workEmail: "",
    socialInsuranceNo: "",
    healthInsuranceNo: "",
    pitTaxCode: "",
    baseSalary: "",
    siSalaryBase: "",
    dependentCount: "0",
    employmentStatus: "ACTIVE",
    departmentId: "",
    positionId: "",
    locationId: "",
    costCenterId: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [unmaskReason, setUnmaskReason] = useState("");
  const [unmaskedResult, setUnmaskedResult] = useState<string | null>(null);
  const [unmaskError, setUnmaskError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/v1/employees", { cache: "no-store" }),
      fetch("/api/v1/org/tree", { cache: "no-store" }),
    ])
      .then(async ([empRes, orgRes]) => {
        if (!active) return;
        const empJson = await empRes.json();
        if (!empRes.ok) {
          setError(empJson.error?.message ?? "Không thể tải danh sách nhân sự.");
          return;
        }
        setError(null);
        setRows(empJson.data ?? []);

        if (orgRes.ok) {
          const orgJson = await orgRes.json();
          const d = orgJson.data as OrgRefs;
          setOrgRefs(d);
          setFormState((prev) => ({
            ...prev,
            departmentId: prev.departmentId || d.departments[0]?.id || "",
            positionId: prev.positionId || d.positions[0]?.id || "",
            locationId: prev.locationId || d.locations[0]?.id || "",
            costCenterId: prev.costCenterId || d.costCenters[0]?.id || "",
          }));
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

  function openEmployeeDrawer(emp: EmployeeRow) {
    const primaryOrg =
      emp.org_assignments?.find((o) => o.is_primary) ?? emp.org_assignments?.[0];
    setSelectedEmp(emp);
    setEditState({
      fullName: emp.full_name,
      dob: emp.dob ?? "",
      gender: emp.gender ?? "MALE",
      hireDate: emp.hire_date ?? "",
      phone: "",
      personalEmail: emp.personal_email ?? "",
      workEmail: emp.work_email ?? "",
      socialInsuranceNo: emp.social_insurance_no ?? "",
      healthInsuranceNo: emp.health_insurance_no ?? "",
      pitTaxCode: emp.pit_tax_code ?? "",
      baseSalary: emp.salary_info ? String(emp.salary_info.base_salary) : "",
      siSalaryBase: emp.salary_info ? String(emp.salary_info.si_salary_base) : "",
      dependentCount: String(emp.dependent_count ?? 0),
      employmentStatus: emp.employment_status,
      departmentId: primaryOrg?.department_id ?? orgRefs?.departments[0]?.id ?? "",
      positionId: primaryOrg?.position_id ?? orgRefs?.positions[0]?.id ?? "",
      locationId: primaryOrg?.location_id ?? orgRefs?.locations[0]?.id ?? "",
      costCenterId: primaryOrg?.cost_center_id ?? orgRefs?.costCenters[0]?.id ?? "",
    });
    setUnmaskReason("");
    setUnmaskedResult(null);
    setUnmaskError(null);
  }

  async function handleCreateEmployee(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/v1/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formState,
          dob: formState.dob || undefined,
          phone: formState.phone || undefined,
          workEmail: formState.workEmail || undefined,
          nationalId: formState.nationalId || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFormError(json.error?.message ?? "Tạo nhân sự thất bại.");
        return;
      }
      setShowCreate(false);
      setFormState((prev) => ({
        ...prev,
        employeeCode: "",
        fullName: "",
        dob: "",
        phone: "",
        workEmail: "",
        nationalId: "",
      }));
      setNotice("Đã tạo hồ sơ nhân sự mới thành công.");
      setReloadTick((t) => t + 1);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEmp) return;
    setEditSaving(true);
    setNotice(null);
    try {
      const payload: Record<string, unknown> = {
        id: selectedEmp.id,
        fullName: editState.fullName,
        dob: editState.dob || null,
        gender: editState.gender || null,
        hireDate: editState.hireDate || undefined,
        workEmail: editState.workEmail || null,
        personalEmail: editState.personalEmail || null,
        employmentStatus: editState.employmentStatus,
        departmentId: editState.departmentId || undefined,
        positionId: editState.positionId || undefined,
        locationId: editState.locationId || undefined,
        costCenterId: editState.costCenterId || undefined,
      };
      if (editState.phone.trim()) payload.phone = editState.phone.trim();
      if (editState.socialInsuranceNo.trim())
        payload.socialInsuranceNo = editState.socialInsuranceNo.trim();
      if (editState.healthInsuranceNo.trim())
        payload.healthInsuranceNo = editState.healthInsuranceNo.trim();
      if (editState.pitTaxCode.trim()) payload.pitTaxCode = editState.pitTaxCode.trim();
      if (editState.baseSalary.trim() !== "")
        payload.baseSalary = Number(editState.baseSalary);
      if (editState.siSalaryBase.trim() !== "")
        payload.siSalaryBase = Number(editState.siSalaryBase);
      if (editState.dependentCount.trim() !== "")
        payload.dependentCount = Number(editState.dependentCount);

      const res = await fetch("/api/v1/employees", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Cập nhật hồ sơ thất bại.");
        return;
      }
      setSelectedEmp(null);
      setNotice(`Đã cập nhật đầy đủ hồ sơ ${editState.fullName}.`);
      setReloadTick((t) => t + 1);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleUnmask(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEmp) return;
    setUnmaskError(null);
    setUnmaskedResult(null);

    const res = await fetch(`/api/v1/employees/${selectedEmp.id}/unmask-pii`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "national_id", reason: unmaskReason }),
    });
    const json = await res.json();
    if (!res.ok) {
      setUnmaskError(json.error?.message ?? "Không được phép giải mã.");
      return;
    }
      setUnmaskedResult(json.data.value);
  }

  function handleDownloadBulkTemplate() {
    const csv = buildUtf8BomCsv(
      [
        "employee_code",
        "full_name",
        "hire_date",
        "department_code",
        "base_salary",
        "si_salary_base",
        "dependent_count",
        "phone",
        "work_email",
      ],
      [
        [
          "TKV-0101",
          "Nguyễn Văn An",
          "2026-01-15",
          "KD",
          18000000,
          18000000,
          1,
          "0909123456",
          "an.nv@thekyvang.vn",
        ],
      ]
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mau_import_nhan_su_luong.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleBulkImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setNotice(null);
    try {
      const text = await file.text();
      const parsed = parseCsvText(text);
      const importRows = parsed
        .map((r) => ({
          employeeCode: r.employee_code || r.ma_nv || "",
          fullName: r.full_name || r.ho_ten || "",
          hireDate: /^\d{4}-\d{2}-\d{2}$/.test(r.hire_date || "") ? r.hire_date : "2026-01-01",
          departmentCode: r.department_code || undefined,
          baseSalary: r.base_salary ? Number(r.base_salary.replace(/[^\d]/g, "")) : undefined,
          siSalaryBase: r.si_salary_base
            ? Number(r.si_salary_base.replace(/[^\d]/g, ""))
            : undefined,
          dependentCount: r.dependent_count ? Number(r.dependent_count) : undefined,
          phone: r.phone || undefined,
          workEmail: r.work_email || undefined,
        }))
        .filter((r) => r.employeeCode && r.fullName);

      if (importRows.length === 0) {
        setError("File CSV không có dòng hợp lệ (cần tối thiểu employee_code, full_name).");
        return;
      }

      const res = await fetch("/api/v1/employees/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: importRows }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Import nhân sự hàng loạt thất bại.");
        return;
      }
      setNotice(
        `Đã import thành công ${json.data.importedCount} hồ sơ nhân sự (cập nhật lương cho ${json.data.salaryUpdatedCount} nhân viên).`
      );
      setReloadTick((t) => t + 1);
    } finally {
      e.target.value = "";
    }
  }

  const deptMap = new Map((orgRefs?.departments ?? []).map((d) => [d.id, d.name]));
  const posMap = new Map((orgRefs?.positions ?? []).map((p) => [p.id, p.title]));
  const locMap = new Map((orgRefs?.locations ?? []).map((l) => [l.id, l.name]));

  const q = searchQuery.trim().toLowerCase();
  const filteredRows = rows.filter((emp) => {
    const primaryOrg =
      emp.org_assignments?.find((o) => o.is_primary) ?? emp.org_assignments?.[0];
    const matchQuery =
      !q ||
      emp.employee_code.toLowerCase().includes(q) ||
      emp.full_name.toLowerCase().includes(q) ||
      (emp.work_email ?? "").toLowerCase().includes(q);
    const matchStatus =
      statusFilter === "ALL" || emp.employment_status === statusFilter;
    const matchDept =
      deptFilter === "ALL" || primaryOrg?.department_id === deptFilter;
    return matchQuery && matchStatus && matchDept;
  });

  const activeCount = rows.filter((r) => r.employment_status === "ACTIVE").length;
  const probationCount = rows.filter((r) => r.employment_status === "PROBATION").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Users className="h-5 w-5 text-amber-600" />
            Hồ sơ Nhân sự ({rows.length})
          </h1>
          <p className="text-sm text-slate-600">
            Thông tin cá nhân, SĐT, BHXH/BHYT, MST TNCN, hợp đồng &amp; điều chuyển phòng ban.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadBulkTemplate}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" />
            Tải mẫu CSV
          </button>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800">
            <Upload className="h-3.5 w-3.5" />
            Import Hàng loạt (CSV)
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleBulkImportFile}
              className="hidden"
            />
          </label>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-amber-700"
          >
            <Plus className="h-4 w-4" />
            Thêm nhân sự mới
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="h-4 w-4" />
            Chưa thể truy cập Hồ sơ Nhân sự
          </div>
          <p className="mt-1 text-xs">{error}</p>
          <Link
            href="/login"
            className="mt-3 inline-block rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
          >
            Đăng nhập hệ thống
          </Link>
        </div>
      )}

      {/* Summary KPI */}
      {!error && (
        <section className="grid grid-cols-3 gap-3 sm:gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="text-xs text-slate-500">Tổng hồ sơ</div>
            <div className="mt-1 text-xl font-bold text-slate-900">{rows.length}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="text-xs text-slate-500">Đang làm việc</div>
            <div className="mt-1 text-xl font-bold text-emerald-700">{activeCount}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="text-xs text-slate-500">Đang thử việc</div>
            <div className="mt-1 text-xl font-bold text-amber-700">{probationCount}</div>
          </div>
        </section>
      )}

      {/* Search & Filters */}
      {!error && (
        <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo mã NV, họ tên, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 py-2 pr-3 pl-9 text-sm focus:border-amber-500 focus:outline-none"
            />
          </div>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="ALL">Tất cả phòng ban</option>
            {orgRefs?.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang làm việc</option>
            <option value="PROBATION">Đang thử việc</option>
            <option value="ONBOARDING">Đang nhận việc</option>
            <option value="ON_LEAVE">Tạm nghỉ</option>
            <option value="TERMINATED">Đã nghỉ việc</option>
          </select>
        </section>
      )}

      {/* Desktop Table */}
      {!loading && !error && (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Mã NV</th>
                    <th className="px-4 py-3 font-semibold">Họ và tên</th>
                    <th className="px-4 py-3 font-semibold">Phòng ban &amp; Chức danh</th>
                    <th className="px-4 py-3 font-semibold">Ngày sinh / Vào làm</th>
                    <th className="px-4 py-3 font-semibold">SĐT / CCCD</th>
                    <th className="px-4 py-3 font-semibold">Trạng thái</th>
                    <th className="px-4 py-3 text-right font-semibold">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRows.map((emp) => {
                    const org =
                      emp.org_assignments?.find((o) => o.is_primary) ??
                      emp.org_assignments?.[0];
                    return (
                      <tr
                        key={emp.id}
                        onClick={() => openEmployeeDrawer(emp)}
                        className="cursor-pointer transition hover:bg-amber-50/40"
                      >
                        <td className="px-4 py-3 font-mono font-semibold text-slate-800">
                          {emp.employee_code}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{emp.full_name}</div>
                          <div className="text-[11px] text-slate-500">
                            {emp.work_email ?? "Chưa có email"}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800">
                            {org ? deptMap.get(org.department_id) ?? "—" : "—"}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {org ? posMap.get(org.position_id) ?? "—" : "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600">
                          <div>NS: {emp.dob ?? "—"}</div>
                          <div className="text-[11px] text-slate-500">VL: {emp.hire_date}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600">
                          <div>ĐT: {emp.phone_masked}</div>
                          <div className="text-[11px] text-slate-500">CCCD: {emp.national_id_masked}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                              STATUS_BADGE[emp.employment_status] ?? "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {labelOf(EMPLOYMENT_STATUS_LABELS, emp.employment_status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEmployeeDrawer(emp);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Hồ sơ <ChevronRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-500">
                        Không tìm thấy nhân sự phù hợp bộ lọc.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card List */}
          <div className="space-y-3 md:hidden">
            {filteredRows.map((emp) => {
              const org =
                emp.org_assignments?.find((o) => o.is_primary) ??
                emp.org_assignments?.[0];
              return (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => openEmployeeDrawer(emp)}
                  className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xs transition active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-semibold text-amber-700">
                        {emp.employee_code}
                      </span>
                      <div className="mt-0.5 text-sm font-bold text-slate-900">
                        {emp.full_name}
                      </div>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                        STATUS_BADGE[emp.employment_status] ?? "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {labelOf(EMPLOYMENT_STATUS_LABELS, emp.employment_status)}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5 text-slate-400" />
                      {org ? deptMap.get(org.department_id) ?? "—" : "—"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      {org ? locMap.get(org.location_id) ?? "—" : "—"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      {emp.phone_masked}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Create Employee Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Thêm hồ sơ nhân sự mới</h2>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateEmployee} className="mt-4 space-y-3 text-xs">
              {formError && (
                <div className="rounded-xl bg-red-50 p-3 text-red-700">{formError}</div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-medium text-slate-700">Mã nhân viên *</label>
                  <input
                    required
                    placeholder="TKV-0013"
                    value={formState.employeeCode}
                    onChange={(e) =>
                      setFormState({ ...formState, employeeCode: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-700">Họ và tên *</label>
                  <input
                    required
                    placeholder="Nguyễn Văn An"
                    value={formState.fullName}
                    onChange={(e) =>
                      setFormState({ ...formState, fullName: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-700">Ngày sinh</label>
                  <input
                    type="date"
                    value={formState.dob}
                    onChange={(e) =>
                      setFormState({ ...formState, dob: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-700">Giới tính</label>
                  <select
                    value={formState.gender}
                    onChange={(e) =>
                      setFormState({ ...formState, gender: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="MALE">Nam</option>
                    <option value="FEMALE">Nữ</option>
                    <option value="OTHER">Khác</option>
                  </select>
                </div>
                <div>
                  <label className="font-medium text-slate-700">Số điện thoại</label>
                  <input
                    placeholder="0909123456"
                    value={formState.phone}
                    onChange={(e) =>
                      setFormState({ ...formState, phone: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-700">Email công việc</label>
                  <input
                    type="email"
                    placeholder="an.nv@thekyvang.vn"
                    value={formState.workEmail}
                    onChange={(e) =>
                      setFormState({ ...formState, workEmail: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-700">CCCD (Mã hóa AES-256)</label>
                  <input
                    placeholder="072099001234"
                    value={formState.nationalId}
                    onChange={(e) =>
                      setFormState({ ...formState, nationalId: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-700">Ngày vào làm *</label>
                  <input
                    type="date"
                    required
                    value={formState.hireDate}
                    onChange={(e) =>
                      setFormState({ ...formState, hireDate: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-700">Trạng thái</label>
                  <select
                    value={formState.employmentStatus}
                    onChange={(e) =>
                      setFormState({ ...formState, employmentStatus: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="ACTIVE">Đang làm việc (Chính thức)</option>
                    <option value="PROBATION">Đang thử việc</option>
                    <option value="ONBOARDING">Đang nhận việc</option>
                  </select>
                </div>
                <div>
                  <label className="font-medium text-slate-700">Phòng ban</label>
                  <select
                    value={formState.departmentId}
                    onChange={(e) =>
                      setFormState({ ...formState, departmentId: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    {orgRefs?.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-medium text-slate-700">Chức danh</label>
                  <select
                    value={formState.positionId}
                    onChange={(e) =>
                      setFormState({ ...formState, positionId: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    {orgRefs?.positions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-medium text-slate-700">Địa điểm làm việc</label>
                  <select
                    value={formState.locationId}
                    onChange={(e) =>
                      setFormState({ ...formState, locationId: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    {orgRefs?.locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-medium text-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {saving ? "Đang lưu..." : "Tạo hồ sơ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slide-over Employee Detail & Edit Drawer */}
      {selectedEmp && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs">
          <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="font-mono text-xs font-semibold text-amber-700">
                  {selectedEmp.employee_code} • {labelOf(GENDER_LABELS, selectedEmp.gender)}
                </span>
                <h2 className="text-lg font-bold text-slate-900">{selectedEmp.full_name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEmp(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Snapshot Cards: Contract, Salary, Statutory IDs */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                  <FileSignature className="h-3.5 w-3.5 text-amber-600" />
                  Hợp đồng hiệu lực
                </div>
                <div className="mt-1 font-mono font-bold text-slate-900">
                  {selectedEmp.active_contract?.contract_no ?? "Chưa có HĐ"}
                </div>
                <div className="text-[11px] text-slate-600">
                  {selectedEmp.active_contract
                    ? `${labelOf(CONTRACT_TYPE_LABELS, selectedEmp.active_contract.contract_type)} (${selectedEmp.active_contract.effective_from} → ${selectedEmp.active_contract.effective_to ?? "Không thời hạn"})`
                    : "Vui lòng lập HĐLĐ"}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                  <Wallet className="h-3.5 w-3.5 text-emerald-600" />
                  Lương &amp; Bảo hiểm
                </div>
                <div className="mt-1 font-mono font-bold text-emerald-700">
                  {selectedEmp.salary_info
                    ? fmtVnd(selectedEmp.salary_info.base_salary)
                    : "Chưa thiết lập"}
                </div>
                <div className="text-[11px] text-slate-600">
                  BHXH: {selectedEmp.salary_info ? fmtVnd(selectedEmp.salary_info.si_salary_base) : "—"} • NPT: {selectedEmp.dependent_count ?? 0}
                </div>
              </div>
            </div>

            <form onSubmit={handleUpdateEmployee} className="mt-5 space-y-4 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                <Shield className="h-3.5 w-3.5 text-amber-600" />
                Thông tin cá nhân, Pháp lý &amp; Điều chuyển
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-medium text-slate-700">Họ và tên</label>
                  <input
                    required
                    value={editState.fullName}
                    onChange={(e) => setEditState({ ...editState, fullName: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-700">Giới tính</label>
                  <select
                    value={editState.gender}
                    onChange={(e) => setEditState({ ...editState, gender: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="MALE">Nam</option>
                    <option value="FEMALE">Nữ</option>
                    <option value="OTHER">Khác</option>
                  </select>
                </div>
                <div>
                  <label className="font-medium text-slate-700">Ngày tháng năm sinh</label>
                  <input
                    type="date"
                    value={editState.dob}
                    onChange={(e) => setEditState({ ...editState, dob: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-700">Ngày vào làm</label>
                  <input
                    type="date"
                    value={editState.hireDate}
                    onChange={(e) => setEditState({ ...editState, hireDate: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-700">
                    Số điện thoại (hiện tại: {selectedEmp.phone_masked})
                  </label>
                  <input
                    placeholder="Nhập SĐT mới để cập nhật..."
                    value={editState.phone}
                    onChange={(e) => setEditState({ ...editState, phone: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-700">Email công việc</label>
                  <input
                    type="email"
                    value={editState.workEmail}
                    onChange={(e) =>
                      setEditState({ ...editState, workEmail: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-700">Mã số BHXH (10 số)</label>
                  <input
                    placeholder="7212345678"
                    value={editState.socialInsuranceNo}
                    onChange={(e) =>
                      setEditState({ ...editState, socialInsuranceNo: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-700">Mã thẻ BHYT</label>
                  <input
                    placeholder="DN4727212345678"
                    value={editState.healthInsuranceNo}
                    onChange={(e) =>
                      setEditState({ ...editState, healthInsuranceNo: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-700">Mã số thuế TNCN</label>
                  <input
                    placeholder="8123456789"
                    value={editState.pitTaxCode}
                    onChange={(e) =>
                      setEditState({ ...editState, pitTaxCode: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-700">Trạng thái làm việc</label>
                  <select
                    value={editState.employmentStatus}
                    onChange={(e) =>
                      setEditState({ ...editState, employmentStatus: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="ACTIVE">Đang làm việc (Chính thức)</option>
                    <option value="PROBATION">Đang thử việc</option>
                    <option value="ONBOARDING">Đang nhận việc</option>
                    <option value="ON_LEAVE">Tạm nghỉ / Thai sản</option>
                    <option value="TERMINATED">Đã nghỉ việc</option>
                  </select>
                </div>
                <div>
                  <label className="font-medium text-slate-700">Phòng ban</label>
                  <select
                    value={editState.departmentId}
                    onChange={(e) =>
                      setEditState({ ...editState, departmentId: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    {orgRefs?.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-medium text-slate-700">Chức danh</label>
                  <select
                    value={editState.positionId}
                    onChange={(e) =>
                      setEditState({ ...editState, positionId: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    {orgRefs?.positions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-medium text-slate-700">Địa điểm làm việc</label>
                <select
                  value={editState.locationId}
                  onChange={(e) =>
                    setEditState({ ...editState, locationId: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  {orgRefs?.locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                <div className="mb-2 flex items-center gap-1.5 font-semibold text-emerald-900">
                  <Wallet className="h-3.5 w-3.5 text-emerald-600" />
                  Cập nhật Mức lương, BHXH &amp; Người phụ thuộc
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="font-medium text-slate-700">Lương cơ bản (đ)</label>
                    <input
                      type="number"
                      min={0}
                      step={100000}
                      placeholder="15000000"
                      value={editState.baseSalary}
                      onChange={(e) =>
                        setEditState({ ...editState, baseSalary: e.target.value })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-slate-700">Lương đóng BHXH (đ)</label>
                    <input
                      type="number"
                      min={0}
                      step={100000}
                      placeholder="15000000"
                      value={editState.siSalaryBase}
                      onChange={(e) =>
                        setEditState({ ...editState, siSalaryBase: e.target.value })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-slate-700">Số người phụ thuộc</label>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={editState.dependentCount}
                      onChange={(e) =>
                        setEditState({ ...editState, dependentCount: e.target.value })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={editSaving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {editSaving ? "Đang lưu..." : "Lưu toàn bộ hồ sơ"}
              </button>
            </form>

            {/* PDPL Unmask Section */}
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900">
                  Bảo mật dữ liệu cá nhân (PDPL)
                </span>
                <span className="font-mono text-xs text-slate-600">
                  CCCD: {selectedEmp.national_id_masked}
                </span>
              </div>
              <form onSubmit={handleUnmask} className="mt-3 space-y-2">
                <input
                  required
                  minLength={5}
                  placeholder="Nhập lý do giải mã CCCD (bắt buộc ghi Audit Log)..."
                  value={unmaskReason}
                  onChange={(e) => setUnmaskReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
                {unmaskError && (
                  <div className="text-xs text-red-600">{unmaskError}</div>
                )}
                {unmaskedResult && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 font-mono text-sm font-bold text-emerald-800">
                    CCCD: {unmaskedResult}
                  </div>
                )}
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Giải mã CCCD
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
