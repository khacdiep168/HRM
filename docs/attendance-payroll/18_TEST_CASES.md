# 18 — Danh mục Ca Kiểm thử (Test Cases)

## 1. Phân hệ Chấm công (`Attendance`)
- `TC-ATT-01`..`05` (`session-normalizer.test.ts`): Ghép cặp Check-in/Check-out chuẩn, lọc quét trùng, đánh dấu `MISSING_OUT`, `MISSING_IN`, và xử lý ca làm việc qua đêm (bắt đầu ngày hôm trước, kết thúc ngày hôm sau).
- `TC-ATT-06`..`09` (`attendance-and-allowances.test.ts`): Tổng hợp công, quy tắc đi trễ/về sớm, và tính phụ cấp 3 cấp.
- `TC-LVE-01`..`04` (`leave-and-ot.test.ts`): Nghỉ phép hưởng lương, nghỉ không lương, OT và quỹ phép năm.

## 2. Phân hệ Tiền lương, Quy tắc Pháp lý & Bảo mật (`Payroll & Security`)
- `TC-PAY-01`..`12` (`golden-payroll.test.ts`): Bộ test chuẩn tính lương Gross, BHXH/BHYT/BHTN (sàn Vùng III, trần 20×), miễn thuế ăn ca, thuế TNCN lũy tiến 5 bậc, đoàn phí 1% / kinh phí CĐ 2%, tạm ứng Đợt 1 & quyết toán Đợt 2.
- `TC-P34-01`..`04` (`phase3-4-engine.test.ts`): Nạp `legal_rule_registry` theo ngày hiệu lực (`2026` vs `2027`, bỏ qua `DRAFT`), tính `calcOvertimePay` (`150%/200%/300% + 30%` đêm), `solveNetToGross` hội tụ `≤ 1 VNĐ`, và `OBD-07` chặn `SUPER_ADMIN`.
- `TC-P56-01`..`03` (`phase5-6-workflow.test.ts`): Separation of Duties (`assertNotSelfApproval`), chặn toàn bộ quyền `PAYROLL` của `SUPER_ADMIN`, chống CSV formula injection & xuất `BankTransfer` / `CostCenterJournal`.
- `TC-SEC-01`..`05` (`security.test.ts`): Mã hóa AES-256-GCM PII & kiểm soát truy cập.

