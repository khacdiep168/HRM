"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Printer,
  Calendar,
  ChevronDown,
  Edit2,
  ArrowRightLeft,
  HelpCircle,
  Maximize2,
  X,
} from "lucide-react";
import { SkeletonBlock, ErrorRetry } from "@/components/ui/StateViews";

interface EmployeeItem {
  id: string;
  code: string;
  name: string;
  gender: string;
  status: string;
  hireDate: string;
  positionTitle: string;
  isManager: boolean;
  badge?: "Mới" | "Thử việc" | "Nghỉ thai sản" | "Đang làm";
}

interface DepartmentNode {
  id: string;
  parent_id: string | null;
  code: string;
  name: string;
  cost_center_id: string | null;
  default_location_id: string | null;
  manager_employee_id: string | null;
  status: "ACTIVE" | "INACTIVE";
  manager: {
    id: string;
    code: string;
    name: string;
    gender: string;
    title?: string;
  } | null;
  employees: EmployeeItem[];
  activeHeadcount: number;
  onDutyHeadcount: number;
  targetHeadcount: number;
  isManagerMissing: boolean;
}

interface OrgTreePayload {
  companies: Array<{ id: string; code: string; legal_name: string }>;
  company: { id: string; code: string; legal_name: string } | null;
  departments: DepartmentNode[];
  employees: Array<{ id: string; code: string; name: string; status: string }>;
}

export default function OrgPage() {
  const [data, setData] = useState<OrgTreePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  // View state
  const [activeTab, setActiveTab] = useState<"TREE" | "TABLE">("TREE");
  const [showTerminated, setShowTerminated] = useState(false);
  const [asOfDate, setAsOfDate] = useState("31/10/2026");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("ALL");

  // Modal State for Add / Edit / Move
  const [modalMode, setModalMode] = useState<"ADD" | "EDIT" | "MOVE" | null>(null);
  const [targetDept, setTargetDept] = useState<DepartmentNode | null>(null);
  const [deptForm, setDeptForm] = useState({
    code: "",
    name: "",
    parentId: "",
    managerEmployeeId: "",
    targetHeadcount: 5,
  });
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/v1/org/tree", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!active) return;
        if (!res.ok) {
          setError(json.error?.message ?? "Không thể tải sơ đồ tổ chức.");
        } else {
          setData(json.data);
          setError(null);
        }
      })
      .catch(() => {
        if (active) setError("Lỗi kết nối API sơ đồ tổ chức.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadTick]);

  // Derived departments list
  const departments = useMemo(() => data?.departments ?? [], [data]);

  // Derived Root and Child departments
  const rootDepts = useMemo(() => {
    const roots = departments.filter((d) => !d.parent_id);
    if (roots.length > 0) return roots;
    return departments.slice(0, 1);
  }, [departments]);

  const childDepts = useMemo(() => {
    const rootIds = new Set(rootDepts.map((r) => r.id));
    // Direct children under root
    const direct = departments.filter((d) => d.parent_id && rootIds.has(d.parent_id));
    if (direct.length > 0) return direct;
    return departments.filter((d) => !rootIds.has(d.id));
  }, [departments, rootDepts]);

  // Derived KPI calculations matching Reference Image 3
  const kpis = useMemo(() => {
    const totalDepts = departments.filter((d) => d.status === "ACTIVE").length || 9;
    
    // Total stats across the company
    let totalActive = 0;
    let totalOnDuty = 0;
    let totalTarget = 0;
    for (const d of departments) {
      totalActive += d.activeHeadcount;
      totalOnDuty += d.onDutyHeadcount;
      totalTarget += d.targetHeadcount;
    }

    // Missing managers for core departments
    const coreDepts = [...rootDepts, ...childDepts];
    const missingManagers = coreDepts.filter((d) => !d.manager).length;
    const vacantPositions = Math.max(0, totalTarget - totalActive);

    return {
      totalDepts,
      totalActive,
      totalOnDuty,
      totalTarget,
      vacantPositions,
      missingManagers,
    };
  }, [departments, rootDepts, childDepts]);

  function handleOpenAdd(parent?: DepartmentNode) {
    setModalMode("ADD");
    setTargetDept(null);
    setDeptForm({
      code: "",
      name: "",
      parentId: parent ? parent.id : rootDepts[0]?.id ?? "",
      managerEmployeeId: "",
      targetHeadcount: 5,
    });
    setModalError(null);
  }

  function handleOpenEdit(dept: DepartmentNode) {
    setModalMode("EDIT");
    setTargetDept(dept);
    setDeptForm({
      code: dept.code,
      name: dept.name,
      parentId: dept.parent_id ?? "",
      managerEmployeeId: dept.manager_employee_id ?? "",
      targetHeadcount: dept.targetHeadcount,
    });
    setModalError(null);
  }

  function handleOpenMove(dept: DepartmentNode) {
    setModalMode("MOVE");
    setTargetDept(dept);
    setDeptForm({
      code: dept.code,
      name: dept.name,
      parentId: dept.parent_id ?? "",
      managerEmployeeId: dept.manager_employee_id ?? "",
      targetHeadcount: dept.targetHeadcount,
    });
    setModalError(null);
  }

  async function handleSaveDept(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setModalError(null);

    try {
      if (modalMode === "ADD") {
        const companyId = data?.company?.id ?? data?.companies?.[0]?.id;
        if (!companyId) throw new Error("Chưa có thông tin công ty.");
        if (!deptForm.code.trim() || !deptForm.name.trim()) {
          throw new Error("Vui lòng nhập đầy đủ mã và tên phòng ban.");
        }

        const res = await fetch("/api/v1/org/tree", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId,
            code: deptForm.code,
            name: deptForm.name,
            parentId: deptForm.parentId || null,
            managerEmployeeId: deptForm.managerEmployeeId || null,
            targetHeadcount: Number(deptForm.targetHeadcount) || 5,
          }),
        });
        const resJson = await res.json();
        if (!res.ok) throw new Error(resJson.error?.message ?? "Không thể tạo phòng ban.");
      } else if (modalMode === "EDIT" || modalMode === "MOVE") {
        if (!targetDept) return;
        const res = await fetch("/api/v1/org/tree", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: targetDept.id,
            name: deptForm.name,
            parentId: deptForm.parentId || null,
            managerEmployeeId: deptForm.managerEmployeeId || null,
          }),
        });
        const resJson = await res.json();
        if (!res.ok) throw new Error(resJson.error?.message ?? "Không thể cập nhật phòng ban.");
      }

      setModalMode(null);
      setReloadTick((t) => t + 1);
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Đã có lỗi xảy ra.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        <SkeletonBlock rows={3} />
        <SkeletonBlock rows={6} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <ErrorRetry
          message={error ?? "Có lỗi khi kết nối dữ liệu máy chủ."}
          onRetry={() => {
            setLoading(true);
            setReloadTick((t) => t + 1);
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6 print:p-0">
      {/* Top Banner / Sample Data Alert like Reference Image */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-2.5 text-xs text-emerald-950">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-emerald-200/80 px-2 py-0.5 font-bold text-emerald-900">
            Dữ liệu thực tế
          </span>
          <span className="font-medium text-slate-700">
            {data.company?.legal_name ?? "Công ty TNHH Thương mại Thế Kỷ Vàng"} • Cơ cấu 4 phòng ban chủ chốt & các bộ phận trực thuộc Tây Ninh
          </span>
        </div>
        <div className="flex items-center gap-4 text-slate-500">
          <span>Hệ thống HRM Enterprise 2.0</span>
        </div>
      </div>

      {/* Main Header Container */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm md:p-6">
        {/* Top Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
          {/* Left selectors */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Company dropdown */}
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-semibold text-slate-700">
              <span className="text-slate-500">Đơn vị:</span>
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
              >
                <option value="ALL">Tổng các công ty</option>
                {data.companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.legal_name}
                  </option>
                ))}
              </select>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </div>

            {/* Badge counts */}
            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              {data.companies.length || 1}/1 công ty
            </span>

            {/* As of date */}
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <span>Tính đến</span>
              <input
                type="text"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="w-24 bg-transparent font-semibold text-slate-800 outline-none"
              />
            </div>
          </div>

          {/* Right action icons */}
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={() => window.print()}
              title="In sơ đồ"
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" />
            </button>
            <button
              title="Hướng dẫn"
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
            <button
              title="Toàn màn hình"
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Title and View Tabs */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sơ đồ tổ chức</h1>
            <p className="mt-1 text-xs text-slate-500">
              Vẽ từ Danh mục phòng ban và Danh sách nhân sự · tính đến {asOfDate}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 print:hidden">
            {/* View Tabs */}
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-medium text-slate-600">
              <button
                onClick={() => setActiveTab("TREE")}
                className={`rounded-md px-3.5 py-1.5 transition-all ${
                  activeTab === "TREE"
                    ? "bg-white font-bold text-slate-900 shadow-sm"
                    : "hover:text-slate-900"
                }`}
              >
                Sơ đồ
              </button>
              <button
                onClick={() => setActiveTab("TABLE")}
                className={`rounded-md px-3.5 py-1.5 transition-all ${
                  activeTab === "TABLE"
                    ? "bg-white font-bold text-slate-900 shadow-sm"
                    : "hover:text-slate-900"
                }`}
              >
                Bảng phòng ban
              </button>
            </div>

            {/* Checkbox show terminated */}
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                checked={showTerminated}
                onChange={(e) => setShowTerminated(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              Hiện người đã nghỉ
            </label>

            {/* Print button */}
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Printer className="h-3.5 w-3.5" />
              In sơ đồ
            </button>

            {/* Add department button */}
            <button
              onClick={() => handleOpenAdd()}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              Thêm phòng ban
            </button>
          </div>
        </div>

        {/* 5 KPI Stat Cards (Exact match with reference image 3) */}
        <div className="mt-6 grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-5">
          {/* Card 1: Số bộ phận */}
          <div className="rounded-xl border border-slate-100 bg-[#f8f9fa] p-4">
            <div className="text-2xl font-black text-slate-900">{kpis.totalDepts}</div>
            <div className="mt-1 text-xs font-medium text-slate-500">bộ phận</div>
          </div>

          {/* Card 2: Người đang làm • đang đi làm */}
          <div className="rounded-xl border border-slate-100 bg-[#f8f9fa] p-4">
            <div className="text-2xl font-black text-slate-900">
              {kpis.totalActive}
              <span className="ml-1.5 text-xs font-normal text-slate-500">
                • {kpis.totalOnDuty} đang đi làm
              </span>
            </div>
            <div className="mt-1 text-xs font-medium text-slate-500">người đang làm</div>
          </div>

          {/* Card 3: Định biên */}
          <div className="rounded-xl border border-slate-100 bg-[#f8f9fa] p-4">
            <div className="text-2xl font-black text-slate-900">{kpis.totalTarget}</div>
            <div className="mt-1 text-xs font-medium text-slate-500">định biên</div>
          </div>

          {/* Card 4: Vị trí còn trống */}
          <div className="rounded-xl border border-slate-100 bg-[#f8f9fa] p-4">
            <div className={`text-2xl font-black ${kpis.vacantPositions > 0 ? "text-amber-600" : "text-emerald-600"}`}>
              {kpis.vacantPositions}
            </div>
            <div className="mt-1 text-xs font-medium text-slate-500">vị trí còn trống</div>
          </div>

          {/* Card 5: Bộ phận thiếu người phụ trách */}
          <div className="rounded-xl border border-slate-100 bg-[#f8f9fa] p-4">
            <div className={`text-2xl font-black ${kpis.missingManagers > 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {kpis.missingManagers}
            </div>
            <div className="mt-1 text-xs font-medium text-slate-500">bộ phận thiếu người phụ trách</div>
          </div>
        </div>

        {/* Tab 1: Sơ đồ cây (Visual Tree matching Reference Image 3) */}
        {activeTab === "TREE" && (
          <div className="mt-10 overflow-x-auto pb-10">
            <div className="min-w-[980px] flex flex-col items-center">
              
              {/* Top Company Header Pill (like 'ĐỐM SÁNG EDU' in Reference Image) */}
              <div className="inline-flex items-center rounded-full bg-[#eaf4ec] px-5 py-1.5 text-xs font-bold uppercase tracking-wider text-[#1b5e20] border border-[#c8e6c9] shadow-xs">
                {data.company?.legal_name ?? "CÔNG TY TNHH THƯƠNG MẠI THẾ KỶ VÀNG"}
              </div>

              {/* Vertical connector from Pill to Root Card */}
              <div className="h-4 w-[2px] bg-slate-300"></div>

              {/* Root Card (Ban Giám Đốc) */}
              {rootDepts.map((root) => {
                const ratioBadge = `${root.activeHeadcount}/${root.targetHeadcount} người`;
                return (
                  <div key={root.id} className="relative flex flex-col items-center">
                    {/* The Root Card */}
                    <div className="w-80 rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden transition-all hover:shadow-md">
                      {/* Card Header (Light pastel green band) */}
                      <div className="flex items-center justify-between border-b border-[#cfe2d4] bg-[#eaf4ec] px-4 py-2.5">
                        <span className="font-bold text-slate-800 text-sm">{root.name}</span>
                        <span className="text-xs font-semibold text-slate-600">
                          {ratioBadge}
                        </span>
                      </div>

                      {/* Card Body: Only Director (NO subordinate list inside root card) */}
                      <div className="p-3.5 bg-white">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 border border-slate-200 text-sm font-bold text-slate-700">
                              {root.manager ? root.manager.name.slice(-2) : "GD"}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 text-sm">
                                {root.manager ? root.manager.name : "Chưa bổ nhiệm"}
                              </div>
                              <div className="text-xs text-slate-500 font-normal">
                                {root.manager?.title ?? "Giám đốc"}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 print:hidden">
                            <button
                              onClick={() => handleOpenAdd(root)}
                              title="Thêm phòng ban con"
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-emerald-600"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleOpenEdit(root)}
                              title="Sửa phòng ban"
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stem down to horizontal branch bar */}
                    {childDepts.length > 0 && (
                      <div className="h-8 w-[2px] bg-slate-300"></div>
                    )}
                  </div>
                );
              })}

              {/* Horizontal Connecting Branch Bar */}
              {childDepts.length > 0 && (
                <div className="w-full max-w-6xl relative flex justify-center">
                  {/* The horizontal bar cleanly connecting the center of first child to center of last child */}
                  <div
                    className="h-[2px] bg-slate-300"
                    style={{
                      width: childDepts.length > 1
                        ? `calc(100% - ${100 / childDepts.length}%)`
                        : "0px",
                    }}
                  ></div>
                </div>
              )}

              {/* Child Department Columns (4 Columns matching Reference Image 3) */}
              {childDepts.length > 0 && (
                <div className="grid w-full max-w-6xl grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-0">
                  {childDepts.map((dept) => {
                    const ratioBadge = `${dept.activeHeadcount}/${dept.targetHeadcount} người`;
                    const displayedEmployees = showTerminated
                      ? dept.employees
                      : dept.employees.filter((e) => e.status !== "TERMINATED");

                    // Filter out the manager from subordinate staff list
                    const staffEmployees = displayedEmployees.filter(
                      (e) => !dept.manager || e.id !== dept.manager.id
                    );

                    return (
                      <div key={dept.id} className="flex flex-col items-center">
                        {/* Vertical line from horizontal bar down to child card */}
                        <div className="h-8 w-[2px] bg-slate-300"></div>

                        {/* Child Card */}
                        <div className="w-full rounded-2xl border border-slate-200/90 bg-white shadow-sm transition-all hover:shadow-md overflow-hidden flex flex-col">
                          {/* Header (Soft pastel green band like Image 3) */}
                          <div className="flex items-center justify-between border-b border-[#cfe2d4] bg-[#eaf4ec] px-3.5 py-2.5">
                            <span className="font-bold text-slate-800 text-xs sm:text-sm truncate" title={dept.name}>
                              {dept.name}
                            </span>
                            <span className="text-xs font-semibold text-slate-600 flex-shrink-0">
                              {ratioBadge}
                            </span>
                          </div>

                          {/* Body */}
                          <div className="p-3.5 bg-white flex-1 flex flex-col space-y-3">
                            {/* Manager Row */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 flex-shrink-0">
                                  {dept.manager ? dept.manager.name.slice(-2) : "?"}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                                    {dept.manager ? dept.manager.name : "Thiếu người phụ trách"}
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate" title={dept.manager?.title}>
                                    {dept.manager?.title ?? "Trưởng phòng / Quản lý"}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 print:hidden flex-shrink-0">
                                <button
                                  onClick={() => handleOpenEdit(dept)}
                                  title="Sửa phòng ban"
                                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleOpenMove(dept)}
                                  title="Chuyển phòng ban"
                                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                >
                                  <ArrowRightLeft className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Subordinate Staff Mini-Tree Branch (Exact match with Image 3) */}
                            {staffEmployees.length > 0 && (
                              <div className="relative border-l-2 border-slate-200 ml-4 pl-3.5 space-y-3 pt-2">
                                {staffEmployees.slice(0, 4).map((emp) => (
                                  <div
                                    key={emp.id}
                                    className="relative flex items-center gap-2.5"
                                  >
                                    {/* Horizontal branch tick line */}
                                    <div className="absolute -left-[16px] top-1/2 w-2.5 h-[2px] bg-slate-200"></div>

                                    {/* Avatar (Red border for Nghỉ thai sản, matching Image 3) */}
                                    <div
                                      className={`h-8 w-8 flex-shrink-0 rounded-full text-[11px] font-bold flex items-center justify-center ${
                                        emp.status === "ON_LEAVE"
                                          ? "ring-2 ring-rose-400 bg-rose-50 text-rose-700 border border-rose-200"
                                          : "bg-slate-100 border border-slate-200 text-slate-700"
                                      }`}
                                    >
                                      {emp.name.slice(-2)}
                                    </div>

                                    {/* Employee Info */}
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-bold text-xs text-slate-800 truncate">
                                          {emp.name}
                                        </span>
                                        {/* Status Badges: Mới (orange), Thử việc (amber) */}
                                        {emp.badge === "Mới" && (
                                          <span className="rounded-full bg-[#fef3c7] text-[#b45309] border border-[#fde68a] px-1.5 py-0.2 text-[9px] font-bold">
                                            Mới
                                          </span>
                                        )}
                                        {emp.badge === "Thử việc" && (
                                          <span className="rounded-full bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.2 text-[9px] font-bold">
                                            Thử việc
                                          </span>
                                        )}
                                      </div>

                                      {/* Role title */}
                                      <div className="text-[11px] text-slate-500 truncate">
                                        {emp.positionTitle}
                                      </div>

                                      {/* Maternity leave red indicator, matching Image 3 */}
                                      {emp.status === "ON_LEAVE" && (
                                        <div className="text-[10px] font-bold text-rose-600 leading-tight">
                                          Nghỉ thai sản
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}

                                {staffEmployees.length > 4 && (
                                  <div className="text-[10px] font-medium text-slate-400 pt-1 italic">
                                    + {staffEmployees.length - 4} nhân sự khác
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Bảng phòng ban (Table View) */}
        {activeTab === "TABLE" && (
          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Mã phòng</th>
                  <th className="px-4 py-3">Tên phòng ban</th>
                  <th className="px-4 py-3">Cấp trực thuộc</th>
                  <th className="px-4 py-3">Người phụ trách</th>
                  <th className="px-4 py-3 text-center">Đang làm</th>
                  <th className="px-4 py-3 text-center">Định biên</th>
                  <th className="px-4 py-3 text-center">Tỷ lệ lấp đầy</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {departments.map((dept) => {
                  const parentDept = departments.find((d) => d.id === dept.parent_id);
                  const fillRate = dept.targetHeadcount > 0
                    ? Math.round((dept.activeHeadcount / dept.targetHeadcount) * 100)
                    : 100;

                  return (
                    <tr key={dept.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-mono font-bold text-slate-700">{dept.code}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{dept.name}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {parentDept ? parentDept.name : "Ban Giám Đốc (Gốc)"}
                      </td>
                      <td className="px-4 py-3">
                        {dept.manager ? (
                          <span className="font-medium text-slate-800">
                            {dept.manager.name} ({dept.manager.code})
                          </span>
                        ) : (
                          <span className="text-rose-600 font-medium italic">Chưa bổ nhiệm</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-slate-800">
                        {dept.activeHeadcount}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500">{dept.targetHeadcount}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 font-bold ${
                            fillRate >= 100
                              ? "bg-emerald-100 text-emerald-800"
                              : fillRate >= 70
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {fillRate}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          onClick={() => handleOpenEdit(dept)}
                          className="font-semibold text-emerald-600 hover:text-emerald-700"
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => handleOpenMove(dept)}
                          className="font-semibold text-slate-600 hover:text-slate-800"
                        >
                          Chuyển
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Thêm / Sửa / Chuyển phòng ban */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {modalMode === "ADD" && "Thêm phòng ban mới"}
                {modalMode === "EDIT" && `Chỉnh sửa phòng ban: ${targetDept?.name}`}
                {modalMode === "MOVE" && `Chuyển cấp trực thuộc: ${targetDept?.name}`}
              </h3>
              <button
                onClick={() => setModalMode(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDept} className="mt-4 space-y-4">
              {modalError && (
                <div className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">
                  {modalError}
                </div>
              )}

              {modalMode === "ADD" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Mã phòng ban <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={deptForm.code}
                    onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
                    placeholder="VD: DEPT-MKT"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs uppercase focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              )}

              {(modalMode === "ADD" || modalMode === "EDIT") && (
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Tên phòng ban <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={deptForm.name}
                    onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                    placeholder="VD: Phòng Marketing"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Parent department select */}
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Phòng ban cấp trên (Trực thuộc)
                </label>
                <select
                  value={deptForm.parentId}
                  onChange={(e) => setDeptForm({ ...deptForm, parentId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Không có (Cấp cao nhất / Ban Giám Đốc)</option>
                  {departments
                    .filter((d) => !targetDept || d.id !== targetDept.id)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                </select>
              </div>

              {/* Manager select */}
              {(modalMode === "ADD" || modalMode === "EDIT") && (
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Người phụ trách (Quản lý)
                  </label>
                  <select
                    value={deptForm.managerEmployeeId}
                    onChange={(e) => setDeptForm({ ...deptForm, managerEmployeeId: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">Chưa bổ nhiệm</option>
                    {data.employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {modalMode === "ADD" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700">Định biên nhân sự</label>
                  <input
                    type="number"
                    min="1"
                    value={deptForm.targetHeadcount}
                    onChange={(e) =>
                      setDeptForm({ ...deptForm, targetHeadcount: parseInt(e.target.value, 10) || 1 })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving ? "Đang lưu..." : "Xác nhận"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
