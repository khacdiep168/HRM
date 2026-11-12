export const CONTRACT_TYPE_LABELS: Record<string, string> = {
  PROBATION: "Hợp đồng Thử việc",
  FIXED_TERM: "HĐLĐ Xác định thời hạn",
  INDEFINITE: "HĐLĐ Không xác định thời hạn",
  PART_TIME: "HĐLĐ Bán thời gian",
  SEASONAL: "Hợp đồng Thời vụ",
};

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Đang hiệu lực",
  EXPIRED: "Đã hết hạn",
  TERMINATED: "Đã chấm dứt",
  DRAFT: "Bản nháp",
};

export const EMPLOYMENT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Đang làm việc (Chính thức)",
  PROBATION: "Đang thử việc",
  ONBOARDING: "Đang nhận việc",
  ON_LEAVE: "Tạm nghỉ / Thai sản",
  TERMINATED: "Đã nghỉ việc",
};

export const GENDER_LABELS: Record<string, string> = {
  MALE: "Nam",
  FEMALE: "Nữ",
  OTHER: "Khác",
};

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
  CANCELLED: "Đã hủy",
};

export const PAYROLL_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Bản nháp",
  CALCULATED: "Đã tính lương",
  REVIEWED: "Kế toán trưởng đã soát",
  APPROVED: "Giám đốc đã duyệt",
  LOCKED: "Đã khóa sổ",
  PAID: "Đã chi trả",
};

export const PAYROLL_RUN_TYPE_LABELS: Record<string, string> = {
  MID_MONTH_ADVANCE: "Đợt 1 (Tạm ứng ngày 15)",
  END_MONTH_SETTLEMENT: "Đợt 2 (Quyết toán cuối tháng)",
};

export const RECRUITMENT_STAGE_LABELS: Record<string, string> = {
  APPLIED: "Mới ứng tuyển",
  SCREENING: "Sơ loại hồ sơ",
  INTERVIEW: "Phỏng vấn",
  OFFER: "Đề nghị nhận việc (Offer)",
  HIRED: "Đã tuyển dụng",
  REJECTED: "Không đạt",
};

export const DEVICE_STATUS_LABELS: Record<string, string> = {
  ONLINE: "Đang trực tuyến",
  OFFLINE: "Mất kết nối",
  MAINTENANCE: "Đang bảo trì",
};

export function labelOf(map: Record<string, string>, key?: string | null, fallback = "—"): string {
  if (!key) return fallback;
  return map[key] ?? key;
}

