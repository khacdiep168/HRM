# LỘ TRÌNH CẢI TIẾN & TRIỂN KHAI VẬN HÀNH (HRM IMPROVEMENT ROADMAP)
**Dự án:** Hệ thống Quản trị Nhân sự Thế Kỷ Vàng (HRM TKV Enterprise 2.0)  
**Chủ trì:** Giám đốc Hành chính - Nhân sự & Trưởng nhóm Kiến trúc Công nghệ  
**Ngày phê duyệt:** 16/11/2026 | **Thời gian thực hiện:** Tháng 11/2026 – Tháng 02/2027

---

## 1. TỔNG QUAN CHIẾN LƯỢC TRIỂN KHAI

Để đảm bảo an toàn tuyệt đối cho dữ liệu nhân sự và bảng lương thực tế của Công ty TNHH TM Thế Kỷ Vàng (quy mô 50 - 300 nhân sự), Hội đồng Thẩm định áp dụng chiến lược **5 Giai đoạn Triển khai Cuốn chiếu (Phased Rollout)**.

```
       THÁNG 11/2026            THÁNG 12/2026            THÁNG 01/2027       THÁNG 02/2027+
┌───────────────────────┬───────────────────────┬───────────────────────┬───────────────────┐
│       PHASE 1         │       PHASE 2         │       PHASE 3         │  PHASE 4 & 5      │
│  Bảo mật & Pháp lý    │ Chấm công & Phép OT   │  C&B Lương 2 Kỳ       │ Mobile UX & BI    │
│  (Tuần 1 - Tuần 2)    │  (Tuần 3 - Tuần 4)    │  (Tuần 5 - Tuần 6)    │ (Tuần 7 - Tháng 3)│
└───────────────────────┴───────────────────────┴───────────────────────┴───────────────────┘
```

---

## 2. CHI TIẾT CÁC GIAI ĐOẠN CẢI TIẾN

### PHASE 1: KHẮC PHỤC RỦI RO NGHIÊM TRỌNG VÀ CHUẨN HÓA DỮ LIỆU CỐT LÕI
- **Thời gian:** Tuần 1 – Tuần 2 (17/11/2026 – 30/11/2026)
- **Mục tiêu:** Xử lý triệt để 2 lỗ hổng bảo mật rò rỉ dữ liệu (`SEC-01`, `SEC-02`), điều chỉnh tham số tính thuế theo luật hiện hành (`LEG-01`), số hóa đủ 50 hợp đồng lao động (`BUS-01`).
- **Hạng mục kỹ thuật & Nghiệp vụ:**
  1. *Fix SEC-01:* Bổ sung bộ lọc phân quyền theo role trong API `/api/v1/attendance/matrix` (nhân viên chỉ xem công của mình, quản lý xem công phòng ban).
  2. *Fix SEC-02:* Loại bỏ các trường tổng tài chính (`total_gross_amount`, `total_net_amount`) trong response API `/api/v1/payroll/runs` khi người dùng không có role `HR_ADMIN`, `ACCOUNTANT`, `DIRECTOR`.
  3. *Fix LEG-01:* Đặt cấu hình thuế TNCN `VN-2020-CURRENT` (11tr / 4.4tr, biểu thuế 7 bậc) làm mặc định cho kỳ tính lương 11/2026; đưa bộ luật tương lai `VN-2026-H2` về chế độ chạy thử nghiệm (Simulation Only).
  4. *Fix BUS-01:* Bộ phận HC-NS số hóa 38 hợp đồng còn thiếu vào hệ thống; kỹ thuật hỗ trợ script nhập hàng loạt từ Excel.
  5. *Fix UX-01:* Thêm Popup đồng ý chính sách PDPL ngay khi nhân viên bấm chấm công GPS lần đầu.
- **Phân công trách nhiệm:**
  - *Dev Team:* Sửa API, cập nhật test case bảo mật, deploy bản vá lên Vercel.
  - *HR Team:* Rà soát hồ sơ 38 nhân sự, nhập loại hợp đồng, lương cơ bản và ngày bắt đầu/kết thúc.
  - *Giám đốc:* Phê duyệt ban hành Quy chế bảo vệ dữ liệu cá nhân nội bộ TKV.
- **Rủi ro & Kiểm soát:**
  - *Rủi ro:* Nhân viên phản ánh không chấm công được do lỗi consent.
  - *Kiểm soát:* HR gửi thông báo Zalo/Email hướng dẫn trước giờ làm việc sáng Thứ Hai.
- **Tiêu chí nghiệm thu (DoD):**
  - Chạy script kiểm thử bảo mật độc lập: `EMPLOYEE` không còn thấy dữ liệu của người khác.
  - Bảng lương thử nghiệm tính đúng giảm trừ 11.000.000 VNĐ.
  - Số lượng hợp đồng trong DB bằng đúng 50 bản ghi.

---

### PHASE 2: CHUẨN HÓA CHẤM CÔNG GPS, THIẾT LẬP NGHỈ PHÉP & TĂNG CA
- **Thời gian:** Tuần 3 – Tuần 4 (01/12/2026 – 14/12/2026)
- **Mục tiêu:** Vận hành mượt mà chấm công GPS 1 chạm tại văn phòng & chuỗi cửa hàng; tự động hóa tính quỹ phép năm và quy trình phê duyệt OT trước ca.
- **Hạng mục kỹ thuật & Nghiệp vụ:**
  1. Tối ưu giao diện chấm công di động: Tự động bắt tọa độ GPS khi mở tab chấm công, giảm số lần bấm từ 3 click xuống 1 click.
  2. Tích hợp tính năng "Phiếu đăng ký tăng ca trước ca" (Pre-shift OT request) cho Trưởng bộ phận.
  3. Rà soát và khóa công thức thâm niên cộng dồn phép năm (cứ 5 năm làm việc tại TKV được cộng thêm 1 ngày phép theo Điều 114 BLLĐ).
  4. Hoàn thiện thông báo đẩy (Push notification / In-app notification) khi đơn nghỉ phép hoặc đơn giải trình quên chấm công được duyệt.
  5. Thiết lập lịch trực Tết Nguyên Đán và các ngày nghỉ lễ năm 2027 có hưởng nguyên lương.
- **Phân công trách nhiệm:**
  - *Dev Team:* Tối ưu Geolocation hook, thêm form đăng ký OT nhóm cho quản lý.
  - *HR/C&B:* Kiểm tra đối soát dữ liệu ngày phép của toàn bộ 50 cán bộ nhân viên.
  - *Trưởng phòng ban:* Tham gia buổi đào tạo 30 phút về quy trình duyệt đơn trên điện thoại.
- **Tiêu chí nghiệm thu (DoD):**
  - 100% nhân viên văn phòng và cửa hàng trưởng check-in GPS ổn định trong bán kính cho phép.
  - Đơn nghỉ phép duyệt xong lập tức cập nhật ký hiệu `P` vào Bảng công tổng hợp.

---

### PHASE 3: HOÀN THIỆN C&B, TỰ ĐỘNG HÓA TÍNH LƯƠNG 2 KỲ & KHOÁ BẢNG LƯƠNG
- **Thời gian:** Tuần 5 – Tuần 6 (15/12/2026 – 31/12/2026)
- **Mục tiêu:** Đóng kỳ lương Tháng 12/2026 trên phần mềm HRM TKV song song với bảng tính Excel truyền thống; đạt độ chính xác 100% trước khi chuyển đổi chính thức.
- **Hạng mục kỹ thuật & Nghiệp vụ:**
  1. Xây dựng quy trình tính lương 2 kỳ: Kỳ 1 (Tạm ứng ngày 15 hàng tháng) và Kỳ 2 (Quyết toán lương ngày 05 tháng kế tiếp).
  2. Tích hợp tính năng xuất file lệnh chuyển tiền hàng loạt theo định dạng các ngân hàng TKV đang sử dụng (Vietcombank, MB Bank, BIDV).
  3. Hoàn thiện module Quản lý phụ cấp cố định theo vị trí và phụ cấp trách nhiệm.
  4. Thêm nút "Gửi phiếu lương qua Zalo ZNS / Email" cho nhân viên sau khi Giám đốc bấm khóa bảng lương (`LOCKED`).
  5. Thử nghiệm tính toán lương tháng 13 và thưởng Tết theo thâm niên.
- **Phân công trách nhiệm:**
  - *C&B & Kế toán trưởng:* Chạy tính lương song song (Parallel Run) trên cả Excel và HRM TKV; lập bảng đối chiếu từng đồng lệch.
  - *Dev Team:* Hỗ trợ điều chỉnh công thức phụ cấp và định dạng xuất file ngân hàng.
  - *Giám đốc:* Ký biên bản nghiệm thu chạy thử nghiệm nghiệp vụ tính lương.
- **Tiêu chí nghiệm thu (DoD):**
  - Bảng lương 50 người trên HRM TKV khớp 100% với số liệu kế toán thanh toán.
  - Trạng thái kỳ lương chuyển từ `DRAFT` -> `UNDER_REVIEW` -> `APPROVED` -> `LOCKED` đúng quy trình kiểm soát 4 mắt (Four-eyes principle).

---

### PHASE 4: TỐI ƯU HÓA TRẢI NGHIỆM DI ĐỘNG & BẢNG CÔNG MATRIX VIRTUALIZATION
- **Thời gian:** Tuần 7 – Tuần 8 (01/01/2027 – 15/01/2027)
- **Mục tiêu:** Nâng cao tốc độ tải trang, giao diện di động đạt chuẩn phản hồi nhanh (Smooth 60 FPS), loại bỏ hoàn toàn độ trễ khi xem bảng công 50 - 300 nhân sự.
- **Hạng mục kỹ thuật & Nghiệp vụ:**
  1. Áp dụng Virtual Scrolling (`@tanstack/react-virtual`) cho bảng công ma trận, chỉ render 15-20 dòng trên màn hình thay vì toàn bộ 50 dòng x 31 cột.
  2. Thu gọn giao diện di động thành dạng xem thẻ tóm tắt (Card summary) và xem lịch theo tuần cho nhân viên.
  3. Tích hợp xuất phiếu lương PDF cá nhân có sẵn logo và mã QR tra cứu tính xác thực.
  4. Thêm tính năng tự động khóa phiên làm việc sau 15 phút không thao tác cho máy trạm kế toán.
- **Tiêu chí nghiệm thu (DoD):**
  - Thời gian tải bảng công trên thiết bị di động kết nối 4G < 1.5 giây; không còn hiện tượng khựng giật khi cuộn màn hình.

---

### PHASE 5: BÁO CÁO QUẢN TRỊ BI CHUYÊN SÂU & TỰ ĐỘNG HÓA TUYỂN DỤNG ATS
- **Thời gian:** Sau Tết Nguyên Đán (Tháng 02/2027 trở đi)
- **Mục tiêu:** Cung cấp bức tranh toàn cảnh về nhân lực và chi phí cho Ban Giám đốc; tự động hóa tiếp nhận nhân sự mới.
- **Hạng mục kỹ thuật & Nghiệp vụ:**
  1. Dashboard phân tích nhân sự: Tỷ lệ biến động nhân sự (Turnover rate), chi phí lương trung bình trên doanh thu, tháp độ tuổi và thâm niên.
  2. Module Tuyển dụng & Onboarding: Đăng tin tuyển dụng nội bộ, lưu trữ CV ứng viên, quy trình 1 click chuyển đổi ứng viên trúng tuyển thành nhân viên chính thức kèm tài khoản đăng nhập.
  3. Kết nối trực tiếp máy chấm công ZKTeco tại chi nhánh cửa hàng qua nền tảng Cloud API.
- **Tiêu chí nghiệm thu (DoD):**
  - Giám đốc có thể xem báo cáo biến động nhân lực và chi phí theo thời gian thực trên điện thoại thông minh mọi lúc, mọi nơi.

---

## 3. BẢNG THEO DÕI TIẾN ĐỘ & CỘT MỐC CHẤP NHẬN (MILESTONES)

| Cột mốc (Milestone) | Thời hạn hoàn thành | Điều kiện tiên quyết (Prerequisite) | Người ký duyệt |
|---|:---:|---|---|
| **M1: An toàn & Pháp lý** | 30/11/2026 | Khắc phục xong SEC-01, SEC-02, LEG-01; nhập đủ 50 HĐ | CHRO & Trưởng bộ phận An ninh |
| **M2: Chấm công Toàn diện** | 14/12/2026 | 100% nhân viên hoàn tất đồng thuận PDPL và chấm công GPS | Trưởng bộ phận Chấm công |
| **M3: Khớp Lương Parallel** | 31/12/2026 | Bảng lương HRM tháng 12/2026 khớp từng đồng với Excel | Kế toán trưởng & Trưởng nhóm C&B |
| **M4: Go-Live Chính thức** | 05/01/2027 | Đạt 100% tiêu chí nghiệm thu UAT, hệ thống hoạt động ổn định | Giám đốc Công ty Thế Kỷ Vàng |
