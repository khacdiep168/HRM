# 07 — ĐỐI SOÁT CÔNG & PHÊ DUYỆT NGOẠI LỆ (PHASE 2)

- **Bảng DB:** `attendance_exceptions`, `attendance_sessions`, `audit_events`.
- **API:** `GET/POST /api/v1/attendance/exceptions`.
- **Quy trình:**
  1. Nhân viên (hoặc HR) gửi giải trình ngoại lệ (`MISSING_IN`, `MISSING_OUT`, `OUT_OF_GEOFENCE`, `OUT_OF_SHIFT`) kèm giờ vào/ra đề xuất.
  2. Quản lý trực tiếp / HR xem xét (`REVIEW_EXCEPTION`: `APPROVED` / `REJECTED`).
  3. Hệ thống kiểm tra kỳ lương chứa `work_date`: nếu kỳ đã `LOCKED` hoặc `PAID`, chặn sửa công trực tiếp (`409 ATTENDANCE_PERIOD_LOCKED`).
  4. Khi duyệt, hệ thống lưu snapshot `before_data` và `after_data` vào `audit_events`, cập nhật `attendance_sessions` sang trạng thái `APPROVED`.

