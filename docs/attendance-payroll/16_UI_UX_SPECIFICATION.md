# 16 — Đặc tả Giao diện Người dùng (UI/UX Specification)

## 1. Phân hệ Chấm công (`/attendance`)
- **Tab Dữ liệu & Tổng hợp:** Theo dõi công thực tế, đi muộn, về sớm, OT, làm đêm, thiếu dữ liệu.
- **Tab Import & Chuẩn hóa:** Upload file CSV/Excel máy chấm công, xem thống kê thành công/lỗi, tải file dòng lỗi về sửa, kích hoạt ghép cặp `attendance_sessions`.
- **Tab Ca làm việc & Lịch lễ:** Quản lý mẫu ca, phân ca hàng loạt theo nhân viên/phòng ban và cấu hình ngày lễ.
- **Tab Giải trình & Ngoại lệ:** Gửi yêu cầu bổ sung công / GPS ngoài vùng và quy trình duyệt 2 bước (Quản lý -> HR).

## 2. Phân hệ Tiền lương (`/payroll`)
- **Bảng điều khiển Chạy lương:** Nút `Chạy Đợt 1 (Ngày 15 • 50% CB)`, `Chạy thử (Simulation)`, `Chạy Đợt 2 (Cuối tháng)`, và tính riêng lẻ cho từng nhân viên kèm mở/in phiếu lương.
- **Bảng Tổng hợp & Cảnh báo:** Hiển thị số công (`thực tế / chuẩn`), nghỉ phép hưởng lương, nghỉ không lương, phép năm còn lại, lương cơ bản, phụ cấp, Gross, BHXH/TNCN/Đoàn phí, tạm ứng và Net thực nhận; tự động gắn badge cảnh báo `BHXH <14 công` và `Biến động >20%`.
- **Phê duyệt & Xuất báo cáo:** Nút chuyển trạng thái theo vai trò (`Trình KT`, `KT kiểm tra`, `GĐ duyệt`, `Khóa kỳ`, `Xác nhận Đã chi CK`) và 3 nút xuất `CSV Ngân hàng`, `CSV Cost Center`, `CSV OT & Biến động`.

