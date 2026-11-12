/**
 * Vietnamese standard formatting helpers:
 * - Date: dd/MM/yyyy
 * - DateTime: dd/MM/yyyy HH:mm
 * - Currency: 1.234.567 ₫
 */
export function formatDateVi(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) {
    const match = typeof value === "string" ? value.match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
    return String(value);
  }
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatDateTimeVi(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${formatDateVi(d)} ${hh}:${mm}`;
}

export function formatCurrencyVi(amount: number | string | null | undefined): string {
  const num = Number(amount ?? 0);
  if (!Number.isFinite(num)) return "0 ₫";
  return `${Math.round(num).toLocaleString("vi-VN")} ₫`;
}

const ENUM_LABELS_VI: Record<string, string> = {
  DRAFT: "Nháp (Chạy thử)",
  CALCULATED: "Đã tính lương",
  PENDING_ACCOUNTANT_REVIEW: "Chờ Kế toán kiểm tra",
  PENDING_DIRECTOR_APPROVAL: "Chờ Giám đốc duyệt",
  APPROVED: "Đã duyệt",
  LOCKED: "Đã khóa kỳ",
  PAID: "Đã chi trả",
  PENDING: "Chờ duyệt",
  MANAGER_APPROVED: "Quản lý đã duyệt",
  HR_CONFIRMED: "HR đã xác nhận",
  REJECTED: "Từ chối",
  ACTIVE: "Đang làm việc",
  PROBATION: "Thử việc",
  ONBOARDING: "Nhận việc",
  ON_LEAVE: "Nghỉ dài hạn",
  TERMINATED: "Đã nghỉ việc",
  WEEKDAY: "Ngày thường",
  WEEKEND: "Cuối tuần",
  HOLIDAY: "Ngày lễ",
  MID_MONTH_ADVANCE: "Tạm ứng Đợt 1 (Ngày 15)",
  END_MONTH_SETTLEMENT: "Quyết toán Đợt 2 (Cuối tháng)",
  HR_EMPLOYMENT: "Hồ sơ & Hợp đồng lao động",
  PAYROLL_TAX_SI: "Tiền lương, Thuế TNCN & BHXH",
  ATTENDANCE_GPS: "Chấm công & Vị trí GPS",
  HEALTH_SAFETY: "Sức khỏe & An toàn lao động",
};

export function translateEnumVi(code: string | null | undefined): string {
  if (!code) return "—";
  return ENUM_LABELS_VI[code] ?? code;
}

