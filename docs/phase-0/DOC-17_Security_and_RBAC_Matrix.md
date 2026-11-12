# DOC-17: Ma trận Bảo mật, Phân quyền RBAC & Tuân thủ Dữ liệu Cá nhân

> **Trạng thái tài liệu:** `UPDATED_WITH_COMPANY_ROLES` (Đã ánh xạ chức danh thực tế của **Công ty TNHH Thương mại Thế Kỷ Vàng**)  
> **Tham chiếu gốc:** [HRM_Enterprise_Design_Baseline_v1.0.docx](../../HRM_Enterprise_Design_Baseline_v1.0.docx) — Mục 2 & Mục 6.2; [Quy đinh chuc nang nhiem vu cac phong ban.pdf](../../Quy%20%C4%91inh%20chuc%20nang%20nhiem%20vu%20cac%20phong%20ban.pdf)  
> **Căn cứ pháp lý:** Luật Bảo vệ dữ liệu cá nhân `91/2025/QH15` & Nghị định `356/2025/NĐ-CP` (hiệu lực 01/01/2026)

---

## 0. Bảng Ánh xạ Chức danh Thực tế (Thế Kỷ Vàng) → Roles Hệ thống

| Role Hệ thống | Chức danh / Bộ phận thực tế trong Quy chế công ty | Phạm vi dữ liệu mặc định | Ghi chú phân quyền từ PDF |
| :--- | :--- | :--- | :--- |
| **`DIRECTOR`** | `Chủ tịch HĐTV`, `Giám Đốc`, `Phó Giám Đốc` *(khi được ủy quyền)* | `COMPANY_EXEC` | Ký duyệt quyết định nhân sự, tuyển dụng, bảng lương thưởng, chứng từ chi |
| **`HR_ADMIN`** | `Trưởng phòng Hành chính – Nhân sự (HC-NS)` | `COMPANY_HR` | Chủ trì tuyển dụng, HĐLĐ, chấm công, lập bảng lương/phụ cấp/thưởng, BHXH, KPI |
| **`HR_STAFF`** | `Nhân viên HC-NS` *(nếu tách chuyên viên)* | `COMPANY_HR` *(hạn chế)* | Tác nghiệp hồ sơ, chấm công, không tự duyệt giao dịch do mình tạo |
| **`DEPARTMENT_MANAGER`** | `Trưởng/Phó phòng Kinh doanh`, `Quản lý Bãi xe`, `Thủ kho`, `Cửa hàng trưởng` *(hoặc `NV Thu ngân` được ủy quyền ca)* | `DEPT_TREE` | Sắp xếp ca/đổi ca/tăng ca, duyệt bước 1 phép năm/nghỉ việc riêng, đánh giá nhân viên bộ phận |
| **`ACCOUNTANT`** | `Kế toán trưởng`, `Kế toán tổng hợp`, `NV Kế toán`, `Thủ quỹ` *(chỉ xem phiếu chi/sổ quỹ)* | `COMPANY_FIN` | **Bắt buộc có chữ ký/duyệt của `Kế toán trưởng` trên hồ sơ lương thưởng** mới có giá trị pháp lý (trang 20 PDF) |
| **`SUPER_ADMIN`** | `Phòng CNTT (IT)`: Chuyên viên Phần mềm & Phần cứng–Mạng–Camera | `SYSTEM_ONLY` | Quản trị tài khoản, bảo mật, kết nối máy chấm công; **bị chặn xem lương & PII nhạy cảm** |
| **`EMPLOYEE`** | Toàn thể CB-NV (`Kỹ thuật`, `Bảo vệ`, `Lái xe`, `Tạp vụ`, `NV Bãi xe`, `NV Kho`, `NV Bán hàng`, `Ngành hàng`, `XNK`, `Marketing`...) | `SELF` | Cổng ESS: xem phiếu lương, đăng ký phép/đổi ca/tăng ca, xác nhận consent OT |
| **`AUDITOR`** | Kiểm toán nội bộ / Ban Kiểm soát *(khi chỉ định)* | `COMPANY_AUDIT` | Read-only toàn bộ logs kiểm tra & chứng từ |

---

## 1. Nguyên tắc kiến trúc phân quyền (Authorization Architecture)

1. **Deny-by-Default:** Không gán quyền tường minh = từ chối.
2. **Công thức quyền hiệu lực:**  
   `Effective Access = Role Permission ∩ Data Scope ∩ State Transition Rule ∩ Field Sensitivity Policy`
3. **Separation of Duties (SoD):**
   * Người tạo giao dịch (tạo nhân viên, nhập sửa công, tạo payroll run, điều chỉnh phép) **không được tự phê duyệt** chính giao dịch đó (`actor_id != creator_id`).
   * Vai trò kỹ thuật (`SUPER_ADMIN`) quản trị tài khoản/cấu hình nhưng **không mặc nhiên được xem lương, tài khoản ngân hàng, CCCD hay hồ sơ sức khỏe**.
4. **Tách quyền Xem (`VIEW`) và Xuất dữ liệu (`EXPORT`):** Có quyền xem màn hình không đồng nghĩa có quyền xuất Excel/CSV. Mọi hành động `EXPORT` và `UNMASK_PII` đều ghi vào `export_logs` / `access_logs`.
5. **Bắt buộc MFA:** Áp dụng bắt buộc cho `SUPER_ADMIN`, `HR_ADMIN`, `ACCOUNTANT`, `DIRECTOR`, `AUDITOR`.

---

## 2. Định nghĩa Data Scope

| Scope Code | Phạm vi dữ liệu | Đối tượng áp dụng mặc định |
| :--- | :--- | :--- |
| `SELF` | Chỉ bản ghi của chính `employee_id` gắn với user | `EMPLOYEE`, mọi role khi dùng cổng ESS |
| `DEPT_TREE` | Nhân viên có `org_assignments` hiệu lực thuộc phòng ban quản lý (và đơn vị con nếu cấu hình) | `DEPARTMENT_MANAGER` |
| `COMPANY_FIN` | Dữ liệu tài chính/lương/thuế/BHXH của công ty; ẩn đánh giá hiệu suất/CV tuyển dụng | `ACCOUNTANT` |
| `COMPANY_HR` | Phạm vi nghiệp vụ HR được ủy quyền trong công ty | `HR_ADMIN`, `HR_STAFF` (theo phân công) |
| `COMPANY_EXEC` | Báo cáo tổng hợp + luồng phê duyệt cấp cao (mặc định xem tổng hợp, không xem chi tiết nhạy cảm nếu không có quyền duyệt) | `DIRECTOR` |
| `COMPANY_AUDIT` | Read-only toàn bộ dữ liệu & audit logs | `AUDITOR` |
| `SYSTEM_ONLY` | Tài khoản, cấu hình kỹ thuật, tích hợp, log hệ thống (ẩn dữ liệu PII nhạy cảm & lương) | `SUPER_ADMIN` |

---

## 3. Ma trận Phân quyền chi tiết (8 Roles × 18 Phân hệ)

Ký hiệu quyền: `R` = Read/View, `C` = Create, `U` = Update, `A` = Approve/Reject, `L` = Lock/Unlock, `E` = Export, `P` = Unmask PII nhạy cảm, `—` = Không có quyền.

| # | Phân hệ | `SUPER_ADMIN` | `HR_ADMIN` | `HR_STAFF` | `DEPT_MANAGER` | `ACCOUNTANT` | `DIRECTOR` | `EMPLOYEE` | `AUDITOR` |
| :-: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 01 | **Employee (Hồ sơ chung)** | — | `R,C,U,E` | `R,C,U` | `R` *(Dept)* | `R` *(Hạn chế)* | `R` *(Tóm tắt)* | `R` *(Self)* | `R` |
| 01b | **Employee Sensitive (CCCD/Bank/Sức khỏe)** | — | `R,U,P,E` | `R,C,U` *(Che 1 phần)* | — | `R,P` *(Bank/MST)* | — | `R,U*` *(Self, qua duyệt)* | `R` *(Masked)* |
| 02 | **Organization (Cơ cấu/Định biên)** | `R` *(Cơ bản)* | `R,C,U,A` | `R,C,U` | `R` *(Dept)* | `R` *(Cost center)* | `R,A` | `R` *(Sơ đồ cơ bản)* | `R` |
| 03 | **Recruitment / ATS** | — | `R,C,U,A,E` | `R,C,U` | `R,C,U` *(Phỏng vấn Dept)* | — | `R,A` *(Headcount/Offer)* | — | `R` |
| 04 | **Onboarding / Offboarding** | `R,U` *(Tạo/Khóa acc IT)* | `R,C,U,A` | `R,C,U` | `R,U` *(Checklist Dept)* | `R,U` *(Quyết toán)* | `R` | `R,U` *(Task Self)* | `R` |
| 05 | **Contracts (Hợp đồng/Phụ lục)** | — | `R,C,U,A,E` | `R,C,U` | `R` *(Trạng thái HĐ Dept)* | `R` *(Mức đóng BH/Lương HĐ)* | `R,A` | `R` *(Self)* | `R` |
| 06 | **Attendance (Chấm công/Bảng công)** | — | `R,U,A,L,E` | `R,C,U` | `R,A` *(Giải trình Dept)* | `R` *(Bảng công khóa)* | `R` *(Tổng hợp)* | `R,C` *(Check-in/Giải trình Self)* | `R` |
| 07 | **Shift Management (Ca làm việc)** | — | `R,C,U,A` | `R,C,U` | `R,C,U,A` *(Dept)* | — | `R` | `R,C` *(Đổi ca Self)* | `R` |
| 08 | **Leave Management (Nghỉ phép)** | — | `R,C,U,A,E` | `R,C,U` | `R,A` *(Dept)* | `R` *(Nghỉ hưởng BHXH/KL)* | `R,A` *(Cấp quản lý)* | `R,C` *(Self)* | `R` |
| 09 | **Overtime (Làm thêm giờ)** | — | `R,U,A,E` | `R,C,U` | `R,A` *(Dept)* | `R` *(Tổng giờ OT)* | `R,A` *(Ngoài định mức)* | `R,C,A*` *(Consent OT Self)* | `R` |
| 10 | **Payroll (Lương Gross/Net)** | — | `R,C,U,L,E` *(Theo ủy quyền)* | `R,C*` *(Nếu phân công)* | — | `R,U,A(Review),E` | `R,A(Final)` | `R` *(Payslip Self)* | `R` |
| 11 | **PIT (Thuế TNCN & Phụ thuộc)** | — | `R,C,U` *(Hồ sơ NPT)* | `R,C,U` | — | `R,U,A,E` | `R` *(Tổng hợp)* | `R,C` *(Khai báo NPT Self)* | `R` |
| 12 | **Insurance (BHXH/BHYT/BHTN)** | — | `R,C,U,E` | `R,C,U` | — | `R,A,E` | `R` *(Tổng hợp)* | `R` *(Self)* | `R` |
| 13 | **Performance (KPI/OKR)** | — | `R,C,U,A,E` | `R` | `R,C,U,A` *(Dept)* | — | `R,A` | `R,C,U` *(Self)* | `R` |
| 14 | **Learning & Development** | — | `R,C,U,A,E` | `R,C,U` | `R,A` *(Dept)* | — | `R` | `R,C` *(Đăng ký Self)* | `R` |
| 15 | **Asset Management** | — | `R,C,U,E` | `R,C,U` | `R` *(Dept)* | `R` *(Giá trị TS)* | `R` | `R` *(TS đang giữ Self)* | `R` |
| 16 | **Employee Self-Service (ESS)** | — | `R` *(Self)* | `R` *(Self)* | `R` *(Self)* | `R` *(Self)* | `R` *(Self)* | `R,C,U` *(Self)* | `R` *(Self)* |
| 17 | **Workflow & Notification** | `R,U` *(Tech config)* | `R,C,U` *(Rule nghiệp vụ)* | `R` *(Task của mình)* | `R,A` *(Task của mình)* | `R,A` *(Task của mình)* | `R,A` *(Task của mình)* | `R` *(Đơn của mình)* | `R` |
| 18 | **Analytics, Admin & Audit** | `R,C,U` *(Users/Tech/Security)* | `R,C,U,E` *(HR Config/Reports)* | `R` *(Báo cáo tác nghiệp)* | `R` *(Dashboard Dept)* | `R,E` *(Báo cáo lương/thuế/BH)* | `R,E` *(Exec Dashboard)* | — | `R` *(Audit/Access/Export logs)* |

> **Lưu ý đặc biệt về `L` (Lock/Unlock) ở Phân hệ 10 (Payroll):**
> * Khóa kỳ lương (`Locked`) do `HR_ADMIN` hoặc `ACCOUNTANT` thực hiện sau khi `DIRECTOR` đã `Approved`.
> * Mở lại ngoại lệ (`Reopened by exception`) **bắt buộc Dual Approval** (ví dụ: `ACCOUNTANT` đề xuất + `DIRECTOR` phê duyệt + ghi rõ lý do và audit trail).

---

## 4. Phân loại Độ nhạy Dữ liệu & Quy tắc Che giấu (Field-Level Sensitivity)

| Nhóm dữ liệu | Mức độ nhạy cảm | Quy tắc lưu trữ & hiển thị |
| :--- | :--- | :--- |
| **Lương cơ bản, phụ cấp, Net/Gross, Payslip** | `CRITICAL_CONFIDENTIAL` | Mã hóa at-rest; chỉ hiển thị cho `SELF`, người lập/rà soát/duyệt payroll được ủy quyền; ẩn hoàn toàn với `SUPER_ADMIN` và `DEPARTMENT_MANAGER` (trừ khi OD chốt Manager được xem ngân sách tổng hợp). |
| **Số CCCD / Hộ chiếu, Mã số thuế, Số TK ngân hàng** | `HIGH_PII` | Mã hóa DB + hash tra cứu; UI mặc định mask (`****1234`); muốn xem nguyên văn phải có quyền `UNMASK_PII` và ghi `access_logs`. |
| **Hồ sơ sức khỏe / Giấy nghỉ ốm / Thai sản** | `SENSITIVE_PERSONAL` (theo Luật `91/2025/QH15`) | Chỉ `HR_ADMIN`/`HR_STAFF` phụ trách chế độ BHXH xem được file đính kèm; `DEPARTMENT_MANAGER` chỉ thấy trạng thái "Nghỉ chế độ đã duyệt", không thấy chẩn đoán bệnh. |
| **Thông tin người phụ thuộc (trẻ em/thân nhân)** | `SENSITIVE_PERSONAL` | Chỉ `HR` phụ trách PIT, `ACCOUNTANT` và `SELF` truy cập để kê khai giảm trừ gia cảnh. |
| **Vị trí GPS chấm công** | `SENSITIVE_PERSONAL` (Luật `91/2025/QH15`) | Chỉ chụp tọa độ (`lat/lng/accuracy`) tại thời điểm bấm Check-in/Check-out; **cấm tracking nền liên tục**; bắt buộc có `consent_record` riêng; chỉ `HR_ADMIN`, `DEPT_MANAGER` (trong scope bộ phận để duyệt ngoại lệ) và `SELF` được xem lịch sử chấm công vị trí. |
| **Dữ liệu sinh trắc học Face ID (máy chấm công)** | `SENSITIVE_PERSONAL` (Luật `91/2025/QH15`) | Thiết bị Face ID nhận dạng **cục bộ trên máy** tại các điểm làm việc và chỉ đẩy `device_user_id + timestamp` về Supabase; **không lưu template/ảnh khuôn mặt thô** trong DB web app; bắt buộc ký `consent_record` sinh trắc học riêng trước khi đăng ký khuôn mặt lên máy chấm công. |

---

## 5. Yêu cầu kỹ thuật tuân thủ Luật Bảo vệ Dữ liệu Cá nhân (`91/2025/QH15` & NĐ `356/2025/NĐ-CP`)

1. **Quản lý sự đồng ý (`consent_records`):** Ghi nhận rõ `purpose_code` (tuyển dụng, quản trị hợp đồng, tính lương/thuế/BHXH, **chấm công GPS**, **sinh trắc học Face ID**), `policy_version`, `consented_at`, và bằng chứng có thể kiểm chứng.
2. **Tiếp nhận quyền chủ thể dữ liệu (`data_subject_requests`):** Hỗ trợ nhân viên/ứng viên gửi yêu cầu xem, trích xuất, chỉnh sửa, hạn chế xử lý hoặc xóa dữ liệu có SLA theo dõi.
3. **Xung đột giữa "Quyền yêu cầu xóa" và "Nghĩa vụ lưu trữ theo luật":** Kích hoạt `legal_holds` tự động đối với hợp đồng lao động, bảng lương, chứng từ khấu trừ thuế TNCN, hồ sơ BHXH — hệ thống từ chối xóa cứng và giải thích rõ căn cứ pháp lý lưu trữ bắt buộc.
4. **Kiểm soát Export:** File Excel/CSV xuất từ hệ thống phải có watermark/metadata người xuất, thời điểm xuất, và lưu bản ghi `export_logs`. Cảnh báo bất thường nếu tải số lượng lớn bản ghi ngoài giờ hoặc ngoài phạm vi thường xuyên.
5. **Chuyển dữ liệu xuyên biên giới (Supabase + Vercel):** Vì CSDL Supabase (`xtswzywqbizunynahmvl`) và hosting Vercel vận hành trên hạ tầng cloud quốc tế, doanh nghiệp phải lập **Hồ sơ Đánh giá tác động chuyển dữ liệu cá nhân ra nước ngoài** (và Hồ sơ Đánh giá tác động xử lý dữ liệu cá nhân) theo Luật `91/2025/QH15` & NĐ `356/2025/NĐ-CP` trước khi Go-live production.
6. **Defense-in-Depth cho Supabase + Vercel:** Browser **không query trực tiếp** các bảng nhạy cảm bằng `anon key`; mọi request đi qua Vercel Server API (kiểm tra Auth JWT + RBAC + Scope + SoD), kết hợp bật **PostgreSQL Row Level Security (RLS)** trên toàn bộ bảng Supabase và mã hóa `AES-256-GCM` tầng ứng dụng cho `national_id_enc`, `account_no_enc`, `phone_enc`, `tax_code_enc`.

