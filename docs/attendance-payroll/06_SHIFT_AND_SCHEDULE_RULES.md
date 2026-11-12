# 06 — QUY TẮC CA LÀM VIỆC & LỊCH PHÂN CA (PHASE 2)

- **Bảng DB:** `shift_templates`, `shift_assignments`, `work_calendars` (tái sử dụng từ `0004`).
- **API:** `GET/POST /api/v1/attendance/shifts`.
- **Tính năng:**
  - Cấu hình ca hành chính, ca sáng, ca chiều, ca đêm qua ngày (`is_overnight = true`), thời gian nghỉ giữa ca (`break_minutes`), thời gian giao ca sớm (`early_handover_minutes`), số giờ tiêu chuẩn (`standard_work_hours`).
  - Phân ca hàng loạt (`ASSIGN_SHIFT_BULK`) cho Toàn công ty, Bộ phận hoặc Cá nhân theo khoảng ngày (tùy chọn bỏ qua cuối tuần).
  - Cấu hình lịch nghỉ lễ (`work_calendars`) phục vụ tính công lễ & hệ số OT 300%.

