# 05 — ĐẶC TẢ TÍCH HỢP MÁY CHẤM CÔNG & IMPORT CSV (PHASE 1)

## 1. Các kênh tích hợp
- **Webhook HTTPS + HMAC:** `POST /api/v1/integrations/attendance/face-id-events` (dùng cho Sync Agent mạng nội bộ của ZKTeco/Hikvision).
- **Quản lý thiết bị & Ping:** `POST /api/v1/attendance/device-sync`.
- **Import hàng loạt Excel/CSV:** `POST /api/v1/attendance/import`.

## 2. Cơ chế Import CSV An toàn
- Kiểm tra mã nhân viên (`employee_code`) tồn tại trong `employees`.
- Kiểm tra định dạng thời gian (`YYYY-MM-DD HH:mm:ss` hoặc ISO-8601).
- Chống trùng bằng `idempotency_key = IMPORT:{employeeId}:{isoTime}:{direction}` cả trong file và đối chiếu DB.
- Trả về `importedCount`, `duplicateCount`, `errorCount`, `errors[]`; cho phép tải về file `loi_import_cham_cong.csv` để sửa và import lại không nhân đôi bản ghi hợp lệ.

