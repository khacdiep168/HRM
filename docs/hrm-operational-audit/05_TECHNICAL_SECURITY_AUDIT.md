# ĐÁNH GIÁ KỸ THUẬT, BẢO MẬT & KIẾN TRÚC HỆ THỐNG
## CÔNG TY TNHH THƯƠNG MẠI THẾ KỶ VÀNG (TKV)
**Tài liệu:** `05_TECHNICAL_SECURITY_AUDIT.md`  
**Chủ trì thẩm định:** Kiến trúc sư Phần mềm (Chief Architect) & Chuyên gia Bảo mật Thông tin  
**Phạm vi:** Kiểm toán Mã nguồn Next.js 16, Cơ sở dữ liệu Supabase PostgreSQL, Cơ chế RBAC, Mã hóa PII và Hiệu năng  
**Thời điểm đánh giá:** 16/11/2026  

---

## 1. TỔNG QUAN KIẾN TRÚC KỸ THUẬT (SYSTEM ARCHITECTURE)

Hệ thống HRM Thế Kỷ Vàng được xây dựng trên nền tảng công nghệ hiện đại, đáp ứng các tiêu chuẩn khắt khe về hiệu năng và bảo mật doanh nghiệp:

```
[ FRONTEND & BFF ]
Next.js 16 (App Router, Turbopack, React 19, Tailwind CSS)
   │
   ├── Client Components (StateViews, Modals, Forms)
   └── Server Route Handlers (/api/v1/* — RBAC Enforcement)
         │
[ SECURITY GATEWAY ]
resolveAuthContext() ──> Xác thực Supabase Auth Session (Cookie SSR)
assertAuthorized()   ──> Thẩm tra 8 Quyền RBAC (User Roles)
assertNotSelfApproval() ──> Chống gian lận tự duyệt (SoD)
         │
[ DATABASE LAYER (PostgreSQL 15 / Supabase Cloud) ]
Row Level Security (RLS) ──> Cách ly dữ liệu nhiều tầng
AES-256-GCM Engine       ──> Mã hóa PII (CCCD, SĐT, Tài khoản)
Blind Index HMAC-SHA256  ──> Tìm kiếm dữ liệu mã hóa tốc độ cao
PostgreSQL Triggers      ──> Bảo đảm dữ liệu bất biến (Immutable Data)
```

---

## 2. KIỂM TOÁN PHÂN QUYỀN RBAC & CÁC LỖ HỔNG LỘ LỌT DỮ LIỆU

Ban kiểm toán đã thực hiện kiểm thử tự động xuyên suốt 4 vai trò đại diện trên môi trường Production:
- `DIRECTOR` (`demo.director@thekyvang.vn`)
- `HR_PAYROLL` (`demo.payroll@thekyvang.vn`)
- `DEPARTMENT_MANAGER` (`demo.manager@thekyvang.vn`)
- `EMPLOYEE` (`demo.employee@thekyvang.vn`)

### Kết quả thẩm tra chi tiết:

| API Endpoint | Vai trò EMPLOYEE | Vai trò MANAGER | Vai trò HR / DIRECTOR | Đánh giá & Rủi ro phát hiện |
|:---|:---:|:---:|:---:|:---|
| `/api/v1/employees` | **200 (1 NV)** | **200 (1 NV)** | **200 (50 NV)** | **RẤT TỐT (PASS):** Nhân viên thường và Trưởng phòng chỉ thấy hồ sơ cá nhân. |
| `/api/v1/contracts` | **200 (1 HĐ)** | **200 (1 HĐ)** | **200 (12 HĐ)** | **RẤT TỐT (PASS):** Hợp đồng được lọc nghiêm ngặt theo cá nhân. |
| `/api/v1/approvals` | **403 Forbidden** | **200 (Duyệt PB)** | **200 (Duyệt Cty)** | **XUẤT SẮC (PASS):** Chặn đứng nhân viên thường truy cập trang duyệt. |
| `/api/v1/audit/logs` | **403 Forbidden** | **403 Forbidden** | **200 (Audit Log)** | **XUẤT SẮC (PASS):** Chỉ lãnh đạo và kiểm toán viên xem được log. |
| `/api/v1/attendance/matrix` | **200 (50 NV)** ⚠️ | **200 (50 NV)** | **200 (50 NV)** | **LỖ HỔNG (SEC-01):** Nhân viên thường đọc được bảng công toàn bộ 50 người kèm lý do nghỉ thai sản, công tác. |
| `/api/v1/payroll/runs` | **200 (Header Lộ)** ⚠️ | **403 Forbidden** | **200 (Full)** | **LỖ HỔNG (SEC-02):** Header của bảng lương để lộ tổng quỹ lương công ty (`total_gross_amount`) cho nhân viên thường. |

### Khắc phục khuyến nghị cho SEC-01 và SEC-02:
1. **Khắc phục `SEC-01` (`/api/v1/attendance/matrix`):**
   - Thêm điều kiện kiểm tra vai trò: Nếu người đăng nhập không thuộc danh sách `["HR_ADMIN", "DIRECTOR", "DEPARTMENT_MANAGER", "AUDITOR"]`, query `employees` chỉ lọc duy nhất `id = ctx.employeeId`.
2. **Khắc phục `SEC-02` (`/api/v1/payroll/runs`):**
   - Chặn hoàn toàn vai trò `EMPLOYEE` tại `/api/v1/payroll/runs` với mã lỗi `403 Forbidden`. Nhân viên thường xem lương bắt buộc phải qua cổng `/api/v1/payslips`.

---

## 3. KIỂM TOÁN MÃ HÓA PII & BẢO VỆ DỮ LIỆU CÁ NHÂN (PDPL 91/2025)

1. **Thuật toán mã hóa:**
   - Sử dụng thư viện Node.js `crypto` với thuật toán **AES-256-GCM** (chuẩn mã hóa đối xứng an toàn nhất hiện nay).
   - Khóa bí mật được quản lý qua biến môi trường `PII_ENCRYPTION_KEY` (32 bytes hex), không lưu trong code.
   - Vector khởi tạo ngẫu nhiên (IV 12 bytes) cho mỗi lần mã hóa, đảm bảo cùng một số CCCD mã hóa 2 lần sẽ ra 2 chuỗi cipher khác nhau.
2. **Cơ chế tìm kiếm mù (Blind Index):**
   - Tạo trường `bidx_national_id` và `bidx_phone` bằng mã băm **HMAC-SHA256** với khóa `PII_BLIND_INDEX_KEY`.
   - Giúp HR gõ số CCCD hoặc SĐT tìm kiếm tức thì mà backend không cần giải mã toàn bộ 50–300 dòng trong database.
3. **Quy trình giải mã có kiểm soát (Unmask PII):**
   - Tại giao diện, số CCCD được che dạng: `0720******89`.
   - Khi HR bấm nút "Mắt xem" (Unmask), hệ thống gọi API `/api/v1/employees/[id]/unmask-pii`, kiểm tra quyền và tự động ghi một bản ghi vào `audit_events` với hành động `EMPLOYEE_UNMASK_PII`.

---

## 4. TÍNH BẤT BIẾN & TOÀN VẸN DỮ LIỆU (DATA IMMUTABILITY)

Để phòng chống gian lận trong chấm công và làm sai lệch bảng lương, hệ thống kích hoạt trigger PostgreSQL mức database:

1. **Trigger trên bảng `attendance_raw_events`:**
   ```sql
   CREATE TRIGGER trg_att_raw_events_immutable
   BEFORE UPDATE OR DELETE ON public.attendance_raw_events
   FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_mutation();
   ```
   *Kết quả thẩm tra:* Dù có cố tình can thiệp bằng script thì sự kiện chấm công gốc từ máy chấm công hoặc GPS không bao giờ bị xóa hoặc chỉnh sửa.
2. **Trigger trên bảng `payroll_runs`:**
   - Khi bảng lương đã chuyển sang trạng thái `LOCKED` hoặc `PAID`, trigger chặn mọi thao tác sửa số tiền lương, số ngày công hoặc xóa bản ghi. Muốn điều chỉnh phải thực hiện quy trình mở khóa đặc biệt kèm lý do kiểm toán.

---

## 5. ĐÁNH GIÁ HIỆU NĂNG & KHẢ NĂNG MỞ RỘNG (SCALABILITY 100 - 300 NV)

1. **Thời gian phản hồi API (Latency Test trên Vercel Production):**
   - `/api/v1/dashboard`: `185ms` (Tốt)
   - `/api/v1/employees`: `210ms` cho 50 hồ sơ (Tốt)
   - `/api/v1/attendance/matrix`: `320ms` cho 50 nhân sự x 30 ngày (Khá)
   - `/api/v1/attendance/holidays`: `140ms` (Rất nhanh)
2. **Đánh giá tải khi mở rộng lên 300 nhân sự:**
   - **Bảng công Matrix:** Khi đạt quy mô 300 nhân viên, số lượng ô hiển thị là `300 NV * 31 ngày = 9,300 DOM nodes`. Nếu render toàn bộ trên một trang web mà không có ảo hóa (DOM Virtualization), các máy tính văn phòng cấu hình yếu có thể bị giật lag khi cuộn trang.
   - **Đề xuất kỹ thuật:** Bổ sung bộ lọc phân trang theo phòng ban (mỗi lần hiển thị 1 phòng ban khoảng 20–50 người) hoặc áp dụng thư viện `@tanstack/react-virtual` cho bảng Matrix.
