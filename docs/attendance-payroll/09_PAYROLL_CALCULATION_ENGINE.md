# 09 — Kiến trúc Bộ máy Tính lương (Payroll Calculation Engine)

## 1. Thành phần cốt lõi
- `src/lib/payroll/decimal-engine.ts`: Sử dụng `Decimal.js` (`ROUND_HALF_UP`, precision 20) để tránh sai số dấu phẩy động IEEE-754.
- `src/lib/payroll/legal-rule-loader.ts`: `buildLegalRuleConfigFromRows` và `loadLegalRulesForDate` nạp quy tắc pháp lý đã phê duyệt theo ngày hiệu lực (`settlement_pay_date` / `end_date`).
- `src/app/api/v1/payroll/runs/route.ts`: API điều phối quy trình chạy lương hàng loạt hoặc từng nhân viên.

## 2. Công thức Lương Thời gian & Làm thêm giờ (`calcOvertimePay`)
1. **Đơn giá giờ chuẩn:**
   `hourlyRate = baseSalary / standardDays / hoursPerDay` (mặc định `hoursPerDay = 8`).
2. **Tiền làm thêm giờ (`OVERTIME_PAY`):**
   - Ngày thường: `weekdayHours × hourlyRate × 1.5`
   - Ngày nghỉ hàng tuần: `weekendHours × hourlyRate × 2.0`
   - Ngày lễ/Tết: `holidayHours × hourlyRate × 3.0`
   - Phụ trội làm đêm: `nightHours × hourlyRate × 0.3`
3. **Phần chênh lệch OT miễn thuế TNCN:** Phần vượt trên `100%` đơn giá giờ thường được ghi nhận vào `tax_exempt_amount` trên `payroll_items` (`tier_source = 'STATUTORY_OT'`).

## 3. Truy vết & Giải trình (`payroll_items` & `explanation_json`)
- Mỗi dòng lương lưu chi tiết: `BASE_SALARY`, từng khoản phụ cấp/thưởng theo cấp bậc (`CONTRACT` / `POSITION` / `COMPANY`), và `OVERTIME_PAY`.
- `explanation_json` lưu `runType`, `ruleVersion`, `payStructure`, `isSimulation`, `paidDays`, `standardDays`, `otPay`, `eeUnionDues`, `unionFeeEr`, và `warnings`.

