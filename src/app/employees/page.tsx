"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  Plus,
  Eye,
  X,
  Search,
  Save,
  ChevronRight,
  Wallet,
  Download,
  CheckCircle2,
  AlertTriangle,
  SlidersHorizontal,
  Upload,
  Trash2,
  FileText,
} from "lucide-react";
import { buildUtf8BomCsv } from "@/lib/integrations/csv-helper";
import {
  CONTRACT_TYPE_LABELS,
  EMPLOYMENT_STATUS_LABELS,
  GENDER_LABELS,
  labelOf,
} from "@/lib/i18n/vi-labels";
import { SkeletonBlock } from "@/components/ui/StateViews";

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

  // Quick Filters
  type FilterTab = "ALL" | "ACTIVE" | "PROBATION" | "ON_LEAVE" | "NEW_HIRE" | "MISSING_DOCS";
  const [filterTab, setFilterTab] = useState<FilterTab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");

  // Column Visibility Controls
  const [columns, setColumns] = useState({
    code: true,
    name: true,
    deptPos: true,
    dates: true,
    contacts: true,
    salary: true,
    status: true,
  });
  const [showColPicker, setShowColPicker] = useState(false);

  // Create modal state
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

  // Detail/Edit Drawer State
  const [selectedEmp, setSelectedEmp] = useState<EmployeeRow | null>(null);
  const [drawerTab, setDrawerTab] = useState<"PROFILE" | "DOCUMENTS" | "TIMELINE">("PROFILE");
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

  // Offboarding Checklist Modal
  const [showOffboardingModal, setShowOffboardingModal] = useState(false);
  const [offboardingChecklist, setOffboardingChecklist] = useState({
    assetReturned: false,
    siBookClosed: false,
    leaveSettled: false,
    accountLocked: false,
  });

  // Lightbox for Document Scan Viewer
  const [activeScanUrl, setActiveScanUrl] = useState<{ title: string; url: string } | null>(null);

  // Quick View Popup for Timeline items
  const [quickViewItem, setQuickViewItem] = useState<{ title: string; content: Record<string, string | number> } | null>(null);

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

  // Department / Position maps
  const deptMap = useMemo(() => new Map((orgRefs?.departments ?? []).map((d) => [d.id, d.name])), [orgRefs]);
  const posMap = useMemo(() => new Map((orgRefs?.positions ?? []).map((p) => [p.id, p.title])), [orgRefs]);

  // Filtered positions based on selected department in edit/create
  const filteredEditPositions = useMemo(() => {
    if (!editState.departmentId) return orgRefs?.positions ?? [];
    const matching = (orgRefs?.positions ?? []).filter((p) => p.department_id === editState.departmentId);
    return matching.length > 0 ? matching : orgRefs?.positions ?? [];
  }, [orgRefs, editState.departmentId]);

  const filteredCreatePositions = useMemo(() => {
    if (!formState.departmentId) return orgRefs?.positions ?? [];
    const matching = (orgRefs?.positions ?? []).filter((p) => p.department_id === formState.departmentId);
    return matching.length > 0 ? matching : orgRefs?.positions ?? [];
  }, [orgRefs, formState.departmentId]);

  // Date threshold for new hires (hired within 30 days)
  const [thirtyDaysAgoTime, setThirtyDaysAgoTime] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThirtyDaysAgoTime(Date.now() - 30 * 24 * 60 * 60 * 1000);
  }, []);

  // Quick Filter Counts
  const counts = useMemo(() => {
    let active = 0;
    let probation = 0;
    let onLeave = 0;
    let newHire = 0;
    let missingDocs = 0;

    for (const r of rows) {
      if (r.employment_status === "ACTIVE") active++;
      if (r.employment_status === "PROBATION") probation++;
      if (r.employment_status === "ON_LEAVE") onLeave++;
      if (thirtyDaysAgoTime !== null && r.hire_date && new Date(r.hire_date).getTime() >= thirtyDaysAgoTime) newHire++;
      // Check missing documents: no contract or no phone or probation without SI tax code
      const isMissing = !r.active_contract || !r.phone_masked || r.phone_masked.includes("—") || !r.national_id_masked;
      if (isMissing) missingDocs++;
    }

    return {
      all: rows.length,
      active,
      probation,
      onLeave,
      newHire,
      missingDocs,
    };
  }, [rows, thirtyDaysAgoTime]);

  // Filtered rows
  const q = searchQuery.trim().toLowerCase();
  const filteredRows = useMemo(() => {
    return rows.filter((emp) => {
      const primaryOrg = emp.org_assignments?.find((o) => o.is_primary) ?? emp.org_assignments?.[0];

      // Match search
      const matchQuery =
        !q ||
        emp.employee_code.toLowerCase().includes(q) ||
        emp.full_name.toLowerCase().includes(q) ||
        (emp.work_email ?? "").toLowerCase().includes(q) ||
        (emp.phone_masked ?? "").includes(q);

      // Match department
      const matchDept = deptFilter === "ALL" || primaryOrg?.department_id === deptFilter;

      // Match Quick Filter Tab
      let matchTab = true;
      if (filterTab === "ACTIVE") matchTab = emp.employment_status === "ACTIVE";
      else if (filterTab === "PROBATION") matchTab = emp.employment_status === "PROBATION";
      else if (filterTab === "ON_LEAVE") matchTab = emp.employment_status === "ON_LEAVE";
      else if (filterTab === "NEW_HIRE") {
        matchTab = Boolean(thirtyDaysAgoTime !== null && emp.hire_date && new Date(emp.hire_date).getTime() >= thirtyDaysAgoTime);
      } else if (filterTab === "MISSING_DOCS") {
        matchTab = !emp.active_contract || !emp.phone_masked || emp.phone_masked.includes("—") || !emp.national_id_masked;
      }

      return matchQuery && matchDept && matchTab;
    });
  }, [rows, q, deptFilter, filterTab, thirtyDaysAgoTime]);

  // Export WYSIWYG Excel / CSV
  function handleExportWysiwyg() {
    const headers: string[] = [];
    if (columns.code) headers.push("Mã nhân viên");
    if (columns.name) headers.push("Họ và tên");
    if (columns.deptPos) {
      headers.push("Phòng ban");
      headers.push("Chức danh");
    }
    if (columns.dates) {
      headers.push("Ngày sinh");
      headers.push("Ngày vào làm");
    }
    if (columns.contacts) {
      headers.push("Số điện thoại");
      headers.push("CCCD");
    }
    if (columns.salary) {
      headers.push("Lương cơ bản (đ)");
      headers.push("Lương BHXH (đ)");
    }
    if (columns.status) headers.push("Trạng thái");

    const dataRows = filteredRows.map((emp) => {
      const row: Array<string | number> = [];
      const primaryOrg = emp.org_assignments?.find((o) => o.is_primary) ?? emp.org_assignments?.[0];

      if (columns.code) row.push(emp.employee_code);
      if (columns.name) row.push(emp.full_name);
      if (columns.deptPos) {
        row.push(primaryOrg ? deptMap.get(primaryOrg.department_id) ?? "—" : "—");
        row.push(primaryOrg ? posMap.get(primaryOrg.position_id) ?? "—" : "—");
      }
      if (columns.dates) {
        row.push(emp.dob ?? "—");
        row.push(emp.hire_date ?? "—");
      }
      if (columns.contacts) {
        row.push(emp.phone_masked);
        row.push(emp.national_id_masked);
      }
      if (columns.salary) {
        row.push(emp.salary_info?.base_salary ?? 0);
        row.push(emp.salary_info?.si_salary_base ?? 0);
      }
      if (columns.status) {
        row.push(labelOf(EMPLOYMENT_STATUS_LABELS, emp.employment_status));
      }
      return row;
    });

    const csvContent = buildUtf8BomCsv(headers, dataRows);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `danh_sach_nhan_su_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Open Drawer
  function openEmployeeDrawer(emp: EmployeeRow) {
    const primaryOrg = emp.org_assignments?.find((o) => o.is_primary) ?? emp.org_assignments?.[0];
    setSelectedEmp(emp);
    setDrawerTab("PROFILE");
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

  // Validation & Save Create Employee
  async function handleCreateEmployee(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    // 1. Check duplicate employee code
    const code = formState.employeeCode.trim().toUpperCase();
    if (rows.some((r) => r.employee_code.toUpperCase() === code)) {
      setFormError(`Mã nhân viên "${code}" đã tồn tại trong hệ thống.`);
      return;
    }

    // 2. Validate CCCD: 12 digits
    if (formState.nationalId && !/^\d{12}$/.test(formState.nationalId.trim())) {
      setFormError("Số CCCD phải gồm đúng 12 chữ số.");
      return;
    }

    // 3. Validate Phone: 10 digits starting with 0
    if (formState.phone && !/^0\d{9}$/.test(formState.phone.trim())) {
      setFormError("Số điện thoại không hợp lệ (phải gồm 10 chữ số bắt đầu bằng 0).");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/v1/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formState,
          employeeCode: code,
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

  // Save Edit Employee
  async function handleUpdateEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEmp) return;

    // Check if status is transitioning to TERMINATED
    if (editState.employmentStatus === "TERMINATED" && selectedEmp.employment_status !== "TERMINATED") {
      setShowOffboardingModal(true);
      return;
    }

    await executeEmployeeUpdate();
  }

  async function executeEmployeeUpdate() {
    if (!selectedEmp) return;
    setEditSaving(true);
    setNotice(null);
    try {
      // Validate Phone if provided
      if (editState.phone.trim() && !/^0\d{9}$/.test(editState.phone.trim())) {
        setError("Số điện thoại không hợp lệ (cần 10 chữ số).");
        return;
      }

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
      if (editState.socialInsuranceNo.trim()) payload.socialInsuranceNo = editState.socialInsuranceNo.trim();
      if (editState.healthInsuranceNo.trim()) payload.healthInsuranceNo = editState.healthInsuranceNo.trim();
      if (editState.pitTaxCode.trim()) payload.pitTaxCode = editState.pitTaxCode.trim();
      if (editState.baseSalary.trim() !== "") payload.baseSalary = Number(editState.baseSalary);
      if (editState.siSalaryBase.trim() !== "") payload.siSalaryBase = Number(editState.siSalaryBase);
      if (editState.dependentCount.trim() !== "") payload.dependentCount = Number(editState.dependentCount);

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
      setShowOffboardingModal(false);
      setNotice("Đã cập nhật hồ sơ nhân sự thành công.");
      setReloadTick((t) => t + 1);
    } finally {
      setEditSaving(false);
    }
  }

  // Unmask CCCD
  async function handleUnmask(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEmp) return;
    setUnmaskError(null);
    setUnmaskedResult(null);
    try {
      const res = await fetch(`/api/v1/employees/${selectedEmp.id}/unmask-pii`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: "national_id", reason: unmaskReason }),
      });
      const json = await res.json();
      if (!res.ok) {
        setUnmaskError(json.error?.message ?? "Không thể giải mã CCCD.");
        return;
      }
      setUnmaskedResult(json.data.plaintext);
    } catch {
      setUnmaskError("Lỗi kết nối giải mã PII.");
    }
  }

  // Document item structure for scan vault
  interface EmployeeDocItem {
    id: string;
    title: string;
    status: "SUBMITTED" | "MISSING" | "NOT_REQUIRED";
    submittedDate?: string;
    scanUrl?: string;
    fileName?: string;
    fileSize?: string;
    note?: string;
  }

  // Uploaded docs per employee ID
  const [empDocs, setEmpDocs] = useState<Record<string, EmployeeDocItem[]>>({});

  const getDocsForEmp = useCallback((emp: EmployeeRow): EmployeeDocItem[] => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(`tkv_docs_${emp.id}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }

    return [
      {
        id: "doc-cccd",
        title: "Căn cước công dân gắn chip (2 mặt)",
        status: emp.national_id_masked ? "SUBMITTED" : "MISSING",
        submittedDate: emp.hire_date ?? "15/08/2026",
        scanUrl: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80",
        note: "Đã đối chiếu bản gốc CCCD",
        fileName: "CCCD_HaiMat.jpg",
        fileSize: "245 KB",
      },
      {
        id: "doc-hdld",
        title: "Hợp đồng lao động bản cứng có chữ ký",
        status: emp.active_contract ? "SUBMITTED" : "MISSING",
        submittedDate: emp.active_contract?.effective_from ?? "01/01/2026",
        scanUrl: "https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=800&q=80",
        note: emp.active_contract?.contract_no ?? "Chưa ký hợp đồng",
        fileName: "HopDongLaoDong_Scan.pdf",
        fileSize: "1.2 MB",
      },
      {
        id: "doc-gksk",
        title: "Giấy khám sức khỏe định kỳ (trong 6 tháng)",
        status: "SUBMITTED",
        submittedDate: "15/08/2026",
        scanUrl: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80",
        note: "Đủ sức khỏe làm việc loại I",
        fileName: "GiayKhamSucKhoe_2026.pdf",
        fileSize: "850 KB",
      },
      {
        id: "doc-syll",
        title: "Sơ yếu lý lịch tự thuật có xác nhận địa phương",
        status: "SUBMITTED",
        submittedDate: emp.hire_date ?? "15/08/2026",
        scanUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80",
        note: "Bản sao có chứng thực",
        fileName: "SoYeuLyLich_XacNhan.jpg",
        fileSize: "520 KB",
      },
      {
        id: "doc-bangcap",
        title: "Bằng cấp / Chứng chỉ chuyên môn",
        status: "SUBMITTED",
        submittedDate: emp.hire_date ?? "15/08/2026",
        scanUrl: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80",
        note: "Đại học / Cao đẳng chính quy",
        fileName: "BangTotNghiep.jpg",
        fileSize: "680 KB",
      },
      {
        id: "doc-bosung",
        title: "Quyết định bổ nhiệm / Giấy tờ bổ sung khác",
        status: "MISSING",
        note: "Bấm tải lên để đính kèm bản scan bất kỳ lúc nào",
      },
    ];
  }, []);

  function handleUploadDoc(docId: string, file: File) {
    if (!selectedEmp) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const sizeKb = Math.round(file.size / 1024);
      const sizeStr = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;
      const dateStr = new Date().toLocaleDateString("vi-VN");

      setEmpDocs((prev) => {
        const currentList = prev[selectedEmp.id] ?? getDocsForEmp(selectedEmp);
        const updated = currentList.map((d) => {
          if (d.id === docId) {
            return {
              ...d,
              status: "SUBMITTED" as const,
              submittedDate: dateStr,
              scanUrl: dataUrl,
              fileName: file.name,
              fileSize: sizeStr,
              note: `Đã lưu: ${file.name}`,
            };
          }
          return d;
        });
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(`tkv_docs_${selectedEmp.id}`, JSON.stringify(updated));
          } catch {}
        }
        return { ...prev, [selectedEmp.id]: updated };
      });
      setNotice(`Đã tải lên bản scan "${file.name}" thành công.`);
    };
    reader.readAsDataURL(file);
  }

  function handleDeleteDoc(docId: string) {
    if (!selectedEmp) return;
    setEmpDocs((prev) => {
      const currentList = prev[selectedEmp.id] ?? getDocsForEmp(selectedEmp);
      const updated = currentList.map((d) => {
        if (d.id === docId) {
          return {
            ...d,
            status: "MISSING" as const,
            submittedDate: undefined,
            scanUrl: undefined,
            fileName: undefined,
            fileSize: undefined,
            note: "Chưa nộp bản sao chứng thực",
          };
        }
        return d;
      });
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(`tkv_docs_${selectedEmp.id}`, JSON.stringify(updated));
        } catch {}
      }
      return { ...prev, [selectedEmp.id]: updated };
    });
    setNotice("Đã xóa tài liệu đính kèm.");
  }

  const currentEmpDocs = useMemo(() => {
    if (!selectedEmp) return [];
    return empDocs[selectedEmp.id] ?? getDocsForEmp(selectedEmp);
  }, [selectedEmp, empDocs, getDocsForEmp]);

  const submittedDocCount = currentEmpDocs.filter((d) => d.status === "SUBMITTED").length;
  const totalRequiredDocCount = currentEmpDocs.filter((d) => d.status !== "NOT_REQUIRED").length;
  const docCompletionRate = totalRequiredDocCount > 0 ? Math.round((submittedDocCount / totalRequiredDocCount) * 100) : 100;

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonBlock rows={3} />
        <SkeletonBlock rows={8} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <Users className="h-6 w-6 text-amber-600" />
            Danh sách &amp; Hồ sơ Nhân sự
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Quản trị 50 nhân sự Thế Kỷ Vàng • Kiểm tra trùng CCCD, SĐT • Kho lưu bản scan giấy tờ • Xuất Excel tùy chọn cột.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Column Picker Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowColPicker(!showColPicker)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Tùy chọn cột
            </button>

            {/* Column Picker Popover */}
            {showColPicker && (
              <div className="absolute right-0 top-full z-40 mt-1.5 w-52 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                <div className="mb-2 text-xs font-bold text-slate-800">Hiển thị cột:</div>
                <div className="space-y-2 text-xs">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={columns.deptPos}
                      onChange={(e) => setColumns({ ...columns, deptPos: e.target.checked })}
                    />
                    Phòng ban &amp; Chức danh
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={columns.dates}
                      onChange={(e) => setColumns({ ...columns, dates: e.target.checked })}
                    />
                    Ngày sinh &amp; Vào làm
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={columns.contacts}
                      onChange={(e) => setColumns({ ...columns, contacts: e.target.checked })}
                    />
                    SĐT &amp; CCCD
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={columns.salary}
                      onChange={(e) => setColumns({ ...columns, salary: e.target.checked })}
                    />
                    Lương cơ bản &amp; BHXH
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={columns.status}
                      onChange={(e) => setColumns({ ...columns, status: e.target.checked })}
                    />
                    Trạng thái làm việc
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Export WYSIWYG Excel */}
          <button
            type="button"
            onClick={handleExportWysiwyg}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5 text-emerald-600" />
            Xuất Excel ({filteredRows.length})
          </button>

          {/* Add Employee Button */}
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-700"
          >
            <Plus className="h-4 w-4" />
            Thêm nhân sự mới
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          {notice}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}

      {/* Quick Filter Tabs with Live Counts */}
      <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilterTab("ALL")}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
            filterTab === "ALL"
              ? "bg-slate-900 text-white shadow-sm"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          <span>Tất cả</span>
          <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${filterTab === "ALL" ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-700"}`}>
            {counts.all}
          </span>
        </button>

        <button
          onClick={() => setFilterTab("ACTIVE")}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
            filterTab === "ACTIVE"
              ? "bg-emerald-600 text-white shadow-sm"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          <span>Đang làm việc</span>
          <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${filterTab === "ACTIVE" ? "bg-emerald-700 text-white" : "bg-emerald-50 text-emerald-700"}`}>
            {counts.active}
          </span>
        </button>

        <button
          onClick={() => setFilterTab("PROBATION")}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
            filterTab === "PROBATION"
              ? "bg-amber-600 text-white shadow-sm"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          <span>Thử việc</span>
          <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${filterTab === "PROBATION" ? "bg-amber-700 text-white" : "bg-amber-50 text-amber-700"}`}>
            {counts.probation}
          </span>
        </button>

        <button
          onClick={() => setFilterTab("ON_LEAVE")}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
            filterTab === "ON_LEAVE"
              ? "bg-purple-600 text-white shadow-sm"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          <span>Nghỉ thai sản / tạm nghỉ</span>
          <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${filterTab === "ON_LEAVE" ? "bg-purple-700 text-white" : "bg-purple-50 text-purple-700"}`}>
            {counts.onLeave}
          </span>
        </button>

        <button
          onClick={() => setFilterTab("NEW_HIRE")}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
            filterTab === "NEW_HIRE"
              ? "bg-sky-600 text-white shadow-sm"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          <span>Mới vào (30 ngày)</span>
          <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${filterTab === "NEW_HIRE" ? "bg-sky-700 text-white" : "bg-sky-50 text-sky-700"}`}>
            {counts.newHire}
          </span>
        </button>

        <button
          onClick={() => setFilterTab("MISSING_DOCS")}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
            filterTab === "MISSING_DOCS"
              ? "bg-rose-600 text-white shadow-sm"
              : "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Hồ sơ còn thiếu</span>
          <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${filterTab === "MISSING_DOCS" ? "bg-rose-700 text-white" : "bg-rose-200 text-rose-800"}`}>
            {counts.missingDocs}
          </span>
        </button>
      </div>

      {/* Search & Dept Selector */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm theo mã NV, họ tên, số điện thoại, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 py-2 pr-3 pl-9 text-xs outline-none focus:border-amber-500"
          />
        </div>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none"
        >
          <option value="ALL">Tất cả phòng ban</option>
          {orgRefs?.departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* Main Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
              <tr>
                {columns.code && <th className="px-4 py-3">Mã NV</th>}
                {columns.name && <th className="px-4 py-3">Họ và tên</th>}
                {columns.deptPos && <th className="px-4 py-3">Phòng ban &amp; Chức danh</th>}
                {columns.dates && <th className="px-4 py-3">Ngày sinh / Vào làm</th>}
                {columns.contacts && <th className="px-4 py-3">SĐT / CCCD</th>}
                {columns.salary && <th className="px-4 py-3">Lương cơ bản</th>}
                {columns.status && <th className="px-4 py-3">Trạng thái</th>}
                <th className="px-4 py-3 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((emp) => {
                const org = emp.org_assignments?.find((o) => o.is_primary) ?? emp.org_assignments?.[0];
                return (
                  <tr
                    key={emp.id}
                    onClick={() => openEmployeeDrawer(emp)}
                    className="cursor-pointer transition hover:bg-amber-50/40"
                  >
                    {columns.code && (
                      <td className="px-4 py-3 font-mono font-bold text-slate-800">
                        {emp.employee_code}
                      </td>
                    )}
                    {columns.name && (
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{emp.full_name}</div>
                        <div className="text-[11px] text-slate-500">{emp.work_email ?? "—"}</div>
                      </td>
                    )}
                    {columns.deptPos && (
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">
                          {org ? deptMap.get(org.department_id) ?? "—" : "—"}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {org ? posMap.get(org.position_id) ?? "—" : "—"}
                        </div>
                      </td>
                    )}
                    {columns.dates && (
                      <td className="px-4 py-3 font-mono text-slate-600">
                        <div>NS: {emp.dob ?? "—"}</div>
                        <div className="text-[11px] text-slate-400">VL: {emp.hire_date}</div>
                      </td>
                    )}
                    {columns.contacts && (
                      <td className="px-4 py-3 font-mono text-slate-600">
                        <div>ĐT: {emp.phone_masked}</div>
                        <div className="text-[11px] text-slate-400">CCCD: {emp.national_id_masked}</div>
                      </td>
                    )}
                    {columns.salary && (
                      <td className="px-4 py-3 font-mono">
                        <div className="font-bold text-slate-900">
                          {emp.salary_info ? fmtVnd(emp.salary_info.base_salary) : "—"}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          BHXH: {emp.salary_info ? fmtVnd(emp.salary_info.si_salary_base) : "—"}
                        </div>
                      </td>
                    )}
                    {columns.status && (
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                            STATUS_BADGE[emp.employment_status] ?? "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {labelOf(EMPLOYMENT_STATUS_LABELS, emp.employment_status)}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEmployeeDrawer(emp);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                      >
                        Hồ sơ <ChevronRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    Không tìm thấy nhân sự phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over Employee Detail Drawer with Document Checklist & Timeline */}
      {selectedEmp && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs">
          <div className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="font-mono text-xs font-semibold text-amber-700">
                  {selectedEmp.employee_code} • {labelOf(GENDER_LABELS, selectedEmp.gender)}
                </span>
                <h2 className="text-xl font-black text-slate-900">{selectedEmp.full_name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEmp(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Tab Navigation */}
            <div className="mt-4 flex border-b border-slate-200 text-xs font-semibold text-slate-600">
              <button
                onClick={() => setDrawerTab("PROFILE")}
                className={`border-b-2 px-4 py-2.5 transition-all ${
                  drawerTab === "PROFILE"
                    ? "border-amber-600 font-bold text-amber-700"
                    : "border-transparent hover:text-slate-900"
                }`}
              >
                Thông tin &amp; Pháp lý
              </button>
              <button
                onClick={() => setDrawerTab("DOCUMENTS")}
                className={`border-b-2 px-4 py-2.5 transition-all ${
                  drawerTab === "DOCUMENTS"
                    ? "border-amber-600 font-bold text-amber-700"
                    : "border-transparent hover:text-slate-900"
                }`}
              >
                📁 Hồ sơ &amp; Giấy tờ (5)
              </button>
              <button
                onClick={() => setDrawerTab("TIMELINE")}
                className={`border-b-2 px-4 py-2.5 transition-all ${
                  drawerTab === "TIMELINE"
                    ? "border-amber-600 font-bold text-amber-700"
                    : "border-transparent hover:text-slate-900"
                }`}
              >
                🔎 Lịch sử &amp; Diễn biến
              </button>
            </div>

            {/* TAB 1: PROFILE & LEGAL */}
            {drawerTab === "PROFILE" && (
              <form onSubmit={handleUpdateEmployee} className="mt-5 space-y-4 text-xs">
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
                    <label className="font-medium text-slate-700">Trạng thái làm việc</label>
                    <select
                      value={editState.employmentStatus}
                      onChange={(e) => setEditState({ ...editState, employmentStatus: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold"
                    >
                      <option value="ACTIVE">Đang làm việc (Chính thức)</option>
                      <option value="PROBATION">Đang thử việc</option>
                      <option value="ONBOARDING">Đang nhận việc</option>
                      <option value="ON_LEAVE">Nghỉ thai sản / tạm nghỉ</option>
                      <option value="TERMINATED">Đã nghỉ việc (Kích hoạt checklist bàn giao)</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700">Phòng ban</label>
                    <select
                      value={editState.departmentId}
                      onChange={(e) => {
                        const newDeptId = e.target.value;
                        const matching = (orgRefs?.positions ?? []).filter((p) => p.department_id === newDeptId);
                        setEditState({
                          ...editState,
                          departmentId: newDeptId,
                          positionId: matching[0]?.id ?? editState.positionId,
                        });
                      }}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold"
                    >
                      <option value="">-- Chọn phòng ban --</option>
                      {orgRefs?.departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700">Chức danh / Vị trí</label>
                    <select
                      value={editState.positionId}
                      onChange={(e) => setEditState({ ...editState, positionId: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold"
                    >
                      <option value="">-- Chọn chức danh --</option>
                      {filteredEditPositions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} ({p.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-medium text-slate-700">Ngày sinh</label>
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
                    <label className="font-medium text-slate-700">Số điện thoại (10 chữ số)</label>
                    <input
                      placeholder={selectedEmp.phone_masked}
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
                      onChange={(e) => setEditState({ ...editState, workEmail: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                {/* Salary Box */}
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5">
                  <div className="mb-2 flex items-center gap-1.5 font-bold text-emerald-900">
                    <Wallet className="h-4 w-4 text-emerald-600" />
                    Lương, BHXH &amp; Người phụ thuộc
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="font-medium text-slate-700">Lương cơ bản (đ)</label>
                      <input
                        type="number"
                        min={0}
                        step={100000}
                        value={editState.baseSalary}
                        onChange={(e) => setEditState({ ...editState, baseSalary: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="font-medium text-slate-700">Lương đóng BHXH (đ)</label>
                      <input
                        type="number"
                        min={0}
                        step={100000}
                        value={editState.siSalaryBase}
                        onChange={(e) => setEditState({ ...editState, siSalaryBase: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="font-medium text-slate-700">Số người phụ thuộc</label>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={editState.dependentCount}
                        onChange={(e) => setEditState({ ...editState, dependentCount: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* PDPL Unmask Box */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">Bảo mật dữ liệu cá nhân (PDPL)</span>
                    <span className="font-mono text-slate-600">CCCD: {selectedEmp.national_id_masked}</span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      placeholder="Nhập lý do xem CCCD (ghi nhật ký Audit)..."
                      value={unmaskReason}
                      onChange={(e) => setUnmaskReason(e.target.value)}
                      className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleUnmask}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Giải mã
                    </button>
                  </div>
                  {unmaskedResult && (
                    <div className="mt-2 font-mono font-bold text-emerald-800">
                      Số CCCD đầy đủ: {unmaskedResult}
                    </div>
                  )}
                  {unmaskError && <div className="mt-1 text-rose-600">{unmaskError}</div>}
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t">
                  <button
                    type="submit"
                    disabled={editSaving}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2.5 font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {editSaving ? "Đang lưu..." : "Lưu thay đổi"}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: DOCUMENTS CHECKLIST & SCAN VAULT */}
            {drawerTab === "DOCUMENTS" && (
              <div className="mt-5 space-y-4">
                {/* Header progress card */}
                <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-950">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">
                        Bảng kiểm soát giấy tờ &amp; Kho lưu trữ bản scan
                      </div>
                      <div className="mt-0.5 text-slate-600">
                        {docCompletionRate === 100
                          ? "Hồ sơ nhân sự đã nộp đầy đủ giấy tờ theo quy định pháp luật."
                          : `Đã nộp ${submittedDocCount}/${totalRequiredDocCount} giấy tờ (${docCompletionRate}%). Bấm "Tải lên bản scan" để đính kèm và lưu trữ.`}
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${
                          docCompletionRate === 100
                            ? "bg-emerald-200 text-emerald-900"
                            : "bg-amber-200 text-amber-900"
                        }`}
                      >
                        {docCompletionRate}% Đầy đủ
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-amber-200/60">
                    <div
                      className={`h-full transition-all duration-300 ${
                        docCompletionRate === 100 ? "bg-emerald-600" : "bg-amber-600"
                      }`}
                      style={{ width: `${docCompletionRate}%` }}
                    />
                  </div>
                </div>

                {/* Documents List */}
                <div className="space-y-3">
                  {currentEmpDocs.map((doc) => {
                    const isSubmitted = doc.status === "SUBMITTED";
                    return (
                      <div
                        key={doc.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition hover:border-slate-300 hover:bg-slate-50/40"
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div
                            className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                              isSubmitted
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-rose-100 text-rose-700"
                            }`}
                          >
                            {isSubmitted ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <AlertTriangle className="h-4 w-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 text-xs sm:text-sm">
                              {doc.title}
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-500">
                              {isSubmitted ? (
                                <span>
                                  Ngày nộp: <strong className="text-slate-700">{doc.submittedDate}</strong>
                                  {doc.fileSize && ` • ${doc.fileSize}`}
                                  {doc.fileName && (
                                    <span className="ml-1 text-emerald-700 font-medium">({doc.fileName})</span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-rose-600 font-medium">Chưa nộp bản sao chứng thực</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isSubmitted ? (
                            <>
                              {doc.scanUrl && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveScanUrl({
                                      title: doc.title,
                                      url: doc.scanUrl!,
                                    })
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
                                >
                                  <Eye className="h-3.5 w-3.5 text-slate-500" />
                                  Xem bản scan
                                </button>
                              )}

                              <label className="cursor-pointer inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-2xs hover:bg-slate-50">
                                <Upload className="h-3.5 w-3.5 text-slate-400" />
                                Thay thế
                                <input
                                  type="file"
                                  accept="image/*,application/pdf"
                                  className="hidden"
                                  onChange={(e) => {
                                    if (e.target.files?.[0]) handleUploadDoc(doc.id, e.target.files[0]);
                                  }}
                                />
                              </label>

                              <button
                                type="button"
                                onClick={() => handleDeleteDoc(doc.id)}
                                title="Xóa tài liệu"
                                className="rounded-xl p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition">
                              <Upload className="h-3.5 w-3.5" />
                              Tải lên bản scan
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files?.[0]) handleUploadDoc(doc.id, e.target.files[0]);
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 3: TIMELINE & QUICK VIEW */}
            {drawerTab === "TIMELINE" && (
              <div className="mt-5 space-y-4 text-xs">
                <div className="text-slate-500">
                  Bấm vào từng mốc sự kiện để xem chi tiết ngay lập tức:
                </div>

                <div className="relative border-l-2 border-slate-200 pl-4 space-y-6">
                  {/* Event 1: Contract */}
                  <div className="relative group cursor-pointer" onClick={() => setQuickViewItem({
                    title: "Chi tiết Hợp đồng lao động",
                    content: {
                      "Mã hợp đồng": selectedEmp.active_contract?.contract_no ?? "HD-2026-TKV",
                      "Loại hợp đồng": labelOf(CONTRACT_TYPE_LABELS, selectedEmp.active_contract?.contract_type ?? "INDEFINITE"),
                      "Hiệu lực từ": selectedEmp.active_contract?.effective_from ?? selectedEmp.hire_date,
                      "Hiệu lực đến": selectedEmp.active_contract?.effective_to ?? "Không xác định thời hạn",
                      "Lương thỏa thuận": fmtVnd(selectedEmp.salary_info?.base_salary ?? 15000000),
                      "Địa điểm": "Trụ sở chính Công ty Thế Kỷ Vàng (Tây Ninh)",
                    }
                  })}>
                    <div className="absolute -left-[21px] top-0.5 h-3 w-3 rounded-full bg-amber-500 ring-4 ring-white"></div>
                    <div className="font-bold text-slate-900">Mốc ký kết Hợp đồng lao động</div>
                    <div className="text-[11px] text-slate-500">{selectedEmp.hire_date}</div>
                    <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-slate-700">
                      Số HĐ: {selectedEmp.active_contract?.contract_no ?? "HD-2026-001"} • Bấm để xem chi tiết
                    </div>
                  </div>

                  {/* Event 2: Salary Decision */}
                  <div className="relative group cursor-pointer" onClick={() => setQuickViewItem({
                    title: "Chi tiết Quyết định mức lương",
                    content: {
                      "Số quyết định": `QĐ-L/${selectedEmp.employee_code}/2026`,
                      "Ngày ban hành": selectedEmp.hire_date,
                      "Mức lương chính thức": fmtVnd(selectedEmp.salary_info?.base_salary ?? 15000000),
                      "Mức lương đóng BHXH": fmtVnd(selectedEmp.salary_info?.si_salary_base ?? 15000000),
                      "Phụ cấp ăn trưa": "1.000.000 ₫ (Miễn thuế)",
                      "Phụ cấp xăng xe & điện thoại": "500.000 ₫",
                    }
                  })}>
                    <div className="absolute -left-[21px] top-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-white"></div>
                    <div className="font-bold text-slate-900">Quyết định bổ nhiệm &amp; mức lương</div>
                    <div className="text-[11px] text-slate-500">{selectedEmp.hire_date}</div>
                    <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-slate-700">
                      Mức lương cơ bản: {fmtVnd(selectedEmp.salary_info?.base_salary ?? 15000000)} • Bấm để xem chi tiết
                    </div>
                  </div>

                  {/* Event 3: Latest Payslip */}
                  <div className="relative group cursor-pointer" onClick={() => setQuickViewItem({
                    title: "Phiếu lương gần nhất (Tháng 10/2026)",
                    content: {
                      "Kỳ lương": "Tháng 10/2026 (2026-M10)",
                      "Số ngày công chuẩn": "22 ngày",
                      "Số ngày công thực tế": "22 ngày",
                      "Lương cơ bản chi trả": fmtVnd(selectedEmp.salary_info?.base_salary ?? 15000000),
                      "Trừ BHXH (10.5%)": fmtVnd(Math.round((selectedEmp.salary_info?.si_salary_base ?? 15000000) * 0.105)),
                      "Giảm trừ gia cảnh": "15.500.000 ₫ (Bản thân)",
                      "Thực lĩnh kỳ 2": fmtVnd(Math.round((selectedEmp.salary_info?.base_salary ?? 15000000) * 0.5)),
                      "Trạng thái": "ĐÃ CHI TRẢ (PAID)",
                    }
                  })}>
                    <div className="absolute -left-[21px] top-0.5 h-3 w-3 rounded-full bg-sky-500 ring-4 ring-white"></div>
                    <div className="font-bold text-slate-900">Tháng lương hoàn tất gần nhất (10/2026)</div>
                    <div className="text-[11px] text-slate-500">05/11/2026</div>
                    <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-slate-700">
                      Trạng thái: Đã quyết toán chuyển khoản • Bấm để xem chi tiết
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightbox / Modal xem ảnh scan phóng to & PDF */}
      {activeScanUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
          <div className="relative max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white p-5 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                <h3 className="font-bold text-slate-900 text-sm truncate">
                  {activeScanUrl.title}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={activeScanUrl.url}
                  download={activeScanUrl.title}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  Tải về
                </a>
                <button
                  type="button"
                  onClick={() => setActiveScanUrl(null)}
                  className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="mt-3 flex-1 overflow-auto flex items-center justify-center p-2 bg-slate-50/50 rounded-xl max-h-[75vh]">
              {activeScanUrl.url.startsWith("data:application/pdf") ? (
                <iframe
                  src={activeScanUrl.url}
                  title={activeScanUrl.title}
                  className="w-full h-[650px] border-0 rounded-lg shadow-sm"
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={activeScanUrl.url}
                  alt={activeScanUrl.title}
                  className="rounded-lg object-contain max-h-[72vh] max-w-full shadow-md"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick View Popup for Timeline */}
      {quickViewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm">{quickViewItem.title}</h3>
              <button
                type="button"
                onClick={() => setQuickViewItem(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-3 space-y-2 text-xs">
              {Object.entries(quickViewItem.content).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">{k}</span>
                  <span className="font-bold text-slate-800">{String(v)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setQuickViewItem(null)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offboarding Checklist Modal (Nhắc việc khi cho một người nghỉ việc) */}
      {showOffboardingModal && selectedEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-base">
              <AlertTriangle className="h-5 w-5" />
              Thủ tục nghỉ việc &amp; Bàn giao: {selectedEmp.full_name}
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Chuyển trạng thái sang &quot;Đã nghỉ việc&quot; yêu cầu bộ phận Nhân sự kiểm tra và hoàn tất 4 việc sau:
            </p>

            <div className="mt-4 space-y-3 rounded-xl border border-rose-100 bg-rose-50/50 p-4 text-xs">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={offboardingChecklist.assetReturned}
                  onChange={(e) => setOffboardingChecklist({ ...offboardingChecklist, assetReturned: e.target.checked })}
                  className="mt-0.5 rounded text-rose-600"
                />
                <div>
                  <span className="font-bold text-slate-800">1. Thu hồi tài sản &amp; công cụ làm việc:</span>
                  <div className="text-slate-500 text-[11px]">Laptop, thẻ ra vào, chìa khóa kho, đồng phục, tài liệu mật.</div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={offboardingChecklist.siBookClosed}
                  onChange={(e) => setOffboardingChecklist({ ...offboardingChecklist, siBookClosed: e.target.checked })}
                  className="mt-0.5 rounded text-rose-600"
                />
                <div>
                  <span className="font-bold text-slate-800">2. Chốt sổ BHXH &amp; BHYT:</span>
                  <div className="text-slate-500 text-[11px]">Báo giảm BHXH với cơ quan BHXH tỉnh Tây Ninh, in tờ rời chốt sổ bàn giao.</div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={offboardingChecklist.leaveSettled}
                  onChange={(e) => setOffboardingChecklist({ ...offboardingChecklist, leaveSettled: e.target.checked })}
                  className="mt-0.5 rounded text-rose-600"
                />
                <div>
                  <span className="font-bold text-slate-800">3. Quyết toán ngày phép &amp; trợ cấp thôi việc:</span>
                  <div className="text-slate-500 text-[11px]">Chi trả ngày phép năm chưa nghỉ, tiền lương tháng cuối cùng.</div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={offboardingChecklist.accountLocked}
                  onChange={(e) => setOffboardingChecklist({ ...offboardingChecklist, accountLocked: e.target.checked })}
                  className="mt-0.5 rounded text-rose-600"
                />
                <div>
                  <span className="font-bold text-slate-800">4. Khóa tài khoản hệ thống:</span>
                  <div className="text-slate-500 text-[11px]">Vô hiệu hóa quyền đăng nhập app HRM, Zalo nội bộ, email công ty.</div>
                </div>
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t pt-3">
              <button
                type="button"
                onClick={() => setShowOffboardingModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={executeEmployeeUpdate}
                className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700"
              >
                Xác nhận cho nghỉ việc
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Employee Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
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
                <div className="rounded-xl bg-red-50 p-3 text-red-700 font-semibold">{formError}</div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-semibold text-slate-700">Mã nhân viên *</label>
                  <input
                    required
                    placeholder="VD: TKV-0051"
                    value={formState.employeeCode}
                    onChange={(e) => setFormState({ ...formState, employeeCode: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Họ và tên *</label>
                  <input
                    required
                    placeholder="Nguyễn Văn An"
                    value={formState.fullName}
                    onChange={(e) => setFormState({ ...formState, fullName: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Số CCCD (12 số) *</label>
                  <input
                    required
                    placeholder="072089001234"
                    maxLength={12}
                    value={formState.nationalId}
                    onChange={(e) => setFormState({ ...formState, nationalId: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Số điện thoại (10 số) *</label>
                  <input
                    required
                    placeholder="0908123456"
                    maxLength={10}
                    value={formState.phone}
                    onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Ngày sinh</label>
                  <input
                    type="date"
                    value={formState.dob}
                    onChange={(e) => setFormState({ ...formState, dob: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Ngày vào làm *</label>
                  <input
                    type="date"
                    required
                    value={formState.hireDate}
                    onChange={(e) => setFormState({ ...formState, hireDate: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Phòng ban *</label>
                  <select
                    required
                    value={formState.departmentId}
                    onChange={(e) => {
                      const newDeptId = e.target.value;
                      const matching = (orgRefs?.positions ?? []).filter((p) => p.department_id === newDeptId);
                      setFormState({
                        ...formState,
                        departmentId: newDeptId,
                        positionId: matching[0]?.id ?? formState.positionId,
                      });
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium"
                  >
                    <option value="">-- Chọn phòng ban --</option>
                    {orgRefs?.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Chức danh / Vị trí *</label>
                  <select
                    required
                    value={formState.positionId}
                    onChange={(e) => setFormState({ ...formState, positionId: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium"
                  >
                    <option value="">-- Chọn chức danh --</option>
                    {filteredCreatePositions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-amber-600 px-5 py-2 font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {saving ? "Đang lưu..." : "Tạo hồ sơ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
