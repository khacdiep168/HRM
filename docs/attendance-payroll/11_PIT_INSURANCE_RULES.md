# 11 — Quy tắc Bảo hiểm, Công đoàn & Thuế TNCN (PIT & Insurance Rules)

## 1. Bảo hiểm Bắt buộc (BHXH / BHYT / BHTN)
- **Mức sàn:** Không thấp hơn Lương tối thiểu vùng theo `regionCode` (Thế Kỷ Vàng: Vùng III — `4,160,000 VNĐ` theo `VN-2026-H2`).
- **Mức trần BHXH/BHYT:** `20 × bhxhReferenceLevel` (`20 × 2,340,000 = 46,800,000 VNĐ`).
- **Mức trần BHTN:** `20 × regionalMinWage[regionCode]`.
- **Tỷ lệ đóng:**
  - NLĐ (`10.5%`): `8%` BHXH + `1.5%` BHYT + `1%` BHTN.
  - DN (`21.5%`): `17.5%` BHXH + `3%` BHYT + `1%` BHTN.

## 2. Kinh phí & Đoàn phí Công đoàn
- **Đoàn phí NLĐ (`eeUnionDues`):** `1%` quỹ lương làm căn cứ đóng BHXH (tối đa `10%` mức lương cơ sở / tham chiếu).
- **Kinh phí CĐ DN (`erUnionFee`):** `2%` quỹ lương làm căn cứ đóng BHXH.

## 3. Thuế Thu nhập Cá nhân (PIT 2026 — 5 Bậc Lũy tiến)
- **Giảm trừ bản thân:** `15,500,000 VNĐ/tháng` (theo rule version `VN-2026-H2` nạp từ `legal_rule_registry`).
- **Giảm trừ người phụ thuộc:** `6,200,000 VNĐ/người/tháng`.
- **Thu nhập miễn thuế:** Khoản ăn trưa trong hạn mức (`lunchCashExemptCap`), phụ cấp điện thoại/xăng xe theo định mức và phần chênh lệch OT vượt `100%`.
- **Phân quyền (`OBD-07`):** `SUPER_ADMIN` không có quyền truy cập `PAYROLL`; chỉ `HR_ADMIN`, `PAYROLL_ADMIN`, `FINANCE_MANAGER` và nhân sự được phân quyền mới xem/chạy/khóa bảng lương.

