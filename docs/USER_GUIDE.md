# SỔ TAY HƯỚNG DẪN SỬ DỤNG (USER GUIDE)
## HRM Enterprise — Công ty TNHH Thương mại Thế Kỷ Vàng
*Hệ thống Quản trị Nhân sự & Tiền lương chuẩn Luật Việt Nam (Vùng III Tây Ninh)*

---

## 📱 VAI TRÒ 1: NHÂN VIÊN (EMPLOYEE SELF-SERVICE — ESS)
> *Dành cho toàn bộ nhân viên công ty — Tối ưu 100% trên điện thoại di động.*

### 1. Đăng nhập hệ thống
- Truy cập: `https://hrmtkv.vercel.app/login` trên trình duyệt điện thoại (Safari, Chrome).
- Nhập email công ty và mật khẩu được cấp (hoặc mã MFA nếu có bật bảo mật 2 lớp).

### 2. Chấm công GPS hàng ngày
- Vào mục **Hằng ngày** ➔ **Chấm công**.
- Chọn ca làm việc (Sáng / Chiều) và bấm **"Chấm công vào"** hoặc **"Chấm công ra"**.
- Trình duyệt sẽ yêu cầu quyền truy cập vị trí (GPS): Bấm **"Cho phép"**.
- Hệ thống tự động đối chiếu vị trí thực tế với bán kính (150m) của Văn phòng/Kho/Cửa hàng được phân công.
- Nếu ngoài bán kính: Màn hình hiển thị rõ khoảng cách lệch và lý do từ chối.

### 3. Xin nghỉ phép & Đăng ký tăng ca (Tối đa 3 thao tác)
- Vào **Nghỉ phép** hoặc **Tăng ca**.
- Bấm **"Tạo yêu cầu mới"**:
  - Chọn loại phép (Phép năm, Nghỉ ốm, Nghỉ việc riêng...) hoặc thời gian làm thêm.
  - Chọn ngày, điền lý do ngắn gọn và bấm **"Gửi duyệt"**.
- Theo dõi trạng thái đơn (Chờ duyệt / Đã duyệt / Từ chối) ngay trên màn hình.

### 4. Xem & Tải Phiếu lương (Payslip)
- Vào **Hằng tháng** ➔ **Phiếu lương**.
- Chọn kỳ lương cần xem (ví dụ: Tháng 10/2026).
- Xem chi tiết: Lương cơ bản, Ngày công thực tế, Tăng ca, Các khoản phụ cấp, Khấu trừ BHXH (10.5%), Thuế TNCN và Thực lĩnh.
- Bấm vào biểu tượng **"Vì sao con số này?"** để xem giải trình công thức chi tiết từng khoản tiền.
- Bấm **"In / Xuất PDF"** để lưu phiếu lương về máy.

---

## 👔 VAI TRÒ 2: QUẢN LÝ TRỰC TIẾP (DEPARTMENT / STORE MANAGER)
> *Dành cho Trưởng phòng, Quản lý kho, Cửa hàng trưởng.*

### 1. Dashboard Tổng quan quân số
- Xem nhanh 4 chỉ số tức thời:
  - Quân số đi làm hôm nay.
  - Số nhân viên đi trễ / vắng.
  - Số đơn đang chờ duyệt.
  - Nhân sự thử việc / sắp hết hợp đồng thuộc bộ phận.

### 2. Màn hình "Việc cần duyệt" tập trung (`/approvals`)
- Truy cập mục **Hằng ngày** ➔ **Việc cần duyệt**.
- Tất cả các đơn phát sinh của cấp dưới được gom về 1 nơi:
  - **Đơn nghỉ phép (Leave Requests)**
  - **Đơn tăng ca (Overtime Requests)**
  - **Giải trình công (Attendance Exceptions)**
- Thao tác:
  - Xem tóm tắt thông tin: Mã nhân viên, Tên, Ngày, Số giờ/ngày, Lý do.
  - **Duyệt hàng loạt**: Tích chọn nhiều đơn và bấm nút **"Duyệt các mục đã chọn"** (hoặc Từ chối).

### 3. Theo dõi & Điều chỉnh công bộ phận
- Truy cập **Hằng ngày** ➔ **Bảng công**.
- Lọc theo bộ phận của mình để xem tiến độ chấm công thực tế, phát hiện nhân viên quên chấm công để nhắc nhở nộp đơn giải trình trước ngày chốt công.

---

## 💼 VAI TRÒ 3: KẾ TOÁN & NHÂN SỰ (PAYROLL / HR ADMIN)
> *Dành cho Chuyên viên C&B, Kế toán tiền lương, Kế toán trưởng.*

### Quy trình chốt lương 5 bước chuẩn hóa (`/payroll`)

#### Bước 1: Chốt công kỳ (Cutoff Attendance)
- Vào mục **Hằng tháng** ➔ **Chốt công**.
- Chọn kỳ lương (ví dụ: `2026-M11`).
- Bấm **"Tổng hợp công tự động"**: Hệ thống gom sự kiện chấm công Face ID + GPS + Đơn phép/OT đã duyệt.
- Kiểm tra danh sách cảnh báo bất thường: Ngày thiếu giờ, đi trễ, quên checkout. Sau khi xử lý xong bấm **"Khóa dữ liệu công"**.

#### Bước 2: Tính lương & Xem trước (Calculate & Preview)
- Vào mục **Hằng tháng** ➔ **Bảng lương**.
- Chọn **"Tạo kỳ lương mới"** ➔ Chọn kỳ và bấm **"Tính lương tự động"**.
- Động cơ lương Decimal tính toán chính xác 100% theo quy định Vùng III Tây Ninh (DOC-09 VN-2026-H2):
  - Lương tối thiểu vùng: 4.140.000 ₫.
  - Mức lương tham chiếu BHXH: 2.530.000 ₫ (Trần đóng: 50.600.000 ₫).
  - Giảm trừ bản thân: 15.500.000 ₫; Giảm trừ NPT: 6.200.000 ₫/người.
  - Biểu thuế TNCN lũy tiến 5 bậc hoặc 10% toàn phần cho thử việc.
  - Tiền ăn trưa miễn thuế tối đa: 1.200.000 ₫/tháng.

#### Bước 3: Rà soát & So sánh biến động (Review)
- Hệ thống tự động so sánh với tháng trước và gắn nhãn cảnh báo:
  - Nhân sự có biến động lương Gross > 20%.
  - Nhân sự có OT vượt trần 40 giờ/tháng.
  - Nhân sự thử việc chuyển chính thức.
- Kế toán hoàn tất rà soát ➔ Bấm **"Trình Kế toán trưởng rà soát"** ➔ Chuyển tiếp **"Trình Giám đốc phê duyệt"**.

#### Bước 4: Khóa kỳ lương & Mở khóa an toàn (Lock & Unlock)
- Sau khi được phê duyệt, bấm **"Khóa kỳ lương"**. Khi đã khóa: Mọi dữ liệu lương trở thành bất biến (Read-only), ngăn chặn chỉnh sửa trái phép.
- **Quy trình Mở khóa (Unlock):** Nếu có sai sót cần điều chỉnh sau khi khóa, người dùng phải nhập **Lý do mở khóa** (tối thiểu 10 ký tự). Hành động này được ghi vết Audit Log vĩnh viễn (Ai mở, thời gian, lý do).

#### Bước 5: Phát hành phiếu lương & Xuất báo cáo chi trả
- Bấm **"Phát hành phiếu lương"**: Nhân viên sẽ nhận được thông báo và xem được phiếu lương trên app.
- Xuất file chi trả ngân hàng:
  - **Xuất Bank Transfer CSV / Excel** theo chuẩn Vietcombank / BIDV / Agribank.
  - **Xuất Chi phí theo Cost Center**: Phân bổ quỹ lương theo từng Trung tâm chi phí phục vụ hạch toán kế toán.
  - **Xuất Báo cáo Tăng ca (OT Summary)** phục vụ báo cáo tuân thủ Bộ Lao động.

---

## 🏛️ VAI TRÒ 4: BAN GIÁM ĐỐC (DIRECTOR & EXECUTIVE)
> *Dành cho Giám đốc điều hành, Ban Tổng giám đốc.*

### 1. Dashboard Quản trị 6 chỉ số chiến lược
- Ngay khi đăng nhập, Giám đốc nắm bắt tức thì bức tranh vận hành công ty qua 6 KPI tinh gọn:
  1. **Tỷ lệ đi làm hôm nay**: Tổng số nhân sự đang có mặt tại trụ sở, kho và các cửa hàng.
  2. **Quân số đi trễ / Vắng mặt**: Cảnh báo kỷ luật lao động tức thời.
  3. **Yêu cầu chờ phê duyệt**: Số lượng tờ trình / đơn từ đang chờ xử lý.
  4. **Tổng quỹ lương tháng dự kiến**: Dự báo dòng tiền chi trả lương và chi phí doanh nghiệp đóng (BHXH + KPCĐ).
  5. **Hợp đồng sắp hết hạn trong 30 ngày**: Danh sách nhân sự cần tái ký hoặc đánh giá kết thúc thử việc.
  6. **Nhân viên sắp hết phép năm**: Quản trị quỹ dự phòng phép.

### 2. Phê duyệt chi lương cấp 2 (Director Approval)
- Giám đốc kiểm tra báo cáo tổng hợp bảng lương do Kế toán trưởng trình duyệt.
- Xem phân tích cơ cấu chi phí: Chi phí Gross, Đóng góp DN (21.5% BHXH + 2% KPCĐ), Tổng thuế TNCN nộp ngân sách.
- Bấm **"Phê duyệt chi trả"** để ủy quyền cho bộ phận Kế toán thanh toán ngân hàng.

### 3. Giám sát Tuân thủ & Nhật ký kiểm toán (Audit Trail)
- Vào **Quản trị** ➔ **Nhật ký Audit**.
- Theo dõi toàn bộ lịch sử truy vết bảo mật: Xem lương, xuất báo cáo PII, mở khóa kỳ lương, thay đổi phân quyền.

