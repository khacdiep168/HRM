# 14 — Đặc tả API Chấm công & Tiền lương (API Specification)

| Endpoint | Method | Quyền yêu cầu | Mô tả |
| :--- | :--- | :--- | :--- |
| `/api/v1/attendance/import` | `POST` | `ATTENDANCE:CREATE` | Import hàng loạt CSV/Excel, phát hiện trùng/lỗi, trả danh sách lỗi tải về |
| `/api/v1/attendance/normalize` | `POST` | `ATTENDANCE:UPDATE` | Ghép cặp Check-in/Check-out thành `attendance_sessions` |
| `/api/v1/attendance/shifts` | `GET`, `POST` | `SHIFTS:READ/CREATE` | Quản lý mẫu ca, phân ca hàng loạt & lịch ngày lễ |
| `/api/v1/attendance/exceptions` | `GET`, `POST`, `PATCH` | `ATTENDANCE:READ/CREATE/APPROVE` | Giải trình ngoại lệ chấm công, duyệt quản lý & xác nhận HR |
| `/api/v1/attendance/aggregate` | `POST` | `ATTENDANCE:UPDATE` | Tổng hợp công tháng vào `attendance_summaries` |
| `/api/v1/payroll/periods` | `GET`, `POST` | `PAYROLL:READ/UPDATE` | Quản lý kỳ lương & cập nhật mức lương hợp đồng / BHXH |
| `/api/v1/payroll/runs` | `GET`, `POST` | `PAYROLL:READ/CREATE` | Chạy lương toàn công ty hoặc từng nhân viên, hỗ trợ `isSimulation`, `NET` solver, OT Pay |
| `/api/v1/payroll/runs/[id]/transition` | `POST` | `PAYROLL:UPDATE/APPROVE/LOCK` | Chuyển trạng thái đa cấp (`SUBMIT_ACCOUNTANT`, `ACCOUNTANT_REVIEW`, `DIRECTOR_APPROVE`, `LOCK`, `MARK_PAID`) |
| `/api/v1/payroll/runs/[id]/export` | `GET` | `PAYROLL:EXPORT` | Xuất `bank_csv`, `accounting_csv`, `ot_variance_csv` kèm SHA-256 & `export_logs` |

