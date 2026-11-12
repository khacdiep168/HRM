"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  MapPinned,
  Cpu,
  AlertCircle,
  CheckCircle2,
  Navigation,
  Clock,
  RefreshCw,
  ScanFace,
  Plus,
  CalendarCheck2,
  Upload,
  Download,
} from "lucide-react";
import { DEVICE_STATUS_LABELS, labelOf } from "@/lib/i18n/vi-labels";
import { buildUtf8BomCsv, parseCsvText } from "@/lib/integrations/csv-helper";

interface LocationOption {
  id: string;
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  geofence_radius_m: number;
}

interface AttendanceDataPayload {
  events: Array<{
    id: string;
    event_time: string;
    direction: string;
    source_type: string;
    verify_mode: string;
    distance_m: number | null;
    is_within_geofence: boolean | null;
    work_mode: string;
    employees: { employee_code: string; full_name: string } | null;
    locations: { code: string; name: string } | null;
  }>;
  exceptions: Array<{
    id: string;
    work_date: string;
    exception_type: string;
    explanation_note: string | null;
    status: string;
    employees: { employee_code: string; full_name: string } | null;
  }>;
  devices: Array<{
    id: string;
    device_code: string;
    device_name: string;
    device_type: string;
    last_sync_at: string | null;
    status: string;
    locations: { code: string; name: string } | null;
  }>;
  locations: LocationOption[];
  shifts: Array<{
    id: string;
    code: string;
    name: string;
    start_time: string;
    end_time: string;
    early_handover_minutes: number;
    standard_work_hours: number;
  }>;
}

interface SummaryRow {
  employee_id: string;
  employee_code: string;
  full_name: string;
  worked_days: number;
  total_scans: number;
}

export default function AttendancePage() {
  const [data, setData] = useState<AttendanceDataPayload | null>(null);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);
  const [activeTab, setActiveTab] = useState<
    "gps" | "devices" | "sessions" | "shifts" | "exceptions" | "summary"
  >("gps");

  // GPS Check-in form
  const [locationId, setLocationId] = useState("");
  const [direction, setDirection] = useState<"IN" | "OUT">("IN");
  const [workMode, setWorkMode] = useState<"ONSITE" | "REMOTE_DUTY">("ONSITE");
  const [latitude, setLatitude] = useState("11.0789");
  const [longitude, setLongitude] = useState("106.1784");
  const [accuracy, setAccuracy] = useState("18");
  const [note, setNote] = useState("");
  const [checkinMsg, setCheckinMsg] = useState<string | null>(null);
  const [checkinErr, setCheckinErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Device sync / test scan
  const [syncDeviceId, setSyncDeviceId] = useState("");
  const [syncEmployeeId, setSyncEmployeeId] = useState("");
  const [syncDirection, setSyncDirection] = useState<"IN" | "OUT">("IN");
  const [newDevCode, setNewDevCode] = useState("");
  const [newDevName, setNewDevName] = useState("");
  const [newDevLocId, setNewDevLocId] = useState("");
  const [deviceMsg, setDeviceMsg] = useState<string | null>(null);
  const [deviceErr, setDeviceErr] = useState<string | null>(null);

  // Auto-aggregate attendance -> payroll period
  const [aggPeriods, setAggPeriods] = useState<Array<{ id: string; period_code: string }>>([]);
  const [aggPeriodId, setAggPeriodId] = useState("");
  const [aggBusy, setAggBusy] = useState(false);
  const [aggMsg, setAggMsg] = useState<string | null>(null);

  // Phase 1: CSV device import & session normalization
  const [sessions, setSessions] = useState<
    Array<{
      id: string;
      work_date: string;
      effective_in: string | null;
      effective_out: string | null;
      worked_hours: number;
      late_minutes: number;
      early_minutes: number;
      night_hours: number;
      status: string;
      employees: { employee_code: string; full_name: string } | null;
    }>
  >([]);
  const [normStart, setNormStart] = useState("2026-10-26");
  const [normEnd, setNormEnd] = useState("2026-11-25");
  const [normMsg, setNormMsg] = useState<string | null>(null);
  const [normBusy, setNormBusy] = useState(false);
  const [importReport, setImportReport] = useState<{
    totalRows: number;
    importedCount: number;
    duplicateCount: number;
    errorCount: number;
    errors: Array<{ rowNumber: number; employeeCode: string; eventTime: string; reason: string }>;
  } | null>(null);

  // Phase 2: Shifts, calendars & exception approvals
  const [shiftsData, setShiftsData] = useState<{
    shifts: Array<{
      id: string;
      code: string;
      name: string;
      start_time: string;
      end_time: string;
      is_overnight: boolean;
      break_minutes: number;
      early_handover_minutes: number;
      standard_work_hours: number;
    }>;
    calendars: Array<{
      id: string;
      calendar_date: string;
      day_type: string;
      holiday_name: string | null;
    }>;
    assignments: Array<{
      id: string;
      work_date: string;
      employees: { employee_code: string; full_name: string } | null;
      shift_templates: { code: string; name: string } | null;
    }>;
    departments: Array<{ id: string; code: string; name: string }>;
    employees: Array<{ id: string; employee_code: string; full_name: string }>;
  } | null>(null);
  const [exceptionsList, setExceptionsList] = useState<
    Array<{
      id: string;
      work_date: string;
      exception_type: string;
      explanation_note: string | null;
      status: string;
      employees: { employee_code: string; full_name: string } | null;
    }>
  >([]);
  const [phase2Msg, setPhase2Msg] = useState<string | null>(null);
  const [shiftForm, setShiftForm] = useState({
    code: "",
    name: "",
    startTime: "08:00",
    endTime: "17:00",
    isOvernight: false,
    breakMinutes: "60",
    standardWorkHours: "8",
  });
  const [assignForm, setAssignForm] = useState({
    shiftTemplateId: "",
    scope: "ALL" as "ALL" | "DEPARTMENT" | "EMPLOYEE",
    departmentId: "",
    employeeId: "",
    startDate: "2026-11-01",
    endDate: "2026-11-30",
    skipWeekends: true,
  });
  const [holidayForm, setHolidayForm] = useState({
    calendarDate: "2027-01-01",
    holidayName: "Tết Dương lịch",
  });
  const [exForm, setExForm] = useState({
    workDate: "2026-11-12",
    exceptionType: "MISSING_OUT" as
      | "MISSING_IN"
      | "MISSING_OUT"
      | "OUT_OF_GEOFENCE"
      | "OUT_OF_SHIFT",
    requestedIn: "08:00",
    requestedOut: "17:00",
    explanationNote: "",
  });

  useEffect(() => {
    let active = true;
    fetch("/api/v1/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((meJson) => {
        const roles: string[] = meJson?.data?.roles ?? [];
        const canReadPayrollPeriods = roles.some((r) =>
          ["HR_ADMIN", "HR_STAFF", "ACCOUNTANT", "DIRECTOR", "AUDITOR"].includes(r)
        );
        return Promise.all([
          fetch("/api/v1/attendance/gps-checkin", { cache: "no-store" }),
          fetch("/api/v1/attendance/device-sync", { cache: "no-store" }),
          canReadPayrollPeriods
            ? fetch("/api/v1/payroll/periods", { cache: "no-store" })
            : Promise.resolve(new Response(JSON.stringify({ data: { periods: [] } }), { status: 200 })),
          fetch("/api/v1/attendance/normalize", { cache: "no-store" }),
          fetch("/api/v1/attendance/shifts", { cache: "no-store" }),
          fetch("/api/v1/attendance/exceptions", { cache: "no-store" }),
        ]);
      })
      .then(async ([res, sumRes, perRes, normRes, shRes, exRes]) => {
        if (!active) return;
        if (perRes.ok) {
          const perJson = await perRes.json();
          const pList = perJson.data?.periods ?? [];
          setAggPeriods(pList);
          if (pList.length > 0) setAggPeriodId((prev) => prev || pList[0].id);
        }
        if (normRes.ok) {
          const normJson = await normRes.json();
          setSessions(normJson.data?.sessions ?? []);
        }
        if (shRes.ok) {
          const shJson = await shRes.json();
          const sd = shJson.data;
          setShiftsData(sd);
          if (sd?.shifts?.length > 0) {
            setAssignForm((prev) => ({
              ...prev,
              shiftTemplateId: prev.shiftTemplateId || sd.shifts[0].id,
              departmentId: prev.departmentId || sd.departments?.[0]?.id || "",
              employeeId: prev.employeeId || sd.employees?.[0]?.id || "",
            }));
          }
        }
        if (exRes.ok) {
          const exJson = await exRes.json();
          setExceptionsList(exJson.data?.exceptions ?? []);
        }
        const json = await res.json();
        if (!res.ok) {
          setError(json.error?.message ?? "Không thể tải dữ liệu chấm công.");
          return;
        }
        const payload = json.data as AttendanceDataPayload;
        setError(null);
        setData(payload);
        if (payload.locations.length > 0) {
          setLocationId((prev) => prev || payload.locations[0].id);
          setNewDevLocId((prev) => prev || payload.locations[0].id);
        }
        if (payload.devices.length > 0) {
          setSyncDeviceId((prev) => prev || payload.devices[0].id);
        }

        if (sumRes.ok) {
          const sumJson = await sumRes.json();
          const sRows: SummaryRow[] = sumJson.data?.summary ?? [];
          setSummary(sRows);
          if (sRows.length > 0) {
            setSyncEmployeeId((prev) => prev || sRows[0].employee_id);
          }
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

  function handleGetBrowserGps() {
    setCheckinErr(null);
    if (!navigator.geolocation) {
      setCheckinErr("Trình duyệt không hỗ trợ định vị GPS.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setAccuracy(String(Math.round(pos.coords.accuracy)));
        setCheckinMsg("Đã lấy tọa độ GPS thực tế từ thiết bị.");
      },
      () => {
        setCheckinErr("Không thể truy cập GPS (vui lòng cấp quyền vị trí trên trình duyệt).");
      }
    );
  }

  async function handleGpsCheckin(e: React.FormEvent) {
    e.preventDefault();
    setCheckinMsg(null);
    setCheckinErr(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/attendance/gps-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          direction,
          workMode,
          latitude: Number(latitude),
          longitude: Number(longitude),
          accuracyMeters: Number(accuracy),
          explanationNote: note || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCheckinErr(json.error?.message ?? "Chấm công GPS thất bại.");
        return;
      }
      const d = json.data;
      setCheckinMsg(
        `Đã ghi nhận ${d.direction === "IN" ? "VÀO CA" : "RA CA"} (khoảng cách ${d.distanceMeters}m — ${d.isWithinGeofence ? "Hợp lệ trong vùng" : "Ngoài vùng Geofence"}).`
      );
      setNote("");
      setReloadTick((t) => t + 1);
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePingDevice(deviceId: string) {
    setDeviceMsg(null);
    setDeviceErr(null);
    const res = await fetch("/api/v1/attendance/device-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SYNC_PING", deviceId }),
    });
    const json = await res.json();
    if (!res.ok) {
      setDeviceErr(json.error?.message ?? "Đồng bộ thất bại.");
      return;
    }
    setDeviceMsg(`Đã đồng bộ thiết bị ${json.data.device_code} thành công (Trực tuyến).`);
    setReloadTick((t) => t + 1);
  }

  async function handleSimulateFaceScan(e: React.FormEvent) {
    e.preventDefault();
    setDeviceMsg(null);
    setDeviceErr(null);
    const res = await fetch("/api/v1/attendance/device-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "SIMULATE_SCAN",
        deviceId: syncDeviceId,
        employeeId: syncEmployeeId,
        direction: syncDirection,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setDeviceErr(json.error?.message ?? "Ghi nhận quét Face ID thất bại.");
      return;
    }
    setDeviceMsg("Đã đồng bộ dữ liệu quét Face ID từ máy chấm công về hệ thống.");
    setReloadTick((t) => t + 1);
  }

  async function handleAddDevice(e: React.FormEvent) {
    e.preventDefault();
    setDeviceMsg(null);
    setDeviceErr(null);
    const res = await fetch("/api/v1/attendance/device-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "ADD_DEVICE",
        deviceCode: newDevCode,
        deviceName: newDevName,
        locationId: newDevLocId,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setDeviceErr(json.error?.message ?? "Thêm thiết bị thất bại.");
      return;
    }
    setNewDevCode("");
    setNewDevName("");
    setDeviceMsg(`Đã kết nối máy chấm công ${json.data.device_code}.`);
    setReloadTick((t) => t + 1);
  }

  async function handleAggregatePeriod() {
    if (!aggPeriodId) return;
    setAggMsg(null);
    setAggBusy(true);
    try {
      const res = await fetch("/api/v1/attendance/aggregate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payrollPeriodId: aggPeriodId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAggMsg(json.error?.message ?? "Tổng hợp công thất bại.");
        return;
      }
      setAggMsg(
        `Đã tự động tổng hợp công kỳ ${json.data.periodCode} cho ${json.data.aggregatedCount} nhân viên (từ ${json.data.rawEventCount} lượt quét, ${json.data.approvedLeaveCount} đơn nghỉ phép & ${json.data.approvedOvertimeCount} đơn tăng ca đã duyệt).`
      );
      setReloadTick((t) => t + 1);
    } finally {
      setAggBusy(false);
    }
  }

  function handleDownloadAttendanceTemplate() {
    const csv = buildUtf8BomCsv(
      ["employee_code", "event_time", "direction", "device_code"],
      [
        ["TKV-0001", "2026-11-12 07:55:00", "IN", "FACE-VP-01"],
        ["TKV-0001", "2026-11-12 17:05:00", "OUT", "FACE-VP-01"],
      ]
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mau_import_may_cham_cong.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadImportErrors() {
    if (!importReport || importReport.errors.length === 0) return;
    const csv = buildUtf8BomCsv(
      ["row_number", "employee_code", "event_time", "error_reason"],
      importReport.errors.map((e) => [e.rowNumber, e.employeeCode, e.eventTime, e.reason])
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "loi_import_cham_cong.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleAttendanceCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNormMsg(null);
    setImportReport(null);
    setNormBusy(true);
    try {
      const text = await file.text();
      const parsed = parseCsvText(text);
      const rows = parsed.map((r, idx) => ({
        rowNumber: idx + 2,
        employeeCode: r.employee_code || r.ma_nv || "",
        eventTime: r.event_time || r.thoi_gian || "",
        direction: r.direction || r.loai || "UNKNOWN",
        deviceCode: r.device_code || r.ma_thiet_bi || undefined,
      }));
      if (rows.length === 0) {
        setNormMsg("File CSV không có dữ liệu.");
        return;
      }
      const res = await fetch("/api/v1/attendance/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const json = await res.json();
      if (!res.ok) {
        setNormMsg(json.error?.message ?? "Import dữ liệu máy chấm công thất bại.");
        return;
      }
      setImportReport(json.data);
      setNormMsg(
        `Đã import ${json.data.importedCount}/${json.data.totalRows} lượt quét (trùng bỏ qua: ${json.data.duplicateCount}, lỗi: ${json.data.errorCount}).`
      );
      setReloadTick((t) => t + 1);
    } finally {
      e.target.value = "";
      setNormBusy(false);
    }
  }

  async function handleNormalizeSessions() {
    setNormMsg(null);
    setNormBusy(true);
    try {
      const res = await fetch("/api/v1/attendance/normalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: normStart, endDate: normEnd }),
      });
      const json = await res.json();
      if (!res.ok) {
        setNormMsg(json.error?.message ?? "Chuẩn hóa phiên chấm công thất bại.");
        return;
      }
      setNormMsg(
        `Đã chuẩn hóa ${json.data.processedSessions} phiên công (${json.data.validCount} hợp lệ, ${json.data.exceptionCount} ngoại lệ thiếu IN/OUT).`
      );
      setReloadTick((t) => t + 1);
    } finally {
      setNormBusy(false);
    }
  }

  async function handleCreateShift(e: React.FormEvent) {
    e.preventDefault();
    setPhase2Msg(null);
    const res = await fetch("/api/v1/attendance/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "CREATE_SHIFT",
        code: shiftForm.code,
        name: shiftForm.name,
        startTime: shiftForm.startTime,
        endTime: shiftForm.endTime,
        isOvernight: shiftForm.isOvernight,
        breakMinutes: Number(shiftForm.breakMinutes),
        standardWorkHours: Number(shiftForm.standardWorkHours),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setPhase2Msg(json.error?.message ?? "Tạo ca làm việc thất bại.");
      return;
    }
    setShiftForm({ ...shiftForm, code: "", name: "" });
    setPhase2Msg(`Đã lưu ca làm việc ${json.data.code} — ${json.data.name}.`);
    setReloadTick((t) => t + 1);
  }

  async function handleBulkAssignShift(e: React.FormEvent) {
    e.preventDefault();
    setPhase2Msg(null);
    const res = await fetch("/api/v1/attendance/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "ASSIGN_SHIFT_BULK",
        shiftTemplateId: assignForm.shiftTemplateId,
        scope: assignForm.scope,
        departmentId: assignForm.scope === "DEPARTMENT" ? assignForm.departmentId : undefined,
        employeeId: assignForm.scope === "EMPLOYEE" ? assignForm.employeeId : undefined,
        startDate: assignForm.startDate,
        endDate: assignForm.endDate,
        skipWeekends: assignForm.skipWeekends,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setPhase2Msg(json.error?.message ?? "Phân ca hàng loạt thất bại.");
      return;
    }
    setPhase2Msg(
      `Đã phân ca hàng loạt ${json.data.assignedCount} lượt (${json.data.employeeCount} nhân viên × ${json.data.dayCount} ngày).`
    );
    setReloadTick((t) => t + 1);
  }

  async function handleAddHoliday(e: React.FormEvent) {
    e.preventDefault();
    setPhase2Msg(null);
    const res = await fetch("/api/v1/attendance/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "ADD_HOLIDAY",
        calendarDate: holidayForm.calendarDate,
        dayType: "HOLIDAY",
        holidayName: holidayForm.holidayName,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setPhase2Msg(json.error?.message ?? "Thêm ngày lễ thất bại.");
      return;
    }
    setPhase2Msg(`Đã thêm ngày lễ ${json.data.calendar_date}: ${json.data.holiday_name}.`);
    setReloadTick((t) => t + 1);
  }

  async function handleSubmitException(e: React.FormEvent) {
    e.preventDefault();
    setPhase2Msg(null);
    const res = await fetch("/api/v1/attendance/exceptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "SUBMIT_EXCEPTION",
        ...exForm,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setPhase2Msg(json.error?.message ?? "Gửi giải trình ngoại lệ thất bại.");
      return;
    }
    setExForm({ ...exForm, explanationNote: "" });
    setPhase2Msg("Đã gửi yêu cầu điều chỉnh công / giải trình ngoại lệ.");
    setReloadTick((t) => t + 1);
  }

  async function handleReviewException(
    exceptionId: string,
    decision: "APPROVED" | "REJECTED"
  ) {
    setPhase2Msg(null);
    const res = await fetch("/api/v1/attendance/exceptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "REVIEW_EXCEPTION",
        exceptionId,
        decision,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setPhase2Msg(json.error?.message ?? "Phê duyệt ngoại lệ thất bại.");
      return;
    }
    setPhase2Msg(
      decision === "APPROVED"
        ? "Đã duyệt ngoại lệ và cập nhật phiên công kèm Audit log."
        : "Đã từ chối yêu cầu ngoại lệ."
    );
    setReloadTick((t) => t + 1);
  }

  if (loading) {
    return (
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="h-5 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
        <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
        <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle className="h-5 w-5" />
          Chưa thể truy cập Chấm công
        </div>
        <p className="mt-2 text-xs">{error}</p>
        <Link
          href="/login"
          className="mt-4 inline-block rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white"
        >
          Đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <MapPinned className="h-5 w-5 text-amber-600" />
            Chấm công GPS &amp; Kết nối Máy chấm công Face ID
          </h1>
          <p className="text-sm text-slate-600">
            Theo dõi bảng công tháng, chấm công GPS Geofence và đồng bộ máy chấm công ZKTeco/Hikvision.
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

      {/* Auto-aggregate Attendance -> Payroll */}
      {aggPeriods.length > 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-emerald-950">
                Tự động Tổng hợp Công – Nghỉ phép – Tăng ca sang Bảng lương (1.000+ Nhân viên)
              </div>
              <p className="text-[11px] text-emerald-800">
                Quét toàn bộ dữ liệu máy chấm công, GPS, đơn nghỉ phép và tăng ca đã duyệt trong kỳ
                để chốt ngày công tính lương tự động.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                value={aggPeriodId}
                onChange={(e) => setAggPeriodId(e.target.value)}
                className="rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-slate-900"
              >
                {aggPeriods.map((p) => (
                  <option key={p.id} value={p.id}>
                    Kỳ {p.period_code}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={aggBusy || !aggPeriodId}
                onClick={handleAggregatePeriod}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <CalendarCheck2 className="h-3.5 w-3.5" />
                {aggBusy ? "Đang tổng hợp..." : "Tổng hợp Công Kỳ lương"}
              </button>
            </div>
          </div>
          {aggMsg && <div className="mt-2 text-xs font-medium text-emerald-900">{aggMsg}</div>}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("gps")}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold ${
            activeTab === "gps"
              ? "bg-slate-900 text-white"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Navigation className="h-3.5 w-3.5" />
          Chấm công GPS &amp; Ca làm việc
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("devices")}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold ${
            activeTab === "devices"
              ? "bg-slate-900 text-white"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Cpu className="h-3.5 w-3.5" />
          Kết nối Máy chấm công ({data.devices.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("sessions")}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold ${
            activeTab === "sessions"
              ? "bg-slate-900 text-white"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          Import Máy &amp; Chuẩn hóa Ca ({sessions.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("shifts")}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold ${
            activeTab === "shifts"
              ? "bg-slate-900 text-white"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          Ca làm việc &amp; Phân ca ({shiftsData?.shifts.length ?? 0})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("exceptions")}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold ${
            activeTab === "exceptions"
              ? "bg-slate-900 text-white"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <AlertCircle className="h-3.5 w-3.5" />
          Ngoại lệ &amp; Duyệt Công ({exceptionsList.filter((e) => e.status === "PENDING").length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("summary")}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold ${
            activeTab === "summary"
              ? "bg-slate-900 text-white"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <CalendarCheck2 className="h-3.5 w-3.5" />
          Bảng tổng hợp công ({summary.length} NV)
        </button>
      </div>

      {/* Tab 1: GPS Check-in & Shifts */}
      {activeTab === "gps" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Navigation className="h-4 w-4 text-amber-600" />
                Chấm công GPS (Web/Mobile)
              </h2>
              <button
                type="button"
                onClick={handleGetBrowserGps}
                className="rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100"
              >
                Lấy GPS hiện tại
              </button>
            </div>
            <form onSubmit={handleGpsCheckin} className="mt-4 space-y-3 text-xs">
              {checkinErr && (
                <div className="rounded-xl bg-red-50 p-2.5 text-red-700">{checkinErr}</div>
              )}
              {checkinMsg && (
                <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-800">{checkinMsg}</div>
              )}
              <div>
                <label className="block font-medium text-slate-700">Địa điểm làm việc</label>
                <select
                  value={locationId}
                  onChange={(e) => {
                    const loc = data.locations.find((l) => l.id === e.target.value);
                    setLocationId(e.target.value);
                    if (loc) {
                      setLatitude(String(loc.latitude));
                      setLongitude(String(loc.longitude));
                    }
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  {data.locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} (Bán kính {l.geofence_radius_m}m)
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-slate-700">Loại quét</label>
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value as "IN" | "OUT")}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="IN">Vào ca (Check-in)</option>
                    <option value="OUT">Ra ca (Check-out)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700">Hình thức</label>
                  <select
                    value={workMode}
                    onChange={(e) => setWorkMode(e.target.value as "ONSITE" | "REMOTE_DUTY")}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="ONSITE">Tại chi nhánh/kho</option>
                    <option value="REMOTE_DUTY">Đi thị trường / Công tác</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-medium text-slate-700">Vĩ độ</label>
                  <input
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-2 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700">Kinh độ</label>
                  <input
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-2 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700">Sai số (m)</label>
                  <input
                    value={accuracy}
                    onChange={(e) => setAccuracy(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-2 py-1.5 font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-slate-700">Ghi chú / Giải trình</label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Vd: Đi giao hàng tuyến Gò Dầu..."
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-amber-600 px-4 py-2.5 font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {submitting ? "Đang ghi nhận..." : "Xác nhận Chấm công GPS"}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-2">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Clock className="h-4 w-4 text-amber-600" />
              Ca làm việc chuẩn &amp; Nhật ký quét gần nhất
            </h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {data.shifts.map((s) => (
                <div key={s.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
                  <div className="font-semibold text-slate-900">{s.name}</div>
                  <div className="mt-0.5 text-slate-600">
                    {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)} ({s.standard_work_hours}h)
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[540px] text-left text-xs">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">Thời gian</th>
                    <th className="py-2 pr-3">Nhân viên</th>
                    <th className="py-2 pr-3">Loại</th>
                    <th className="py-2 pr-3">Nguồn</th>
                    <th className="py-2 pr-3">Địa điểm</th>
                    <th className="py-2">Geofence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.events.slice(0, 15).map((ev) => (
                    <tr key={ev.id}>
                      <td className="py-2 pr-3 font-mono text-slate-600">
                        {ev.event_time.slice(0, 16).replace("T", " ")}
                      </td>
                      <td className="py-2 pr-3 font-medium text-slate-900">
                        {ev.employees?.employee_code} — {ev.employees?.full_name}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            ev.direction === "IN"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-sky-50 text-sky-700"
                          }`}
                        >
                          {ev.direction === "IN" ? "Vào ca" : "Ra ca"}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-slate-600">
                        {ev.source_type === "DEVICE_FACE_ID" ? "Máy Face ID" : "Web GPS"}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{ev.locations?.name ?? "—"}</td>
                      <td className="py-2">
                        {ev.is_within_geofence ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Hợp lệ
                          </span>
                        ) : (
                          <span className="text-amber-700">Ngoài vùng</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {data.events.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">
                        Chưa có dữ liệu chấm công.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* Tab 2: Attendance Devices & Sync */}
      {activeTab === "devices" && (
        <div className="space-y-6">
          {deviceErr && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {deviceErr}
            </div>
          )}
          {deviceMsg && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              {deviceMsg}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.devices.map((dev) => (
              <div
                key={dev.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-900">
                      {dev.device_code}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        dev.status === "ONLINE"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {labelOf(DEVICE_STATUS_LABELS, dev.status)}
                    </span>
                  </div>
                  <div className="mt-1.5 text-sm font-semibold text-slate-900">
                    {dev.device_name}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {dev.locations?.name ?? "—"}
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400">
                    Đồng bộ cuối:{" "}
                    {dev.last_sync_at
                      ? dev.last_sync_at.slice(0, 16).replace("T", " ")
                      : "Chưa đồng bộ"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handlePingDevice(dev.id)}
                  className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Kiểm tra &amp; Đồng bộ ngay
                </button>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <form
              onSubmit={handleSimulateFaceScan}
              className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs text-xs"
            >
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <ScanFace className="h-4 w-4 text-amber-600" />
                Đồng bộ lượt quét Face ID từ Máy chấm công
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  value={syncDeviceId}
                  onChange={(e) => setSyncDeviceId(e.target.value)}
                  required
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  {data.devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.device_code} — {d.device_name}
                    </option>
                  ))}
                </select>
                <select
                  value={syncDirection}
                  onChange={(e) => setSyncDirection(e.target.value as "IN" | "OUT")}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="IN">Vào ca (IN)</option>
                  <option value="OUT">Ra ca (OUT)</option>
                </select>
              </div>
              <select
                value={syncEmployeeId}
                onChange={(e) => setSyncEmployeeId(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                {summary.map((s) => (
                  <option key={s.employee_id} value={s.employee_id}>
                    {s.employee_code} — {s.full_name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-xl bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-700"
              >
                Ghi nhận lượt quét Face ID
              </button>
            </form>

            <form
              onSubmit={handleAddDevice}
              className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs text-xs"
            >
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Plus className="h-4 w-4 text-slate-700" />
                Kết nối thêm Máy chấm công mới
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  required
                  placeholder="Mã máy (vd: FACE-HCM-01)"
                  value={newDevCode}
                  onChange={(e) => setNewDevCode(e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                <select
                  value={newDevLocId}
                  onChange={(e) => setNewDevLocId(e.target.value)}
                  required
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  {data.locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <input
                required
                placeholder="Tên thiết bị (vd: Máy Face ID Hikvision Cổng chính)"
                value={newDevName}
                onChange={(e) => setNewDevName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="rounded-xl bg-slate-50 p-2.5 text-[11px] text-slate-600">
                Webhook Endpoint cho thiết bị thực:{" "}
                <code className="font-mono font-semibold text-slate-900">
                  POST /api/v1/integrations/attendance/face-id-events
                </code>{" "}
                (xác thực HMAC-SHA256).
              </div>
              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800"
              >
                Thêm thiết bị chấm công
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab 3: Monthly Attendance Summary */}
      {/* Tab 3: Import CSV & Session Normalization */}
      {activeTab === "sessions" && (
        <div className="space-y-6">
          <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:grid-cols-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                1. Import Dữ liệu Máy chấm công (CSV / Excel)
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Kiểm tra trùng lặp theo idempotency key, phát hiện mã NV không tồn tại &amp; xuất
                file lỗi để xử lý lại không nhân đôi dữ liệu.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleDownloadAttendanceTemplate}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  Tải mẫu CSV
                </button>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 font-semibold text-white hover:bg-slate-800">
                  <Upload className="h-3.5 w-3.5" />
                  Import CSV Máy chấm công
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleAttendanceCsvUpload}
                    disabled={normBusy}
                    className="hidden"
                  />
                </label>
                {importReport && importReport.errorCount > 0 && (
                  <button
                    type="button"
                    onClick={handleDownloadImportErrors}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Tải {importReport.errorCount} dòng lỗi CSV
                  </button>
                )}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-bold text-slate-900">
                2. Chuẩn hóa &amp; Ghép cặp Check-in / Check-out
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Tự động lọc quét trùng (5 phút), ghép cặp ca ngày &amp; ca qua đêm, tính giờ đi
                trễ/về sớm/ca đêm và tạo ngoại lệ nếu thiếu IN/OUT.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <input
                  type="date"
                  value={normStart}
                  onChange={(e) => setNormStart(e.target.value)}
                  className="rounded-lg border border-slate-300 px-2.5 py-1.5"
                />
                <span>→</span>
                <input
                  type="date"
                  value={normEnd}
                  onChange={(e) => setNormEnd(e.target.value)}
                  className="rounded-lg border border-slate-300 px-2.5 py-1.5"
                />
                <button
                  type="button"
                  disabled={normBusy}
                  onClick={handleNormalizeSessions}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-2 font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  <Clock className="h-3.5 w-3.5" />
                  {normBusy ? "Đang xử lý..." : "Chuẩn hóa & Ghép cặp Ca"}
                </button>
              </div>
            </div>
            {normMsg && (
              <div className="lg:col-span-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-900">
                {normMsg}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900">
              Danh sách Phiên công đã Chuẩn hóa ({sessions.length})
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">Ngày công</th>
                    <th className="py-2 pr-3">Nhân viên</th>
                    <th className="py-2 pr-3">Giờ vào</th>
                    <th className="py-2 pr-3">Giờ ra</th>
                    <th className="py-2 pr-3">Giờ làm</th>
                    <th className="py-2 pr-3">Đi trễ</th>
                    <th className="py-2 pr-3">Về sớm</th>
                    <th className="py-2 pr-3">Ca đêm</th>
                    <th className="py-2">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-slate-500">
                        Chưa có phiên công chuẩn hóa. Hãy bấm &ldquo;Chuẩn hóa &amp; Ghép cặp
                        Ca&rdquo; ở trên.
                      </td>
                    </tr>
                  ) : (
                    sessions.map((s) => (
                      <tr key={s.id}>
                        <td className="py-2 pr-3 font-mono">{s.work_date}</td>
                        <td className="py-2 pr-3 font-medium text-slate-900">
                          {s.employees?.employee_code} — {s.employees?.full_name}
                        </td>
                        <td className="py-2 pr-3 font-mono text-slate-600">
                          {s.effective_in
                            ? new Date(s.effective_in).toLocaleTimeString("vi-VN")
                            : "—"}
                        </td>
                        <td className="py-2 pr-3 font-mono text-slate-600">
                          {s.effective_out
                            ? new Date(s.effective_out).toLocaleTimeString("vi-VN")
                            : "—"}
                        </td>
                        <td className="py-2 pr-3 font-mono font-semibold text-slate-900">
                          {s.worked_hours}h
                        </td>
                        <td className="py-2 pr-3 font-mono text-amber-700">{s.late_minutes}p</td>
                        <td className="py-2 pr-3 font-mono text-amber-700">{s.early_minutes}p</td>
                        <td className="py-2 pr-3 font-mono text-indigo-700">{s.night_hours}h</td>
                        <td className="py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              s.status === "VALID" || s.status === "APPROVED"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {s.status === "VALID"
                              ? "Hợp lệ"
                              : s.status === "APPROVED"
                                ? "Đã duyệt"
                                : "Ngoại lệ (Thiếu IN/OUT)"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* Tab 4: Shifts & Bulk Schedule */}
      {activeTab === "shifts" && (
        <div className="space-y-6">
          {phase2Msg && (
            <div className="rounded-xl bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-900">
              {phase2Msg}
            </div>
          )}
          <div className="grid gap-6 lg:grid-cols-3">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <h2 className="text-sm font-bold text-slate-900">Tạo / Cập nhật Ca làm việc</h2>
              <form onSubmit={handleCreateShift} className="mt-3 space-y-2.5 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    required
                    placeholder="Mã ca (VD: CA_DEM)"
                    value={shiftForm.code}
                    onChange={(e) => setShiftForm({ ...shiftForm, code: e.target.value })}
                    className="rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono uppercase"
                  />
                  <input
                    required
                    placeholder="Tên ca"
                    value={shiftForm.name}
                    onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                    className="rounded-lg border border-slate-300 px-2.5 py-1.5"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-500">Giờ vào</label>
                    <input
                      type="time"
                      value={shiftForm.startTime}
                      onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })}
                      className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500">Giờ ra</label>
                    <input
                      type="time"
                      value={shiftForm.endTime}
                      onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })}
                      className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-500">Nghỉ giữa ca (phút)</label>
                    <input
                      type="number"
                      value={shiftForm.breakMinutes}
                      onChange={(e) => setShiftForm({ ...shiftForm, breakMinutes: e.target.value })}
                      className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500">Giờ chuẩn</label>
                    <input
                      type="number"
                      step="0.5"
                      value={shiftForm.standardWorkHours}
                      onChange={(e) =>
                        setShiftForm({ ...shiftForm, standardWorkHours: e.target.value })
                      }
                      className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 font-mono"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-slate-700">
                  <input
                    type="checkbox"
                    checked={shiftForm.isOvernight}
                    onChange={(e) => setShiftForm({ ...shiftForm, isOvernight: e.target.checked })}
                  />
                  Ca làm việc qua đêm (kết thúc ngày hôm sau)
                </label>
                <button
                  type="submit"
                  className="w-full rounded-lg bg-slate-900 py-2 font-semibold text-white hover:bg-slate-800"
                >
                  Lưu Ca làm việc
                </button>
              </form>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <h2 className="text-sm font-bold text-slate-900">Phân ca Hàng loạt</h2>
              <form onSubmit={handleBulkAssignShift} className="mt-3 space-y-2.5 text-xs">
                <select
                  value={assignForm.shiftTemplateId}
                  onChange={(e) =>
                    setAssignForm({ ...assignForm, shiftTemplateId: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
                >
                  {(shiftsData?.shifts ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name} ({s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)})
                    </option>
                  ))}
                </select>
                <select
                  value={assignForm.scope}
                  onChange={(e) =>
                    setAssignForm({
                      ...assignForm,
                      scope: e.target.value as "ALL" | "DEPARTMENT" | "EMPLOYEE",
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
                >
                  <option value="ALL">Toàn bộ nhân viên đang làm việc</option>
                  <option value="DEPARTMENT">Theo Bộ phận</option>
                  <option value="EMPLOYEE">Theo Cá nhân</option>
                </select>
                {assignForm.scope === "DEPARTMENT" && (
                  <select
                    value={assignForm.departmentId}
                    onChange={(e) =>
                      setAssignForm({ ...assignForm, departmentId: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
                  >
                    {(shiftsData?.departments ?? []).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} — {d.name}
                      </option>
                    ))}
                  </select>
                )}
                {assignForm.scope === "EMPLOYEE" && (
                  <select
                    value={assignForm.employeeId}
                    onChange={(e) => setAssignForm({ ...assignForm, employeeId: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
                  >
                    {(shiftsData?.employees ?? []).map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.employee_code} — {emp.full_name}
                      </option>
                    ))}
                  </select>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={assignForm.startDate}
                    onChange={(e) => setAssignForm({ ...assignForm, startDate: e.target.value })}
                    className="rounded-lg border border-slate-300 px-2 py-1.5"
                  />
                  <input
                    type="date"
                    value={assignForm.endDate}
                    onChange={(e) => setAssignForm({ ...assignForm, endDate: e.target.value })}
                    className="rounded-lg border border-slate-300 px-2 py-1.5"
                  />
                </div>
                <label className="flex items-center gap-2 text-slate-700">
                  <input
                    type="checkbox"
                    checked={assignForm.skipWeekends}
                    onChange={(e) =>
                      setAssignForm({ ...assignForm, skipWeekends: e.target.checked })
                    }
                  />
                  Bỏ qua Thứ 7 &amp; Chủ nhật
                </label>
                <button
                  type="submit"
                  className="w-full rounded-lg bg-amber-600 py-2 font-semibold text-white hover:bg-amber-700"
                >
                  Phân ca Hàng loạt
                </button>
              </form>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <h2 className="text-sm font-bold text-slate-900">Lịch Ngày lễ</h2>
              <form onSubmit={handleAddHoliday} className="mt-3 space-y-2.5 text-xs">
                <input
                  type="date"
                  value={holidayForm.calendarDate}
                  onChange={(e) =>
                    setHolidayForm({ ...holidayForm, calendarDate: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
                />
                <input
                  required
                  placeholder="Tên ngày lễ"
                  value={holidayForm.holidayName}
                  onChange={(e) =>
                    setHolidayForm({ ...holidayForm, holidayName: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
                />
                <button
                  type="submit"
                  className="w-full rounded-lg border border-slate-900 py-2 font-semibold text-slate-900 hover:bg-slate-50"
                >
                  Thêm Ngày lễ
                </button>
              </form>
              <div className="mt-3 max-h-36 space-y-1 overflow-y-auto text-xs">
                {(shiftsData?.calendars ?? []).map((cal) => (
                  <div
                    key={cal.id}
                    className="flex justify-between rounded bg-slate-50 px-2.5 py-1"
                  >
                    <span className="font-mono">{cal.calendar_date}</span>
                    <span className="font-medium text-rose-700">{cal.holiday_name}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Tab 5: Exceptions & Attendance Approval */}
      {activeTab === "exceptions" && (
        <div className="space-y-6">
          {phase2Msg && (
            <div className="rounded-xl bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-900">
              {phase2Msg}
            </div>
          )}
          <div className="grid gap-6 lg:grid-cols-3">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <h2 className="text-sm font-bold text-slate-900">Gửi Giải trình / Điều chỉnh Công</h2>
              <form onSubmit={handleSubmitException} className="mt-3 space-y-2.5 text-xs">
                <input
                  type="date"
                  value={exForm.workDate}
                  onChange={(e) => setExForm({ ...exForm, workDate: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
                />
                <select
                  value={exForm.exceptionType}
                  onChange={(e) =>
                    setExForm({
                      ...exForm,
                      exceptionType: e.target.value as typeof exForm.exceptionType,
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
                >
                  <option value="MISSING_OUT">Quên Check-out</option>
                  <option value="MISSING_IN">Quên Check-in</option>
                  <option value="OUT_OF_GEOFENCE">Làm việc ngoài địa điểm / Công tác</option>
                  <option value="OUT_OF_SHIFT">Sai giờ ca / Đổi ca</option>
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-500">Giờ vào đề xuất</label>
                    <input
                      type="time"
                      value={exForm.requestedIn}
                      onChange={(e) => setExForm({ ...exForm, requestedIn: e.target.value })}
                      className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500">Giờ ra đề xuất</label>
                    <input
                      type="time"
                      value={exForm.requestedOut}
                      onChange={(e) => setExForm({ ...exForm, requestedOut: e.target.value })}
                      className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5"
                    />
                  </div>
                </div>
                <textarea
                  required
                  rows={2}
                  placeholder="Lý do giải trình (VD: Đi gặp khách hàng tại Tây Ninh)"
                  value={exForm.explanationNote}
                  onChange={(e) => setExForm({ ...exForm, explanationNote: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
                />
                <button
                  type="submit"
                  className="w-full rounded-lg bg-slate-900 py-2 font-semibold text-white hover:bg-slate-800"
                >
                  Gửi Giải trình Ngoại lệ
                </button>
              </form>
            </section>

            <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <h2 className="text-sm font-bold text-slate-900">
                Danh sách Ngoại lệ &amp; Phê duyệt ({exceptionsList.length})
              </h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2 pr-3">Ngày</th>
                      <th className="py-2 pr-3">Nhân viên</th>
                      <th className="py-2 pr-3">Loại</th>
                      <th className="py-2 pr-3">Giải trình</th>
                      <th className="py-2 pr-3">Trạng thái</th>
                      <th className="py-2 text-right">Phê duyệt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {exceptionsList.map((ex) => (
                      <tr key={ex.id}>
                        <td className="py-2 pr-3 font-mono">{ex.work_date}</td>
                        <td className="py-2 pr-3 font-medium">
                          {ex.employees?.employee_code} — {ex.employees?.full_name}
                        </td>
                        <td className="py-2 pr-3 font-mono text-[11px]">{ex.exception_type}</td>
                        <td className="py-2 pr-3 text-slate-600">{ex.explanation_note}</td>
                        <td className="py-2 pr-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              ex.status === "APPROVED"
                                ? "bg-emerald-100 text-emerald-800"
                                : ex.status === "REJECTED"
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {ex.status}
                          </span>
                        </td>
                        <td className="py-2 text-right whitespace-nowrap">
                          {ex.status === "PENDING" && (
                            <div className="inline-flex gap-1">
                              <button
                                type="button"
                                onClick={() => handleReviewException(ex.id, "APPROVED")}
                                className="rounded bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                              >
                                Duyệt
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReviewException(ex.id, "REJECTED")}
                                className="rounded bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-700"
                              >
                                Từ chối
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      )}

      {activeTab === "summary" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900">
            Tổng hợp Ngày công theo Nhân viên
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Dữ liệu ngày công thực tế được dùng tự động khi tính Bảng lương Đợt 2 cuối tháng.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[500px] text-left text-xs">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Mã NV</th>
                  <th className="py-2 pr-3">Họ và tên</th>
                  <th className="py-2 pr-3">Số ngày có chấm công</th>
                  <th className="py-2">Tổng lượt quét</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.map((row) => (
                  <tr key={row.employee_id}>
                    <td className="py-2.5 pr-3 font-mono font-semibold text-slate-800">
                      {row.employee_code}
                    </td>
                    <td className="py-2.5 pr-3 font-medium text-slate-900">
                      {row.full_name}
                    </td>
                    <td className="py-2.5 pr-3 font-mono font-bold text-emerald-700">
                      {row.worked_days} ngày
                    </td>
                    <td className="py-2.5 font-mono text-slate-600">
                      {row.total_scans} lượt
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
