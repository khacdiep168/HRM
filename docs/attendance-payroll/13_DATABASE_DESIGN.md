# 13 — Thiết kế Cơ sở Dữ liệu Chấm công & Tiền lương (Database Design)

## 1. Phân hệ Chấm công & Ca làm việc
- `attendance_raw_events`: Dữ liệu thô bất biến từ GPS, vân tay, Face ID, thẻ từ, Excel/CSV (`employee_id`, `event_time`, `event_type`, `source`, `device_id`, `gps_lat`, `gps_lng`, `raw_payload`).
- `attendance_import_batches`: Lịch sử import hàng loạt, thống kê dòng thành công/lỗi.
- `attendance_sessions`: Phiên làm việc đã ghép cặp Check-in/Check-out, xử lý ca qua đêm và trạng thái bất thường (`MISSING_IN`, `MISSING_OUT`, `VALID`).
- `shift_templates` & `shift_assignments`: Cấu hình ca hành chính/sáng/chiều/đêm/xoay và phân ca theo nhân viên/phòng ban.
- `work_calendars`: Lịch nghỉ lễ, cuối tuần.
- `attendance_exceptions`: Quy trình giải trình ngoại lệ chấm công (`PENDING` -> `MANAGER_APPROVED` -> `HR_CONFIRMED` / `REJECTED`).
- `attendance_summaries`: Tổng hợp ngày công theo kỳ (`standard_days`, `actual_work_days`, `paid_leave_days`, `unpaid_leave_days`, `ot_hours_weekday`, `ot_hours_weekend`, `ot_hours_holiday`, `night_hours`).

## 2. Phân hệ Tiền lương, Pháp lý & Bảo mật
- `legal_rule_registry`: Quy tắc pháp lý phiên bản hóa (`rule_code`, `effective_from`, `effective_to`, `status`, `parameters`).
- `payroll_periods` & `payroll_runs`: Chu kỳ lương (`25` chốt công, `15` tạm ứng, cuối tháng quyết toán) và phiên bản đợt chạy kèm `legal_rule_snapshot`.
- `payroll_results` & `payroll_items`: Kết quả lương và từng dòng cấu thành (`BASE_SALARY`, phụ cấp 3 cấp, `OVERTIME_PAY`) kèm `explanation_json` (chứa `warnings`, `otPay`, `ruleVersion`).
- `payslips`: Phiếu lương bất biến phát hành khi `MARK_PAID`.
- `employee_bank_accounts`: Số tài khoản mã hóa AES-256-GCM (`account_no_enc`, `account_no_last4`).
- `audit_events` & `export_logs`: Nhật ký kiểm toán và mã băm SHA-256 file xuất.

