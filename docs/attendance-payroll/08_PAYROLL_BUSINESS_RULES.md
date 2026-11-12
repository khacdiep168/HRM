# 08 — Quy tắc Nghiệp vụ Tiền lương (Payroll Business Rules)

> Tài liệu chuẩn hóa quy tắc tính lương Phase 3 & 4 cho **Công ty TNHH Thương mại Thế Kỷ Vàng** (Vùng III Tây Ninh, MST `3900336463`).

## 1. Nguyên tắc Versioning (`legal_rule_registry`)
- Mọi hằng số pháp lý (lương tối thiểu vùng, mức tham chiếu BHXH, giảm trừ gia cảnh, biểu thuế TNCN, mức trần miễn thuế ăn ca, hệ số OT) **không được hard-code** trong luồng gọi tính lương.
- `loadLegalRulesForDate(admin, companyId, effectiveDate)` tải các bản ghi có `status = 'APPROVED'` và `effective_from <= effectiveDate <= effective_to`.
- Mỗi lần chạy lương lưu `ruleVersion` và `legal_rule_snapshot` bất biến vào `payroll_runs`.

## 2. Cơ chế 2 Đợt Chi trả (Dual-Run Payroll — `OBD-05`)
1. **Đợt 1 (`MID_MONTH_ADVANCE` — Ngày 15):** Tạm ứng 50% lương cơ bản hợp đồng (`advanceRatio = 0.5`), chưa khấu trừ BHXH và Thuế TNCN.
2. **Đợt 2 (`END_MONTH_SETTLEMENT` — Cuối tháng):** Quyết toán toàn tháng trên công thực tế, phụ cấp, làm thêm giờ, khấu trừ BHXH/BHYT/BHTN, Đoàn phí công đoàn, Thuế TNCN lũy tiến và trừ lại số đã tạm ứng ở Đợt 1.

## 3. Quy tắc Cảnh báo Tự động
- **`BHXH_EXEMPT_MONTH` (`OBD-04`):** Nếu tổng ngày công hưởng lương (`paidDays`) trong tháng `< 14` ngày, gắn cờ cảnh báo miễn/tạm dừng đóng BHXH bắt buộc tháng đó trên bảng lương để C&B kiểm tra.
- **`VARIANCE_OVER_20%` (`OBD-06`):** So sánh `gross_income` kỳ hiện tại với kỳ liền trước (`prevGrossByEmp`); nếu chênh lệch `> 20%`, gắn cờ cảnh báo biến động bất thường trong `explanation_json.warnings` và hiển thị badge trên giao diện `/payroll`.

## 4. Chế độ Chạy thử (Simulation)
- Khi gửi `isSimulation: true` tới `POST /api/v1/payroll/runs`, hệ thống vẫn chạy đầy đủ công thức với `legal_rule_registry`, lưu kết quả với `status = 'DRAFT'` và `legal_rule_snapshot.isSimulation = true` để kiểm tra và đối soát trước khi chốt chính thức (`CALCULATED`).

