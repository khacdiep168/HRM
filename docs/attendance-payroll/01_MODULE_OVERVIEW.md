# 01 — TỔNG QUAN MODULE CHẤM CÔNG & TÍNH LƯƠNG TỰ ĐỘNG

## 1. Mục tiêu Nghiệp vụ
Xây dựng quy trình khép kín, có kiểm soát và truy vết cho doanh nghiệp 100–300+ nhân viên:

`Dữ liệu chấm công gốc (GPS / Face ID / Vân tay / Thẻ / Import CSV)` → `Chuẩn hóa & Ghép cặp Ca` → `Xử lý Ngoại lệ & Phê duyệt` → `Xác nhận Công Kỳ lương` → `Bộ máy Tính lương (Versioned Legal Rules)` → `Kiểm tra Sai lệch & Simulation` → `Phê duyệt SoD (HR → Kế toán trưởng → Giám đốc)` → `Khóa Kỳ lương` → `Xuất Bảng lương Chi tiết & Phiếu lương`.

## 2. Kiến trúc Phân hệ
- **Phân hệ A:** Tiếp nhận dữ liệu chấm công bất biến (`attendance_raw_events`), GPS Geofencing, Connector máy chấm công & Import CSV.
- **Phân hệ B:** Ca làm việc (`shift_templates`), Lịch phân ca (`shift_assignments`), Lịch nghỉ lễ (`work_calendars`).
- **Phân hệ C:** Chuẩn hóa phiên (`attendance_sessions`) & Tổng hợp công (`attendance_summaries`), tách biệt 5 chỉ số giờ/công.
- **Phân hệ D:** Ngoại lệ & Phê duyệt công (`attendance_exceptions`), lưu giá trị trước/sau.
- **Phân hệ E–G:** Payroll Engine độc lập (`decimal-engine.ts`), Bảng lương chi tiết, Phiếu lương cá nhân, Xuất Excel/PDF.
- **Phân hệ H–J:** RBAC, Phê duyệt SoD, Audit log, Mã hóa PII AES-256-GCM, RLS.

