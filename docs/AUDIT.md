# BÁO CÁO KHẢO SÁT HỆ THỐNG (STEP 0 AUDIT) — THẾ KỶ VÀNG HRM

> Ngày khảo sát: `2026-11-12` • Phạm vi: Khảo sát toàn bộ mã nguồn, database schema, RLS, API, biến môi trường và thực tế vận hành trên `hrmtkv.vercel.app` (chưa chỉnh sửa code).

---

## 1. KIỂM KÊ TÀI NGUYÊN HỆ THỐNG

### 1.1. Công nghệ & Thư viện (`package.json`)
- **Framework:** `next` `16.4.6` (App Router, Turbopack), `react` `19.3.0`, `react-dom` `19.3.0`, `typescript` `^5`.
- **Database & Auth:** `@supabase/supabase-js` `^2.50.0`, `@supabase/ssr` `^0.9.0`.
- **Tính toán & Validate:** `decimal.js` `^10.5.0`, `zod` `^3.25.0`.
- **UI:** `tailwindcss` `4.3.3`, `lucide-react` `^0.511.0`.
- **Testing & Lint:** `vitest` `^3.2.0` (`7` files, `37` unit tests đang pass), `eslint` `^9`, `eslint-config-next` `16.4.6`.
- **Thiếu cho lộ trình mới:** Chưa có thư viện đọc/ghi Excel (`.xlsx`) nếu hỗ trợ Excel gốc ngoài CSV, chưa có Playwright cho E2E test.

### 1.2. Biến môi trường (`process.env.*`)
1. `NEXT_PUBLIC_SUPABASE_URL` (client + server)
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client + server)
3. `SUPABASE_SERVICE_ROLE_KEY` (server-only — `src/lib/supabase/admin.ts`)
4. `PII_ENCRYPTION_KEY_BASE64` (AES-256-GCM mã hóa CCCD, STK, MST)
5. `PII_HMAC_KEY_BASE64` (blind index tìm kiếm PII)
6. `REQUIRE_MFA` (`"true"` bật kiểm tra AAL2 cho role đặc quyền)
7. `FACE_ID_WEBHOOK_SECRET` (HMAC xác thực webhook máy chấm công)

> **Lỗi thực tế trên Production (`hrmtkv.vercel.app/login`):** Ảnh chụp màn hình cho thấy trên Vercel chưa cấu hình `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_ANON_KEY`, khiến trang `/login` hiển thị cảnh báo dev local (`"Sao chép .env.example thành .env.local..."`) và không thể đăng nhập.

### 1.3. Routes giao diện (`17` trang `page.tsx`)
`/` • `/login` • `/org` • `/employees` • `/contracts` • `/recruitment` • `/attendance` • `/leave` • `/overtime` • `/allowances` • `/payroll` • `/bhxh-1-lan` • `/performance` • `/learning` • `/assets` • `/privacy` • `/audit`

### 1.4. API Routes (`29` endpoints `route.ts`)
- **Health & Auth:** `/api/health`, `/api/v1/auth/me`, `/api/v1/dashboard`
- **Nhân sự & Tổ chức:** `/api/v1/org/tree`, `/api/v1/employees`, `/api/v1/employees/bulk-import`, `/api/v1/employees/[id]/unmask-pii`, `/api/v1/contracts`
- **Chấm công:** `/api/v1/attendance/gps-checkin`, `/api/v1/attendance/import`, `/api/v1/attendance/normalize`, `/api/v1/attendance/shifts`, `/api/v1/attendance/exceptions`, `/api/v1/attendance/aggregate`, `/api/v1/attendance/device-sync`, `/api/v1/integrations/attendance/face-id-events`
- **Nghỉ phép & Tăng ca:** `/api/v1/leave/requests`, `/api/v1/overtime/requests`
- **Tiền lương:** `/api/v1/payroll/periods`, `/api/v1/payroll/allowances`, `/api/v1/payroll/runs`, `/api/v1/payroll/runs/[id]/transition`, `/api/v1/payroll/runs/[id]/export`
- **Khác & Tuân thủ:** `/api/v1/recruitment`, `/api/v1/performance`, `/api/v1/learning`, `/api/v1/assets`, `/api/v1/privacy/consents`, `/api/v1/audit/logs`

### 1.5. Database & RLS (`supabase/migrations/0001`–`0010`)
- **Tổng số bảng:** `63` bảng nghiệp vụ & hệ thống (tổ chức, nhân sự, PII, RBAC, hợp đồng, lương, chấm công, ca, phép, OT, tuyển dụng, đào tạo, tài sản, KPI, audit, PDPL).
- **RLS:** Đã bật `ENABLE ROW LEVEL SECURITY` trên toàn bộ bảng ở `0002`, `0005`, `0007`, `0009`, nhưng **mới chỉ có 14 `CREATE POLICY`** (chủ yếu `*_self_select` và đọc cơ bản). Hầu hết API đang dùng `getSupabaseAdminClient()` (`SERVICE_ROLE_KEY`) để bypass RLS và tự lọc ở tầng API.

---

## 2. ĐÁNH GIÁ 17 MODULE HIỆN TẠI

| # | Menu / Route | Trạng thái | Ghi chú chi tiết |
| :--- | :--- | :--- | :--- |
| 1 | Bảng điều khiển (`/`) | **Hoạt động một phần** | Có API `/api/v1/dashboard`, nhưng hiển thị số liệu toàn công ty cho mọi vai trò, chưa phân tách theo Nhân viên / Quản lý / Kế toán / Giám đốc. |
| 2 | Đăng nhập (`/login`) | **Hoạt động thật (lỗi cấu hình Vercel)** | Dùng Supabase Auth, nhưng trên `hrmtkv.vercel.app` thiếu env nên kẹt thông báo `.env.local`. |
| 3 | Sơ đồ Tổ chức (`/org`) | **Hoạt động thật** | Đọc `departments` & `locations` qua `/api/v1/org/tree`. |
| 4 | Hồ sơ Nhân sự (`/employees`) | **Hoạt động thật** | CRUD nhân viên, import CSV hàng loạt, mã hóa & unmask PII có audit. |
| 5 | Hợp đồng & STK (`/contracts`) | **Hoạt động thật** | Quản lý hợp đồng lao động và STK ngân hàng qua `/api/v1/contracts`. |
| 6 | Tuyển dụng & Offer (`/recruitment`) | **Hoạt động cơ bản (Nên ẩn flag)** | Có DB & API cơ bản, chưa cần thiết cho vận hành hằng ngày 20–200 nhân sự. |
| 7 | Chấm công GPS/Face (`/attendance`) | **Hoạt động thật (phức tạp cho NV)** | Có GPS check-in, import máy chấm công, normalize ca, phân ca, ngoại lệ, tổng hợp công; nhưng UI gộp quá nhiều tab kỹ thuật, chưa tối ưu mobile cho nhân viên. |
| 8 | Nghỉ phép (`/leave`) | **Hoạt động thật** | Gửi đơn & duyệt phép qua `/api/v1/leave/requests`; thiếu màn hình duyệt gộp cho Quản lý. |
| 9 | Tăng ca (`/overtime`) | **Hoạt động thật** | Đăng ký & duyệt OT qua `/api/v1/overtime/requests`; thiếu duyệt hàng loạt. |
| 10 | Phụ cấp & Thưởng (`/allowances`) | **Hoạt động thật** | Cấu hình 3 cấp phụ cấp qua `/api/v1/payroll/allowances`. |
| 11 | Bảng lương & Thuế (`/payroll`) | **Hoạt động thật** | Chạy lương 2 đợt, Simulation, Net-to-Gross, OT Pay, duyệt 2 cấp, xuất CSV ngân hàng/Cost Center/OT, in phiếu lương; nhưng quy trình 5 bước chưa tách wizard rõ ràng và thiếu mở khóa có lý do. |
| 12 | Tính BHXH 1 lần (`/bhxh-1-lan`) | **Chỉ có UI (Calculator)** | Tính toán thuần client-side, không lưu DB/API; nên đưa vào feature flag. |
| 13 | Đánh giá KPI (`/performance`) | **Hoạt động cơ bản (Nên ẩn flag)** | CRUD mục tiêu/đánh giá cơ bản, chưa phải luồng cốt lõi. |
| 14 | Đào tạo & Chứng chỉ (`/learning`) | **Hoạt động cơ bản (Nên ẩn flag)** | CRUD khóa học cơ bản, chưa phải luồng cốt lõi. |
| 15 | Tài sản & Bàn giao (`/assets`) | **Hoạt động cơ bản (Nên ẩn flag)** | CRUD tài sản cơ bản, chưa phải luồng cốt lõi. |
| 16 | Quyền riêng tư PDPL (`/privacy`) | **Hoạt động thật (cần bổ sung DSR)** | Đã có `consent_records`; chưa hoàn chỉnh luồng yêu cầu xem/đính chính/xóa dữ liệu & chính sách lưu giữ tự động. |
| 17 | Nhật ký Audit (`/audit`) | **Hoạt động thật** | Xem `audit_events` & `export_logs`; cần bổ sung lọc & log đầy đủ cho mở khóa lương, xem lương, đổi quyền. |

---

## 3. HIỆN TRẠNG LỖI, NỢ KỸ THUẬT, RỦI RO BẢO MẬT & PHÁP LÝ

### 3.1. Lỗi & Vấn đề UX (Chặn vận hành hằng ngày)
1. **Menu quá tải (~16–17 mục) & không phân quyền hiển thị:** `AppShell.tsx` render toàn bộ menu cho mọi vai trò và **vẫn render sidebar + mobile bottom bar ngay cả khi chưa đăng nhập** (chỉ ẩn ở `/login`), khiến người chưa đăng nhập vào `/` bị lỗi API hoặc kẹt `"Đang tải..."`.
2. **13 vị trí `"Đang tải..."` dạng chữ thô:** Tất cả trang đều fetch dữ liệu bằng `useEffect` client-side; khi mất mạng, chậm 4G hoặc lỗi 401/500 thì không có skeleton, không có empty state hướng dẫn hành động, và nhiều chỗ thiếu nút "Thử lại".
3. **Thiếu Cổng Tự phục vụ (ESS) mobile-first cho Nhân viên:** Nhân viên phải tự tìm trong nhiều trang rời rạc; chưa có màn hình gọn trên điện thoại để Check-in GPS 1 chạm, xem công tháng, số phép còn lại, xin nghỉ/OT <= 3 thao tác, và tải PDF phiếu lương.
4. **Thiếu màn hình "Việc cần duyệt" cho Quản lý:** Đơn nghỉ phép, OT, sửa công/ngoại lệ đang nằm ở 3 nơi khác nhau, không duyệt hàng loạt được.
5. **Footer kỹ thuật lộ ra giao diện nhân viên:** `AppShell.tsx` hiển thị `"RLS Enabled • PII AES-256-GCM • Supabase + Vercel sin1"` ở mọi trang thay vì đưa vào trang Quản trị.
6. **Chưa có cơ chế Mở khóa kỳ lương có lý do & Export Excel `.xlsx`:** Hiện tại `LOCKED` là khóa cứng hoàn toàn; thực tế kế toán cần nút mở khóa (chỉ Director/HR Admin) kèm bắt buộc nhập lý do + ghi `audit_events`.

### 3.2. Nợ kỹ thuật
- Không có `src/middleware.ts` (Next.js route guard) để redirect người chưa đăng nhập sang `/login` ở tầng server.
- Thiếu SSR (`Server Components`) cho dữ liệu ban đầu, làm chậm LCP trên mạng 4G.
- Chưa có E2E test (Playwright) và chưa có bộ seed chuẩn 50 nhân viên × 3 tháng công kèm các ca biên.

### 3.3. Rủi ro Bảo mật & Dữ liệu Cá nhân (Nghiêm trọng)
1. **Lỗ hổng Data Scoping khi `employeeId === null`:** Trong `GET /api/v1/payroll/runs` và `GET /api/v1/employees`, điều kiện lọc `if (!isPayrollViewer && ctx.employeeId)` sẽ **bỏ qua lọc** nếu user thường chưa được gán `employee_id`, dẫn tới nguy cơ đọc dữ liệu nhân viên khác. Cần sửa thành chặn cứng `403` hoặc trả rỗng nếu không có `employeeId`!
2. **`/api/v1/dashboard` không kiểm tra vai trò:** Chỉ check `if (!auth)` rồi trả toàn bộ số liệu quỹ lương, hợp đồng, nhân sự toàn công ty cho cả tài khoản `EMPLOYEE`.
3. **Thiếu RLS đầy đủ cho quản lý cấp dưới & kế toán:** Phần lớn bảng dựa vào `SERVICE_ROLE_KEY` ở API route; cần rà soát policy RLS phòng thủ theo chiều sâu (defense-in-depth).
4. **Chưa có Rate Limit đăng nhập & Anti-spoofing chấm công:** Chưa giới hạn số lần đăng nhập sai; GPS check-in chưa ghi nhận IP/Device fingerprint để cảnh báo chấm công hộ.
5. **PDPL:** Chưa có giao diện/API hoàn chỉnh cho Data Subject Request (quyền truy cập, đính chính, xóa dữ liệu) và job áp dụng `retention_policies`.

### 3.4. Rủi ro Pháp lý (Cần kiểm chứng trước Bước 3)
- Một số hằng số hiện có trong `VN_2026_H2_RULES` (`decimal-engine.ts`) như: giảm trừ bản thân `15.500.000 đ`, người phụ thuộc `6.200.000 đ`, biểu thuế 5 bậc, lương tối thiểu Vùng III `4.160.000 đ` / `4.140.000 đ`, mức tham chiếu BHXH `2.340.000 đ`, đoàn phí CĐ 1% (trần `253.000 đ`) cần được **đối chiếu lại chính thức** với Luật BHXH 2024 (hiệu lực 01/07/2025), Nghị định lương tối thiểu vùng mới nhất, Luật Thuế TNCN sửa đổi và quy định Công đoàn hiện hành trong `docs/LEGAL_PARAMS.md` (mục nào chưa có văn bản hiệu lực chắc chắn sẽ đánh dấu `CẦN KẾ TOÁN XÁC NHẬN`).

---

## 4. KẾ HOẠCH NÂNG CẤP ĐỀ XUẤT (BƯỚC 1 → BƯỚC 6)

- **Bước 1 — Đơn giản hóa cấu trúc & điều hướng:** Nhóm menu theo 4 cụm công việc (Hằng ngày / Hằng tháng / Nhân sự / Quản trị), ẩn 5 module phụ sau feature flag (mặc định tắt), ẩn hoàn toàn menu khi chưa đăng nhập, thêm `middleware.ts` redirect về `/login`, sửa thông báo cấu hình Vercel sạch sẽ.
- **Bước 2 — Luồng cốt lõi (Mobile ESS + Duyệt gộp + Lương 5 bước + Dashboard theo vai trò):** Xây Cổng nhân viên mobile-first, màn hình "Việc cần duyệt" cho Quản lý, quy trình lương 5 bước (kèm mở khóa có lý do + tải phiếu lương PDF), Dashboard 4–6 KPI đúng vai trò.
- **Bước 3 — Tính đúng & Tuân thủ pháp luật:** Tra cứu & lập `docs/LEGAL_PARAMS.md`, chuẩn hóa bảng `legal_rule_registry`, viết tối thiểu 15 unit test biên cho engine lương, thêm giải trình công thức ("Vì sao con số này?") trên từng dòng phiếu lương.
- **Bước 4 — Trải nghiệm & Độ tin cậy:** SSR cho trang chính, skeleton + empty state + error retry thay thế toàn bộ `"Đang tải..."`, import/export Excel, chuẩn hóa ngày `dd/MM/yyyy` & tiền `1.234.567 ₫`, chuyển footer kỹ thuật về trang Quản trị.
- **Bước 5 — Bảo mật & PDPL:** Vá ngay lỗi `employeeId === null` và `dashboard` scoping, rà soát RLS, test phân quyền chéo nhân viên A/B, rate limit login, chống chấm công hộ (IP/Device/cảnh báo vị trí), hoàn thiện PDPL & audit logs.
- **Bước 6 — Kiểm chứng toàn diện:** Seed 50 nhân viên × 3 tháng công, chạy E2E Playwright 3 luồng, kiểm tra Lighthouse mobile & accessibility, xuất `docs/USER_GUIDE.md` & `docs/CHANGELOG.md`.

