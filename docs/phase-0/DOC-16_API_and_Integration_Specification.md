# DOC-16: Đặc tả API & Kiến trúc Tích hợp (API & Integration Specification)

> **Trạng thái tài liệu:** `APPROVED_DESIGN_BASELINE`  
> **Tham chiếu gốc:** [HRM_Enterprise_Design_Baseline_v1.0.docx](../../HRM_Enterprise_Design_Baseline_v1.0.docx) — Mục 9; [DOC-14](./DOC-14_System_Architecture_and_Tech_Stack.md); [DOC-15](./DOC-15_Database_ERD_and_Schema_Design.md); [DOC-17](./DOC-17_Security_and_RBAC_Matrix.md)  
> **Runtime mục tiêu:** Next.js Route Handlers trên **Vercel** + PostgreSQL/Auth/Storage trên **Supabase (`xtswzywqbizunynahmvl`)**

---

## 1. Quy ước API Chung & Kiểm soát Bảo mật (API Standards)

1. **Base Path & Versioning:** Toàn bộ API nội bộ dùng `/api/v1/*` (REST JSON, UTF-8).
2. **Middleware Pipeline bắt buộc trên mỗi Request:**
   ```text
   Request → TLS (Vercel) → Auth Verify (Supabase JWT + MFA Check cho 5 role đặc quyền)
           → RBAC + Data Scope Resolver (DOC-17) → Separation of Duties (SoD) Guard
           → Zod Schema Validation → Business Service Layer → Audit / Access / Export Log
   ```
3. **Chuẩn Response & Mã lỗi thống nhất:**
   * Thành công: `{ "data": ..., "meta": { "page": 1, "limit": 20, "total": 120, "requestId": "req_..." } }`
   * Lỗi nghiệp vụ / phân quyền:
     * `401 UNAUTHENTICATED`: Thiếu hoặc hết hạn session / chưa xác thực MFA (`MFA_REQUIRED`).
     * `403 FORBIDDEN`: Không đủ Role Permission hoặc vi phạm Data Scope / SoD (`SELF_APPROVAL_FORBIDDEN`).
     * `409 CONFLICT`: Vi phạm chuyển trạng thái hợp lệ (VD: sửa bảng công hoặc bảng lương đã `LOCKED`), trùng `idempotency_key`, hoặc vi phạm `legal_holds` (`LEGAL_HOLD_ACTIVE`).
     * `422 UNPROCESSABLE_ENTITY`: Lỗi dữ liệu đầu vào (VD: vượt trần OT `40h/tháng` hoặc `200h/năm` khi chưa có cấu hình ngoại lệ).
4. **Quy tắc Bất biến & Idempotency:**
   * Các endpoint nhận sự kiện chấm công (`Face ID`, `GPS`) và chạy bảng lương bắt buộc nhận header hoặc trường `Idempotency-Key` để đảm bảo retry mạng không tạo bản ghi trùng.
   * File tài liệu (HĐLĐ, CCCD, Payslip PDF) **không trả public URL**; server trả về **Signed URL tạm thời (60–300s)** qua Supabase Storage sau khi kiểm tra quyền và ghi `access_logs`.

---

## 2. Danh mục Endpoint theo 18 Phân hệ (API Catalog)

| Nhóm | Endpoint chính | Method | Role được phép | Kiểm soát đặc thù |
| :--- | :--- | :---: | :--- | :--- |
| **Auth & Session** | `/api/v1/auth/me`, `/api/v1/auth/mfa/verify`, `/api/v1/auth/sessions/revoke` | `GET`, `POST` | Authenticated | Bắt buộc MFA cho `SUPER_ADMIN`, `HR_ADMIN`, `ACCOUNTANT`, `DIRECTOR`, `AUDITOR` |
| **Privacy (PDPL 91/2025)** | `/api/v1/privacy/consents`<br>`/api/v1/privacy/data-requests`<br>`/api/v1/privacy/legal-holds` | `GET`, `POST`, `PATCH` | `EMPLOYEE` (Self), `HR_ADMIN` | Ghi `consent_records` trước khi bật GPS/Face ID; chặn xóa cứng khi có `legal_holds` |
| **Organization** | `/api/v1/org/tree`, `/api/v1/org/locations`, `/api/v1/org/cost-centers`, `/api/v1/org/departments` | `GET`, `POST`, `PATCH` | `HR_ADMIN`, `DIRECTOR`, `ACCOUNTANT` (Cost Center) | Không hard-delete phòng ban/location đã phát sinh dữ liệu lịch sử |
| **Employee & PII** | `/api/v1/employees`<br>`/api/v1/employees/:id`<br>`/api/v1/employees/:id/unmask-pii`<br>`/api/v1/employees/import` | `GET`, `POST`, `PATCH` | `HR_ADMIN`, `HR_STAFF`, `DEPT_MANAGER` (Dept), `ACCOUNTANT` (Hạn chế) | Mặc định **mask** `CCCD`, `STK`, `MST`; gọi `/unmask-pii` bắt buộc nhập lý do & ghi `access_logs` |
| **Recruitment & Lifecycle** | `/api/v1/recruitment/requisitions`, `/applications`, `/offers/:id/approve`, `/onboarding/checklists` | `GET`, `POST`, `PATCH` | `HR_ADMIN`, `DEPT_MANAGER`, `DIRECTOR` | Chặn tự duyệt offer; chuyển `ACCEPTED` offer sang tạo hồ sơ `employees` |
| **Contracts & Movements** | `/api/v1/contracts`, `/api/v1/contracts/:id/amendments`, `/api/v1/movements` | `GET`, `POST`, `PATCH` | `HR_ADMIN`, `DIRECTOR` | Kiểm tra khoảng hiệu lực không chồng lấn; tự động kích hoạt `legal_holds` |
| **Shifts & Calendars** | `/api/v1/shifts/templates`, `/api/v1/shifts/assignments`, `/api/v1/shifts/swap-requests`, `/api/v1/calendars` | `GET`, `POST`, `PATCH` | `HR_ADMIN`, `DEPT_MANAGER` (Bãi xe/Kho/CHMT), `EMPLOYEE` | Hỗ trợ ca đêm `22:00–06:00`, ca qua ngày, và `early_handover_minutes` (`Bảo vệ` 30', `Bãi xe` 15') |
| **Attendance (GPS & Face ID)** | `/api/v1/attendance/gps-checkin`<br>`/api/v1/attendance/exceptions`<br>`/api/v1/attendance/summaries/lock`<br>`/api/v1/integrations/attendance/face-id-events` | `POST`, `GET`, `PATCH` | `EMPLOYEE` (GPS), `DEPT_MANAGER`, `HR_ADMIN`, **Sync Agent** (HMAC) | Kiểm tra `consent_record` GPS; tính Haversine Geofence; khóa bảng công tại ngày `25` |
| **Leave & Overtime** | `/api/v1/leave/balances`, `/api/v1/leave/requests`, `/api/v1/leave/requests/:id/decision`<br>`/api/v1/overtime/requests`, `/api/v1/overtime/requests/:id/consent` | `GET`, `POST` | `EMPLOYEE`, `DEPT_MANAGER`, `HR_ADMIN`, `DIRECTOR` | SoD chặn tự duyệt; kiểm tra số dư phép (phép tồn hết hạn `31/03`); kiểm tra trần OT `40h/tháng`, `200h/năm` |
| **Allowances (3 Tầng)** | `/api/v1/payroll/salary-components`<br>`/api/v1/payroll/department-allowances`<br>`/api/v1/payroll/employee-overrides`<br>`/api/v1/payroll/period-variables` | `GET`, `POST`, `PUT` | `HR_ADMIN`, `ACCOUNTANT` | Phân giải thứ tự ưu tiên Tầng 3 → Tầng 2 → Tầng 1; giữ rule miễn thuế ăn ca tiền mặt `1.200.000 đ` |
| **Payroll & Payslips** | `/api/v1/payroll/runs` (`runType`: `MID_MONTH_ADVANCE` \| `END_MONTH_SETTLEMENT` \| `ADJUSTMENT`)<br>`/api/v1/payroll/runs/:id/calculate`<br>`/api/v1/payroll/runs/:id/review` (`ACCOUNTANT`)<br>`/api/v1/payroll/runs/:id/approve` (`DIRECTOR`)<br>`/api/v1/payroll/runs/:id/lock`<br>`/api/v1/payroll/runs/:id/export-bank`<br>`/api/v1/payslips/my` | `POST`, `GET` | `HR_ADMIN` (Lập/Khóa), `ACCOUNTANT` (Kế toán trưởng duyệt), `DIRECTOR` (Chốt), `EMPLOYEE` (Self) | Ngày `15` chạy `MID_MONTH_ADVANCE` (50% lương CB, chưa phụ cấp); cuối tháng chạy `END_MONTH_SETTLEMENT` (sau chốt công ngày `25`); **bắt buộc `ACCOUNTANT` ký duyệt trước `DIRECTOR` chốt** |
| **Tax & Insurance** | `/api/v1/compliance/tax-rules`, `/api/v1/compliance/dependents`, `/api/v1/compliance/insurance-movements` | `GET`, `POST`, `PATCH` | `HR_ADMIN`, `ACCOUNTANT` | Lưu snapshot rule theo ngày hiệu lực (`VN-2026-H2`: Vùng III `4.140.000đ`, BHXH ref `2.530.000đ`) |
| **Workflow & Delegation** | `/api/v1/workflows/tasks/my`, `/api/v1/workflows/tasks/:id/action`, `/api/v1/workflows/delegations` | `GET`, `POST` | Mọi role | Hỗ trợ ủy quyền có thời hạn (`Giám đốc` → `Phó Giám đốc`; `CH trưởng` → `Thu ngân`) |
| **Audit & Reports** | `/api/v1/audit/events`, `/api/v1/audit/access-logs`, `/api/v1/audit/export-logs` | `GET` | `AUDITOR`, `HR_ADMIN` (giới hạn), `SUPER_ADMIN` (tech log) | Bất biến, chỉ đọc (`append-only`), không có API xóa |

---

## 3. Đặc tả Chi tiết các Payload Trọng yếu

### 3.1. Chấm công GPS Geofencing (`POST /api/v1/attendance/gps-checkin`)
**Request Payload:**
```json
{
  "direction": "IN",
  "latitude": 11.0789123,
  "longitude": 106.1784567,
  "accuracyMeters": 18.5,
  "workMode": "ONSITE",
  "note": "Vào ca 1 tại Bãi xe Điểm tập kết",
  "clientCapturedAt": "2026-11-12T05:44:10+07:00"
}
```
**Logic xử lý tại Vercel Server API:**
1. Kiểm tra user có bản ghi `consent_records` hiệu lực với `purpose_code = 'ATTENDANCE_GPS'`. Nếu chưa → trả `403 CONSENT_REQUIRED`.
2. Lấy `location` được phân công của nhân viên (hoặc cho phép chọn trong danh sách 4 điểm làm việc nếu làm luân chuyển) → tính khoảng cách Haversine (`distanceMeters`).
3. Lưu bản ghi bất biến vào `attendance_raw_events` (`verify_mode = 'GPS_GEOFENCE'`, `is_within_geofence = distanceMeters <= geofenceRadiusM`).
4. Nếu `is_within_geofence == false` hoặc `accuracyMeters > 100` (mà không phải `workMode = 'REMOTE_DUTY'` của Lái xe): tự động tạo `attendance_exceptions` (`OUT_OF_GEOFENCE`) gửi thông báo cho Quản lý trực tiếp duyệt.

### 3.2. Webhook Đồng bộ Máy chấm công Face ID (`POST /api/v1/integrations/attendance/face-id-events`)
**Headers bắt buộc:**
* `X-Device-Code`: `FACEID-BAIXE-01`
* `X-Timestamp`: `1794452400` (chống replay attack nếu lệch quá `±300s`)
* `X-Signature-HMAC`: `hmac_sha256(secret, timestamp + "." + rawBody)`

**Request Payload (Batch từ Local Sync Agent của Phòng IT):**
```json
{
  "batchId": "batch_20261112_060000",
  "events": [
    {
      "idempotencyKey": "FACEID-BAIXE-01:EMP042:2026-11-12T05:45:02+07:00",
      "deviceUserId": "EMP042",
      "eventTime": "2026-11-12T05:45:02+07:00",
      "verifyMode": "FACE_ID",
      "direction": "UNKNOWN"
    }
  ]
}
```
**Nguyên tắc bảo mật & chống lỗi:**
* Không chứa ảnh khuôn mặt hay biometric vector trong payload.
* Server dùng `ON CONFLICT (idempotency_key) DO NOTHING` để đảm bảo an toàn khi Agent gửi lại.
* Nếu `deviceUserId` chưa ánh xạ với `employees` → lưu vào `integration_jobs` trạng thái `UNMAPPED_USER` để Phòng IT/HC-NS xử lý, không làm rơi dữ liệu chấm công.

### 3.3. Quy trình Phê duyệt Bảng lương & Xuất Ngân hàng (State Machine)
```text
DRAFT ──(calculate)──► CALCULATED ──(HC-NS submit)──► PENDING_ACCOUNTANT_REVIEW
   ──(Kế toán trưởng ký duyệt)──► PENDING_DIRECTOR_APPROVAL
   ──(Giám đốc / PGĐ ủy quyền duyệt)──► APPROVED ──(Lock kỳ)──► LOCKED ──► PAID
```
* **Ràng buộc SoD:** `created_by != accountant_reviewed_by` và mọi thao tác sau khi `LOCKED` trả `409 PAYROLL_PERIOD_LOCKED`; muốn điều chỉnh phải tạo `RUN_TYPE = 'ADJUSTMENT'` gắn `original_payroll_run_id`.

---

## 4. Kiến trúc Integration Adapters (Tách biệt nhà cung cấp)

Hệ thống sử dụng **Adapter Interface Pattern** trong `src/modules/integrations/adapters/` để thay nhà cung cấp mà không sửa nghiệp vụ lõi:

| Adapter Interface | Phase 1–3 Implementation | Phase 4+ Implementation | Fallback khi mất kết nối |
| :--- | :--- | :--- | :--- |
| **`TimeclockAdapter`** | `FaceIdSyncAgentAdapter` (LAN Agent đẩy REST webhook) + `ExcelImportAdapter` | Direct Cloud SDK / Push Protocol tùy dòng máy Face ID | Nhập tay/Import file Excel từ USB máy chấm công |
| **`NotificationAdapter`** | `EmailAdapter` (SMTP/Resend) + `InAppNotificationAdapter` | `ZaloOaZnsAdapter` (duyệt đơn, nhắc chốt công ngày `25`, thông báo payslip) | Ghi `integration_jobs` & retry theo exponential backoff (`3 lần`) |
| **`BankExportAdapter`** | `NeutralCsvXlsxBankAdapter` (đủ cột STK, Chủ TK, Số tiền, Nội dung, Chi nhánh) | Template đặc thù từng ngân hàng (VCB, BIDV, ACB, Techcombank...) | Kế toán xuất `XLSX` chuẩn đối soát nội bộ |
| **`AccountingExportAdapter`** | `NeutralJournalCsvXlsxAdapter` (map theo `cost_centers`: Bãi xe, CHMT, Kho, VP...) | Adapter format MISA / Fast / Bravo | Xuất file tổng hợp hạch toán chi phí theo Cost Center |

