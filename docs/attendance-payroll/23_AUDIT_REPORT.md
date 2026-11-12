# 23 — BÁO CÁO AUDIT HIỆN TRẠNG (PHASE 0 AUDIT REPORT)

**Ngày đánh giá:** `2026-11-12`  
**Phạm vi:** Module Chấm công – Ca làm việc – Tổng hợp công – Tính lương tự động – Phê duyệt – Bảo mật.

---

## 1. Những gì ĐÃ CÓ và TÁI SỬ DỤNG ĐƯỢC

| Thành phần | Hiện trạng thực tế trong Source Code & DB | Đánh giá tái sử dụng |
| :--- | :--- | :--- |
| **Database Schema (`0001`–`0010`)** | Đã có `shift_templates`, `work_calendars`, `shift_assignments`, `attendance_devices`, `device_user_mappings`, `attendance_raw_events` (có trigger bất biến `trg_att_raw_events_immutable`), `attendance_sessions`, `attendance_exceptions`, `attendance_summaries`, `salary_components`, `department_allowance_policies`, `employee_allowance_overrides`, `payroll_period_variables`, `payroll_periods`, `payroll_runs`, `payroll_results`, `payroll_items`, `legal_rule_versions`, `audit_events`, `consent_records`. | **Rất tốt** — Tái sử dụng 90% bảng hiện có, không cần đập đi xây lại. |
| **GPS & Face ID Ingestion** | Đã có `/api/v1/attendance/gps-checkin`, `/api/v1/attendance/device-sync`, `/api/v1/integrations/attendance/face-id-events` (HMAC + idempotency key + geofence distance). | **Tốt** — Giữ nguyên lớp tiếp nhận, bổ sung thêm CSV import máy chấm công & lỗi chi tiết. |
| **Tổng hợp công cơ bản** | Đã có `/api/v1/attendance/aggregate` gom `attendance_raw_events` + `leave_requests` + `overtime_requests` vào `attendance_summaries`. | **Tốt** — Cần nâng cấp ghép cặp `attendance_sessions` (vào/ra, ca đêm, đi trễ/về sớm). |
| **Payroll Engine (`decimal-engine.ts`)** | Đã có `Decimal.js` deterministic engine tính Gross, BHXH 8%/1.5%/1%, ER 21.5%, Đoàn phí CĐ 1% (trần 253.000đ), KPCĐ DN 2%, PIT 5 bậc, giảm trừ 15.5M / 6.2M, ứng đợt 15. | **Tốt** — Cần tách rule đọc từ `legal_rule_versions` DB, bổ sung Net-to-Gross, OT pay, công thức theo giờ/ca/sản phẩm. |
| **Phụ cấp 3 tầng (`allowance-resolver.ts`)** | Đã có giải quyết 3 tầng + miễn thuế tiền ăn 1.200.000đ + công cụ tự động T13/T14/Thâm niên + Import CSV & Bulk Rule. | **Hoàn chỉnh** cho Tầng 1–3. |
| **Luồng phê duyệt SoD & Export** | Đã có `/api/v1/payroll/runs/[id]/transition` (`CALCULATED -> PENDING_ACCOUNTANT_REVIEW -> PENDING_DIRECTOR_APPROVAL -> APPROVED -> LOCKED -> PAID`) và export CSV ngân hàng/Cost Center/Chi tiết. | **Tốt** — Cần bổ sung trạng thái chốt công (`ATTENDANCE_PENDING/CONFIRMED`), chạy thử (`Simulation`), tính lại lưu version. |
| **Kiểm thử hiện có (`vitest run`)** | 4 file test, **25/25 test cases `PASS`**. | Duy trì & mở rộng thêm cho các case còn thiếu ở mục 14. |

---

## 2. Những gì CÒN THIẾU / CHƯA ĐẠT chuẩn Master Prompt

1. **Chuẩn hóa & Ghép cặp sự kiện chấm công (`attendance_sessions`)**:
   - Chưa có thuật toán ghép cặp Check-in / Check-out tự động từ `attendance_raw_events` sang `attendance_sessions` (xử lý ca qua đêm, thiếu Check-in/Check-out, quét trùng trong X phút, đi trễ/về sớm).
2. **Import dữ liệu máy chấm công Excel/CSV có báo cáo lỗi chi tiết**:
   - Chưa có API import log chấm công hàng loạt kèm kiểm tra nhân viên không tồn tại, trùng lặp, tải file lỗi và import lại không nhân đôi.
3. **Quản lý Ca làm việc & Lịch phân ca (`shift_templates`, `shift_assignments`, `work_calendars`)**:
   - Đã có bảng DB trong `0004` nhưng chưa có API CRUD và màn hình UI quản lý ca, phân ca theo phòng ban/nhân viên, lịch ngày lễ, đổi ca có duyệt.
4. **Quy trình Ngoại lệ & Phê duyệt Công (`attendance_exceptions`)**:
   - Chưa có luồng nhân viên gửi giải trình quên chấm công / GPS ngoài vùng → Quản lý trực tiếp duyệt → HR kiểm tra → cập nhật công có lưu giá trị trước/sau.
5. **Tách quy tắc pháp lý khỏi source code (`legal_rule_versions`)**:
   - `decimal-engine.ts` đang khai báo hằng số `VN_2026_H2_RULES` trong code; cần nạp và đọc từ bảng `legal_rule_versions` theo ngày hiệu lực của kỳ lương.
6. **Hỗ trợ đa hình thức lương & Net-to-Gross**:
   - Hiện mới hỗ trợ lương Gross theo tháng/ngày công; chưa có **Net-to-Gross solver**, lương giờ, lương ca, lương sản phẩm, và tính **tiền OT** tự động từ `attendance_summaries.ot_hours_*` vào bảng lương.
7. **Quy trình Kỳ lương đầy đủ & Chạy thử (`Simulation`)**:
   - Chưa chặn tính lương chính thức khi còn `attendance_exceptions` chưa xử lý; chưa có chế độ chạy thử (`Simulation`) và so sánh chênh lệch giữa 2 phiên bản tính lại.
8. **Xuất PDF Phiếu lương cá nhân & Báo cáo kế toán/chênh lệch kỳ**:
   - Hiện mới có `window.print()` và CSV; chưa có xuất báo cáo chênh lệch giữa các kỳ, báo cáo OT/phụ cấp riêng.
9. **Tài liệu chuẩn hóa**:
   - Thư mục `docs/attendance-payroll/` (24 tài liệu) chưa được khởi tạo trước Phase 0.

