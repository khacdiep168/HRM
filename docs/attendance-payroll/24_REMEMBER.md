# 24 — REMEMBER (ATTENDANCE & PAYROLL MODULE)

- **Ngày khởi tạo Phase 0:** `2026-11-12`.
- **Trạng thái hiện tại:** Hoàn tất **Phase 0 Audit & Requirement Validation**. Chưa sửa database destructive, chưa thay đổi quy tắc chưa được duyệt.
- **Điểm cần nhớ cho Phase 1:**
  - `attendance_raw_events` có trigger `trg_att_raw_events_immutable` — tuyệt đối không `UPDATE`/`DELETE` bảng này; mọi điều chỉnh đi qua `attendance_sessions` / `attendance_exceptions`.
  - Tái sử dụng `shift_templates`, `work_calendars`, `shift_assignments`, `attendance_sessions`, `attendance_exceptions`, `attendance_summaries`, `legal_rule_versions` đã có sẵn từ migration `0004`.
  - Chờ Chủ dự án xác nhận `OBD-01` → `OBD-07` trong `20_OPEN_BUSINESS_DECISIONS.md` trước khi triển khai Phase 1–6.

