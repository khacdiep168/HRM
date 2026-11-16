# ĐÁNH GIÁ TRẢI NGHIỆM NGƯỜI DÙNG (UX/UI & ERGONOMICS AUDIT)
## CÔNG TY TNHH THƯƠNG MẠI THẾ KỶ VÀNG (TKV)
**Tài liệu:** `04_UX_UI_AUDIT.md`  
**Chuyên gia thẩm định:** Chuyên gia Trải nghiệm Người dùng (UX/UI Lead) & Đại diện Người lao động TKV  
**Môi trường thử nghiệm:** Desktop (1920x1080), Tablet (iPad 820x1180), Mobile (iPhone 390x844)  
**Thời điểm đánh giá:** 16/11/2026  

---

## 1. ĐÁNH GIÁ TỔNG QUAN THIẾT KẾ & BỐ CỤC GIAO DIỆN

### A. Về tính thẩm mỹ và nhận diện thương hiệu
- **Tông màu chủ đạo:** Màu vàng cam nhận diện Thế Kỷ Vàng (`#ea580c` / `#f59e0b`) kết hợp nền xanh lục bảo (`#059669` / `#166534`) cho các trạng thái chuẩn mực, tạo cảm giác chuyên nghiệp, ấm áp và đáng tin cậy.
- **Phông chữ & Kiểu dáng:** Sử dụng font Sans-serif trung tính, độ tương phản văn bản đạt chuẩn WCAG 2.1 AA (chữ đen/xám đậm trên nền sáng). Các con số tiền tệ và mã nhân sự dùng font Mono giúp thẳng hàng và dễ dò đối soát.

### B. Về cấu trúc Menu và Điều hướng (App Navigation)
- Menu bên trái chia thành 5 cụm chức năng theo đúng tần suất công việc của doanh nghiệp:
  1. **Tổng quan:** Dashboard (nhìn nhanh buổi sáng).
  2. **Hằng ngày:** Chấm công, Nghỉ phép, Tăng ca, Việc cần duyệt (nhân viên & quản lý dùng hàng ngày).
  3. **Hằng tháng:** Bảng lương, Phiếu lương, Phụ cấp (dùng cuối tháng).
  4. **Nhân sự:** Hồ sơ, Hợp đồng, Sơ đồ tổ chức (dùng định kỳ).
  5. **Quản trị:** Cài đặt, Nhật ký Audit, Quyền riêng tư.
- **Đánh giá:** Rất gọn gàng, loại bỏ được hoàn toàn cảm giác rối rắm của các phần mềm nhân sự ERP đời cũ.

---

## 2. ĐO LƯỜNG SỐ BƯỚC THAO TÁC (CLICK COUNT BENCHMARK)

| Thao tác nghiệp vụ thường ngày | Số click hiện tại | Thời gian thực hiện | Đánh giá | Đề xuất tối ưu |
|:---|:---:|:---:|:---:|:---|
| **Nhân viên chấm công GPS di động** | **3 - 4 clicks** *(Nếu bị chặn PDPL lên tới 8 clicks)* | 15s - 45s | **Cần cải tiến** | Tích hợp nút "Chấm công nhanh" ngay màn hình chính; tự động ký consent nếu chưa ký. Giảm xuống **1 click**. |
| **Nhân viên tạo đơn xin nghỉ phép** | **3 clicks** | 20s | **Rất tốt** | Bấm `+ Tạo đơn` -> Chọn ngày -> Gửi đơn. Tự tính số ngày nghỉ. |
| **Trưởng phòng phê duyệt đơn từ** | **1 click** | 3s | **Xuất sắc** | Vào `/approvals` -> Bấm `Duyệt` ngay trên dòng đơn. |
| **Sửa tay 1 ô trên Bảng công Matrix** | **2 clicks** | 10s | **Rất tốt** | Bấm vào ô -> Chọn ký hiệu (`X`, `1/2`, `TS`...) -> Bấm Lưu. |
| **HR tính toán và chốt lương kỳ** | **4 clicks** | 60s | **Rất tốt** | Tạo kỳ -> Bấm Tính -> Trình Kế toán duyệt -> Trình Giám đốc duyệt -> Khóa. |
| **Nhân viên mở xem Phiếu lương cá nhân** | **1 click** | 2s | **Xuất sắc** | Bấm "Phiếu lương của tôi" trên menu -> Phiếu hiển thị tức thì. |
| **HR tìm kiếm và xuất danh sách nhân sự** | **2 clicks** | 5s | **Rất tốt** | Gõ tên/mã vào ô tìm kiếm -> Bấm Xuất Excel. |

---

## 3. ĐÁNH GIÁ TRẢI NGHIỆM TRÊN THIẾT BỊ DI ĐỘNG (MOBILE VIEWPORT 390x844)

Do hơn 60% nhân sự TKV là nhân viên bán hàng cửa hàng miễn thuế, nhân viên kho bãi và tài xế, trải nghiệm trên điện thoại thông minh là yếu tố quyết định thành bại của dự án:

1. **Khả năng hiển thị Header & Sidebar trên Mobile:**
   - Khi ở màn hình nhỏ (< 768px), sidebar tự động thu gọn thành nút Menu (Hamburger Icon). Bấm vào menu trượt ra mượt mà, bấm ra ngoài tự đóng.
2. **Trải nghiệm trang Phiếu lương (`/payslips`):**
   - Đạt điểm tuyệt đối: Tự động chuyển đổi thành dạng thẻ dọc (Mobile Card Layout). Các khối: *Tổng lương, Tiền bảo hiểm, Tiền thuế, Thực nhận* hiển thị vừa khít trong 1 màn hình cuộn, phông chữ rõ ràng, người lao động dễ dàng chụp lại màn hình làm bằng chứng nhận lương.
3. **Trải nghiệm trang Bảng chấm công Matrix (`/attendance`):**
   - *Điểm mạnh:* Cột "Nhân sự" được cố định ghim cứng bên trái (`sticky left-0`), khi vuốt ngang màn hình sang các ngày 15, 20, 25 vẫn không bị mất tên nhân viên.
   - *Điểm yếu:* Hàng tiêu đề ngày khá dày, trên màn hình nhỏ nếu không quen vuốt ngang sẽ thấy nhiều ô nhỏ. Đề xuất: Trên mobile, mặc định mở tab "Chấm công GPS" hoặc "Bảng công cá nhân" thay vì bảng ma trận toàn công ty.

---

## 4. ĐÁNH GIÁ CÁC TRẠNG THÁI GIAO DIỆN (STATE VIEWS & FEEDBACK)

- **Trạng thái đang tải (Loading Skeleton):** Tất cả các trang dữ liệu lớn đều có hiệu ứng skeleton mờ nhạt hoặc con quay tải trang chuẩn (`animate-spin`), không bị tình trạng màn hình trắng xóa (white flicker).
- **Trạng thái rỗng (Empty State):** Khi không có dữ liệu (VD: Không có đơn chờ duyệt, không tìm thấy nhân viên), hệ thống hiển thị icon minh họa kèm thông báo thân thiện: *"Chưa có đơn xin nghỉ phép nào"* hoặc *"Không tìm thấy nhân viên phù hợp"*.
- **Thông báo lỗi (Error Banner):** Lỗi được đóng khung nền đỏ nhạt (`bg-red-50`), có icon cảnh báo và thông điệp giải thích rõ ràng bằng tiếng Việt, không để lộ mã lỗi kỹ thuật như `Uncaught TypeError` hay `500 Internal Server Error`.

---

## 5. PHƯƠNG ÁN ĐƠN GIẢN HÓA HỆ THỐNG (SIMPLIFICATION BLUEPRINT)
Theo nguyên tắc: **Đúng nghiệp vụ - Dễ sử dụng - Ít thao tác - Dữ liệu chính xác**:

1. **Rút gọn các tab tại trang Chấm công (`/attendance`):**
   - *Hiện trạng:* 8 tabs con (`matrix`, `holidays`, `gps`, `devices`, `sessions`, `shifts`, `exceptions`, `summary`).
   - *Đề xuất tinh gọn:* Giảm xuống còn **3 tabs chính**:
     - Tab 1: **Chấm công hằng ngày** (Gộp GPS + Xem công cá nhân cho nhân viên thường).
     - Tab 2: **Bảng công chi tiết Matrix** (Dành cho HR & Quản lý kiểm tra toàn bộ nhân sự).
     - Tab 3: **Thiết lập & Lịch lễ tết** (Dành cho Admin cài đặt ca, lịch nghỉ và kết nối máy).
2. **Tối ưu hóa 1-click Chấm công GPS:**
   - Nếu nhân viên chưa có bản ghi đồng thuận PDPL, hệ thống tự động bật một popup ngắn: *"Bạn có đồng ý chia sẻ định vị GPS để phục vụ chấm công theo quy chế công ty không? [Đồng ý]"*. Sau khi bấm Đồng ý, hệ thống chấm công luôn trong cùng một thao tác.
3. **Tự động nhận diện loại ngày tăng ca (OT):**
   - Loại bỏ trường chọn `WEEKDAY / WEEKEND / HOLIDAY` trên form xin tăng ca. Khi nhân viên chọn ngày, phần mềm tự kiểm tra lịch và điền tự động.
