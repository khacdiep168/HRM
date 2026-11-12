# THAM SỐ PHÁP LÝ TIỀN LƯƠNG & BẢO HIỂM (`LEGAL_PARAMS.md`)

> Áp dụng cho **Công ty TNHH Thương mại Thế Kỷ Vàng** (MST: `3900336463`, Vùng III — Tây Ninh).
> Mọi tham số dưới đây được lưu phiên bản hóa trong bảng `legal_rule_registry` theo `effective_from` / `effective_to`, **không hard-code** trong luồng gọi tính lương.

---

## 1. Lương Tối thiểu Vùng (Vùng III — Tây Ninh)
- **Mức hiện đang cấu hình trong `VN_2026_H2_RULES`:** `4.160.000 ₫/tháng` *(Nghị định 74/2024/NĐ-CP quy định Vùng III = `3.860.000 ₫/tháng` từ 01/07/2024; các mức tăng từ 2026/2027 đang chờ nghị định mới)*.
- **Trạng thái:** `CẦN KẾ TOÁN XÁC NHẬN` mức lương tối thiểu Vùng III chính thức áp dụng cho kỳ `2026-11` (`3.860.000 ₫` hay mức điều chỉnh mới `4.160.000 ₫` / `4.450.000 ₫`).

## 2. Bảo hiểm Bắt buộc (BHXH, BHYT, BHTN)
- **Căn cứ:** Luật Bảo hiểm xã hội `41/2024/QH15` (hiệu lực từ `01/07/2025`), Luật Việc làm & Luật BHYT.
- **Tỷ lệ đóng (NLĐ `10,5%` | NSDLĐ `21,5%`):**
  - BHXH: NLĐ `8%` | NSDLĐ `17,5%` (`14%` hưu trí tử tuất + `3%` ốm đau thai sản + `0,5%` TNLĐ-BNN)
  - BHYT: NLĐ `1,5%` | NSDLĐ `3%`
  - BHTN: NLĐ `1%` | NSDLĐ `1%`
- **Mức tham chiếu đóng BHXH/BHYT:** `2.340.000 ₫` (theo mức lương cơ sở từ 01/07/2024; Luật BHXH 2024 dùng khái niệm *mức tham chiếu* do Chính phủ quy định).
  - Trần BHXH/BHYT (`20 × mức tham chiếu`): `46.800.000 ₫/tháng`.
  - Trần BHTN (`20 × LTT Vùng III`): `20 × LTTV`.
- **Nghỉ không lương / không hưởng lương từ `>= 14` ngày làm việc trong tháng:** Tạm dừng đóng BHXH bắt buộc tháng đó (`BHXH_EXEMPT_MONTH`).

## 3. Làm thêm giờ & Làm việc ban đêm
- **Căn cứ:** Điều 98 Bộ luật Lao động `45/2019/QH14` (hiệu lực `01/01/2021`).
- **Hệ số tối thiểu:**
  - Ngày làm việc bình thường: `150%`
  - Ngày nghỉ hàng tuần: `200%`
  - Ngày nghỉ lễ, Tết, ngày nghỉ có hưởng lương: `300%` (chưa bao gồm tiền lương ngày lễ đối với NLĐ hưởng lương ngày)
  - Phụ trội làm việc ban đêm (`22:00` – `06:00`): `+30%` đơn giá giờ bình thường.
- **Thuế TNCN phần OT:** Phần thu nhập làm thêm giờ trả cao hơn so với làm việc bình thường được miễn thuế TNCN (`tax_exempt_amount`).

## 4. Thuế Thu nhập Cá nhân (TNCN) & Giảm trừ Gia cảnh
- **Mức giảm trừ gia cảnh đang cấu hình trong `VN_2026_H2_RULES`:**
  - Giảm trừ bản thân: `15.500.000 ₫/tháng` *(theo Nghị quyết `954/2020/UBTVQH14` trước đây là `11.000.000 ₫/tháng`; nếu áp dụng mức điều chỉnh mới 2026 là `15.500.000 ₫` thì cần văn bản hiệu lực chính thức)*.
  - Giảm trừ người phụ thuộc: `6.200.000 ₫/người/tháng` *(Nghị quyết `954/2020/UBTVQH14` trước đây là `4.400.000 ₫`)*.
  - Biểu thuế lũy tiến đang cấu hình: `5` bậc (`5%`, `10%`, `20%`, `30%`, `35%`).
- **Trạng thái:** `CẦN KẾ TOÁN XÁC NHẬN` văn bản pháp quy & ngày hiệu lực chính thức cho mức giảm trừ gia cảnh (`11tr/4.4tr` hay `15.5tr/6.2tr`) và biểu thuế `5` bậc vs `7` bậc trước khi chốt quyết toán thuế năm.
- **Thử việc / Hợp đồng dưới 3 tháng:** Khấu trừ `10%` trên tổng thu nhập từ `2.000.000 ₫/lần` trở lên (`FLAT_10`) nếu không có cam kết mẫu 08/CK-TNCN.

## 5. Kinh phí & Đoàn phí Công đoàn
- **Kinh phí Công đoàn NSDLĐ (`2%` quỹ tiền lương làm căn cứ đóng BHXH):** Luật Công đoàn `50/2024/QH15` (hiệu lực `01/07/2025`).
- **Đoàn phí Công đoàn NLĐ (`1%` tiền lương làm căn cứ đóng BHXH, tối đa `10%` mức lương cơ sở = `234.000 ₫` hoặc `253.000 ₫` theo cấu hình):** `CẦN KẾ TOÁN XÁC NHẬN` mức trần đoàn phí áp dụng nội bộ (`234.000 ₫` theo `2.340.000 × 10%` hay `253.000 ₫` theo QĐ 1408/QĐ-TLĐ).

