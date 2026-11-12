# 04 — ĐẶC TẢ CHẤM CÔNG GPS (PHASE 1)

- **Endpoint:** `POST /api/v1/attendance/gps-checkin`.
- **Luồng xử lý:**
  1. Xác thực người dùng (`resolveAuthContext` + `assertAuthorized(ctx, "ATTENDANCE", "CREATE")`).
  2. Kiểm tra bản ghi đồng ý dữ liệu vị trí (`consent_records` — Luật `91/2025/QH15`).
  3. Tính khoảng cách Haversine (`geofence.ts`) so với tọa độ và `geofence_radius_m` của địa điểm được chọn (`locations`).
  4. Ghi nhận `event_time` theo đồng hồ server, `gps_lat`, `gps_lng`, `gps_accuracy_m`, `distance_m`, `is_within_geofence`, `work_mode` (`ONSITE` / `REMOTE_DUTY`).
  5. Nếu ngoài vùng (`!is_within_geofence`) ở chế độ `ONSITE`, vẫn lưu dữ liệu gốc và chuyển quy trình ngoại lệ/giải trình thay vì tự động hủy bỏ.

