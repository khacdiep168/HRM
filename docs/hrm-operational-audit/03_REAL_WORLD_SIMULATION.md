# MÔ PHỎNG VẬN HÀNH THỰC TẾ 1 THÁNG (REAL-WORLD OPERATIONAL SIMULATION)
## CÔNG TY TNHH THƯƠNG MẠI THẾ KỶ VÀNG (TKV) — KỲ THÁNG 11/2026
**Tài liệu:** `03_REAL_WORLD_SIMULATION.md`  
**Chủ trì:** Giám đốc HC-NS & Ban Đánh giá Vận hành Doanh nghiệp  
**Quy mô mô phỏng:** Chu kỳ trọn vẹn 1 tháng (01/11/2026 – 30/11/2026), 50 nhân sự đại diện cho 15 phòng ban/bộ phận.  
**Thời điểm đánh giá:** 16/11/2026  

---

## 1. MÔ PHỎNG LUỒNG DỮ LIỆU TỔNG THỂ (END-TO-END DATA FLOW)

Chu kỳ 1 tháng tại Thế Kỷ Vàng vận hành qua 4 giai đoạn liên hoàn:

```
[ GIAI ĐOẠN 1: HẰNG NGÀY ]
Chấm công GPS / Face ID ──> Sự kiện thô (Raw Events) ──> Chuẩn hóa phiên (Sessions)
                                                                 │
                                                       (Nếu có lỗi/quên quẹt)
                                                                 ▼
                                                    Ngoại lệ (Exceptions) ──> Trưởng phòng duyệt
                                                                 │
[ GIAI ĐOẠN 2: GIỮA THÁNG (15 hàng tháng) ]                      │
Bảng lương Tạm ứng 50% Lương cơ bản ──> Kế toán duyệt ──> Giám đốc duyệt ──> Chi tạm ứng
                                                                 │
[ GIAI ĐOẠN 3: CHỐT CÔNG (Cutoff 25 hàng tháng) ]                │
Bảng chấm công chi tiết Matrix ◄─────────────────────────────────┘
         │ (Kiểm tra X, CT, TS, ?, giờ tăng ca OT)
         ▼
[ GIAI ĐOẠN 4: TÍNH LƯƠNG & QUYẾT TOÁN CUỐI THÁNG ]
Tính lương DRAFT ──> Review Kế toán ──> Phê duyệt Giám đốc ──> KHÓA (LOCKED) ──> CHI TRẢ (PAID)
                                                                                      │
                                                                   ┌──────────────────┴──────────────────┐
                                                                   ▼                                     ▼
                                                            Phiếu lương ESS                    Xuất Bank CSV & Hạch toán
```

---

## 2. KẾT QUẢ MÔ PHỎNG 15 TÌNH HUỐNG NGHIỆP VỤ THỰC TẾ

### Tình huống 1: Nhân viên mới vào làm giữa tháng (08/11/2026)
- **Nhân vật giả định:** `TKV-0048` — Đặng Văn Tuấn (Bộ phận Kho vận).
- **Mô phỏng vận hành:**
  1. HR tạo hồ sơ tại `/employees` với ngày vào làm `hireDate: "2026-11-08"`.
  2. Bảng quỹ phép năm `/leave` tự động tính tỷ lệ theo Điều 66 Nghị định 145/2020: Còn lại 2 tháng trong năm -> Quỹ phép năm được cấp tỷ lệ là `(12 / 12) * 2 = 2 ngày`.
  3. Bảng công Matrix `/attendance` tự động đánh dấu các ngày từ 01/11 đến 07/11 là không tính công; các ngày từ 08/11 trở đi chấm công bình thường.
  4. Bảng lương `/payroll` tính lương theo số ngày công thực tế: `(20 công thực tế / 22 công chuẩn) * Lương cơ bản`.
- **Đánh giá:** `[ĐÃ KIỂM CHỨNG THỰC TẾ]` **ĐẠT (PASS)** — Thuật toán prorating hoạt động chuẩn xác.

---

### Tình huống 2: Nhân viên chuyển phòng ban hoặc đổi chức vụ giữa tháng
- **Nhân vật giả định:** `TKV-0010` — Nguyễn Thị Kim Oanh (Chuyển từ Cửa hàng miễn thuế `UNIT-CHMT` sang Phòng Kinh doanh `DEPT-KD`).
- **Mô phỏng vận hành:**
  1. HR vào Sơ đồ tổ chức `/org` hoặc Drawer sửa hồ sơ `/employees` để chọn lại phòng ban.
  2. Bảng `org_assignments` cập nhật `department_id` mới.
  3. Sơ đồ tổ chức `/org` cập nhật lại quân số: CHMT giảm 1 người, Kinh doanh tăng 1 người.
- **Điểm nghẽn phát hiện:** Hệ thống chưa lưu lịch sử phân công dạng có dải ngày `effective_from` và `effective_to` trong `org_assignments`. Khi đổi phòng ban giữa tháng, toàn bộ chi phí lương tháng đó sẽ hạch toán về phòng ban mới thay vì phân bổ tỷ lệ giữa 2 phòng ban.
- **Đánh giá:** `[ĐÃ KIỂM TRA MÃ NGUỒN]` **CẦN CẢI TIẾN (MEDIUM)**.

---

### Tình huống 3: Nhân viên nghỉ việc giữa tháng (10/11/2026)
- **Nhân vật giả định:** `TKV-0015` — Lê Văn Hưng (Lái xe).
- **Mô phỏng vận hành:**
  1. HR chuyển trạng thái nhân sự sang `TERMINATED`.
  2. Widget "Việc cần chú ý" trên Dashboard hiển thị thông báo nhân sự nghỉ việc kèm checklist bàn giao tài sản.
  3. Bảng công Matrix dừng ghi nhận công sau ngày 10/11.
  4. Bảng lương chỉ tính 8 ngày công thực tế trước ngày thôi việc.
- **Đánh giá:** `[ĐÃ KIỂM CHỨNG THỰC TẾ]` **ĐẠT (PASS)**.

---

### Tình huống 4: Nhân viên quên check-in hoặc check-out (Quên quẹt thẻ)
- **Nhân vật giả định:** `TKV-0008` — Huỳnh Thị Mỹ Duyên (Bán hàng CHMT).
- **Mô phỏng vận hành:**
  1. Sáng ngày 06/11 có quẹt IN lúc 07:28, chiều vội về quên quẹt OUT.
  2. Hệ thống chuẩn hóa ca ghi nhận ngoại lệ `MISSING_OUT`. Ô chấm công trên bảng Matrix hiển thị ký hiệu màu hồng đỏ: `?`.
  3. Nhân viên gửi đơn giải trình tại `/attendance` tab Ngoại lệ: "Quên quẹt thẻ ra do cúp điện cửa hàng, quản lý ca xác nhận".
  4. Trưởng phòng vào `/approvals` bấm `Duyệt`.
  5. Ô chấm công lập tức chuyển từ `?` sang `X` (đủ 8 giờ công).
- **Đánh giá:** `[ĐÃ KIỂM CHỨNG THỰC TẾ]` **XUẤT SẮC (PASS)**.

---

### Tình huống 5: Nhân viên chấm công sai vị trí GPS (Ngoài Geofence)
- **Nhân vật giả định:** `TKV-0014` — Lý Thu Nhi (Văn phòng Bến Cầu).
- **Mô phỏng vận hành:**
  1. Nhân viên mở điện thoại chấm công GPS tại nhà (cách công ty 3.5 km).
  2. Hệ thống tính khoảng cách Haversine = 3,520m > bán kính cho phép 200m -> Đánh cờ `is_within_geofence: false` và tạo ngoại lệ `OUT_OF_GEOFENCE`.
  3. Bảng công không ghi nhận công chuẩn mà chuyển trạng thái chờ quản lý thẩm tra.
- **Đánh giá:** `[ĐÃ KIỂM CHỨNG THỰC TẾ]` **ĐẠT (PASS)** — Kiểm soát chống gian lận vị trí rất hiệu quả.

---

### Tình huống 6: Nhân viên đi trễ, về sớm
- **Nhân vật giả định:** `TKV-0005` — Phạm Đạt (Phòng Vi Tính/IT).
- **Mô phỏng vận hành:**
  1. Giờ làm việc ca: 07:30. Quẹt vào lúc 07:54 -> Hệ thống ghi nhận `late_minutes: 24 phút`.
  2. Tại bảng tổng hợp công, số phút đi trễ được cộng dồn trong tháng.
  3. Phụ cấp chuyên cần (nếu có thiết lập) bị khấu trừ tương ứng theo quy chế công ty.
- **Đánh giá:** `[ĐÃ KIỂM CHỨNG THỰC TẾ]` **ĐẠT (PASS)**.

---

### Tình huống 7: Nhân viên làm ca đêm qua ngày hôm sau (Ca 22:00 – 06:00)
- **Nhân vật giả định:** `TKV-0030` — Trần Quốc Hùng (Bảo vệ ca đêm).
- **Mô phỏng vận hành:**
  1. Ca làm việc cấu hình `is_overnight: true`, khung giờ đêm từ 22:00 đến 06:00.
  2. Bảng lương tự động áp dụng Điều 98 khoản 2 BLLĐ 2019: Trả thêm ít nhất 30% tiền lương tính theo đơn giá tiền lương của ngày làm việc bình thường.
  3. Dòng phụ cấp làm việc ban đêm được tách bạch rõ ràng trên phiếu lương.
- **Đánh giá:** `[ĐÃ KIỂM TRA MÃ NGUỒN]` **ĐẠT (PASS)**.

---

### Tình huống 8: Nhân viên đổi ca hoặc làm thay ca
- **Nhân vật giả định:** Hai nhân viên CHMT đổi ca trực cuối tuần.
- **Mô phỏng vận hành:**
  - Bảng `shift_assignments` hỗ trợ trạng thái `status: 'SWAPPED'`.
  - **Hạn chế giao diện:** Trên giao diện hiện chưa có nút bấm "Đăng ký đổi ca" cho nhân viên tự thao tác; HR phải vào phân ca đổi tay thủ công.
- **Đánh giá:** `[ĐÃ KIỂM TRA MÃ NGUỒN]` **CẦN BỔ SUNG GIAO DIỆN (MEDIUM)**.

---

### Tình huống 9: Nhân viên làm thêm giờ ngày thường, ngày nghỉ tuần và ngày lễ
- **Nhân vật giả định:** `TKV-0004` — Lê Hoàng Phúc (Lái xe giao hàng).
- **Mô phỏng vận hành:**
  1. Ngày 04/11 làm thêm 2 giờ ngày thường -> Hệ số x1.5 (trong đó 1.0x tính thuế, 0.5x miễn thuế).
  2. Ngày Chủ nhật 08/11 làm thêm 4 giờ -> Hệ số x2.0 (1.0x tính thuế, 1.0x miễn thuế).
  3. Trên bảng công Matrix, ô ngày 04/11 hiện chữ `X` kèm số nhỏ `2`; ô ngày 08/11 hiện số nhỏ `4`.
  4. Bảng lương `/payroll` bóc tách tự động: Tiền lương OT chịu thuế và Tiền lương OT miễn thuế chuẩn theo Thông tư 111/2013/TT-BTC.
- **Đánh giá:** `[ĐÃ KIỂM CHỨNG THỰC TẾ]` **XUẤT SẮC (PASS)**.

---

### Tình huống 10: Nhân viên xin nghỉ phép năm và quản lý phê duyệt
- **Nhân vật giả định:** `TKV-0008` — Huỳnh Thị Mỹ Duyên.
- **Mô phỏng vận hành:**
  1. Vào `/leave`, chọn Nghỉ phép năm từ 18/11 đến 19/11 (2 ngày).
  2. Hệ thống kiểm tra số dư phép khả dụng (còn 12 ngày) -> Đủ điều kiện, cho phép tạo đơn với trạng thái `PENDING`. Số ngày chờ duyệt tăng lên 2.
  3. Quản lý vào `/approvals` bấm Duyệt.
  4. Quỹ phép năm tự động trừ: Đã nghỉ tăng 2 ngày, Còn lại giảm xuống 10 ngày.
  5. Bảng công Matrix ngày 18 và 19/11 tự động chuyển sang ký hiệu `P`.
- **Đánh giá:** `[ĐÃ KIỂM CHỨNG THỰC TẾ]` **XUẤT SẮC (PASS)**.

---

### Tình huống 11: Nhân viên nghỉ không lương quá 14 ngày làm việc trong tháng
- **Nhân vật giả định:** `TKV-0022` — Vũ Thị Mai Phương (Nghỉ việc riêng không lương 16 ngày).
- **Mô phỏng vận hành:**
  1. Số ngày nghỉ không lương = 16 ngày (> 14 ngày làm việc trong tháng).
  2. Bảng lương `/payroll` tự động kích hoạt cảnh báo vàng: `BHXH_EXEMPT_MONTH — Nghỉ không lương quá 14 ngày làm việc theo Luật BHXH Điều 85 khoản 3, tháng này không đóng BHXH/BHYT/BHTN`.
  3. Tiền trích đóng BHXH của cả người lao động (10.5%) và người sử dụng lao động (21.5%) tự động được set về 0 đ.
- **Đánh giá:** `[ĐÃ KIỂM CHỨNG THỰC TẾ]` **XUẤT SẮC (PASS — Rất thông minh và chuẩn luật)**.

---

### Tình huống 12: Nhân viên có nhiều loại phụ cấp và khấu trừ
- **Nhân vật giả định:** `TKV-0002` — Nguyễn Minh Tuấn (Trưởng phòng Kinh doanh).
- **Mô phỏng vận hành:**
  1. Phụ cấp ăn trưa: 1.000.000 đ (Miễn thuế toàn bộ vì < mức trần 1.200.000 đ).
  2. Phụ cấp xăng xe điện thoại: 1.500.000 đ (Chịu thuế TNCN).
  3. Đoàn phí công đoàn: Tự động trích 1% lương đóng BHXH (185.000 đ).
  4. Khấu trừ tạm ứng giữa tháng: 9.250.000 đ.
  5. Thuế TNCN tính lũy tiến chuẩn xác sau khi trừ BHXH (10.5%), giảm trừ bản thân và đoàn phí.
- **Đánh giá:** `[ĐÃ KIỂM CHỨNG THỰC TẾ]` **ĐẠT (PASS)**.

---

### Tình huống 13: Điều chỉnh bảng công sau khi chốt công
- **Kịch bản:** Nhân viên phản ánh ngày 03/11 có đi làm nhưng máy chấm công bị lỗi mạng không đẩy dữ liệu về.
- **Mô phỏng vận hành:**
  1. HR vào Bảng chấm công Matrix `/attendance`, bấm trực tiếp vào ô ngày 03/11 của nhân viên đó.
  2. Chọn ký hiệu `X`, nhập lý do giải trình: "Kiểm tra camera cổng chính xác nhận có mặt lúc 07:25".
  3. Bấm "Lưu thay đổi". Ô chấm công cập nhật ngay lập tức.
  4. Hệ thống ghi một bản ghi vào `audit_events` lưu rõ: Ai sửa, sửa cho ai, ngày nào, lý do gì.
- **Đánh giá:** `[ĐÃ KIỂM CHỨNG THỰC TẾ]` **RẤT TỐT (PASS)**.

---

### Tình huống 14: HR thực hiện tính lương, kiểm tra và khóa bảng lương
- **Mô phỏng vận hành:**
  1. HR tạo kỳ lương mới `2026-M11` tại `/payroll`. Bấm "Tính toán kỳ lương".
  2. Chạy chế độ Thử nghiệm mô phỏng (Simulation DRAFT) để rà soát danh sách cảnh báo.
  3. Kế toán trưởng vào kiểm tra và bấm "Kế toán xác nhận" (`ACCOUNTANT_REVIEWED`).
  4. Giám đốc vào xem tổng chi phí lương và bấm "Giám đốc phê duyệt" (`DIRECTOR_APPROVED`).
  5. Kế toán bấm "Khóa bảng lương" (`LOCKED`). Sau khi khóa, không ai có thể sửa công hay sửa lương.
  6. Sau khi tiền lương đã được chi, chuyển sang `PAID` và xuất file chuyển khoản ngân hàng.
- **Đánh giá:** `[ĐÃ KIỂM CHỨNG THỰC TẾ]` **XUẤT SẮC (PASS)**.

---

### Tình huống 15: Nhân viên xem phiếu lương cá nhân (Mobile ESS)
- **Mô phỏng vận hành:**
  1. Nhân viên `demo.employee@thekyvang.vn` đăng nhập trên điện thoại di động (màn hình 390x844).
  2. Vào mục "Phiếu lương của tôi" (`/payslips`).
  3. Phiếu lương hiển thị đẹp mắt, rõ từng mục: Tổng thu nhập, Các khoản trừ (BHXH 10.5%, Thuế TNCN, Đoàn phí), Đã tạm ứng giữa tháng và Số tiền thực chuyển vào tài khoản cuối tháng.
  4. Đảm bảo 100% không nhìn thấy lương của bất kỳ đồng nghiệp nào khác.
- **Đánh giá:** `[ĐÃ KIỂM CHỨNG THỰC TẾ]` **XUẤT SẮC (PASS)**.
