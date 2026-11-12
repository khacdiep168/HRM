# 12 — Quy trình Bảng lương Hàng tháng & Phê duyệt Đa cấp (Monthly Payroll Workflow)

## 1. Chuỗi Trạng thái `payroll_runs.status`
1. `DRAFT` — Chạy thử (`isSimulation: true`) để kiểm tra công, phụ cấp, OT và cảnh báo biến động (`>20%` hoặc `BHXH < 14 công`). Không thể trình duyệt từ `DRAFT`.
2. `CALCULATED` — Đợt tính chính thức hoàn tất, sẵn sàng trình Kế toán trưởng.
3. `PENDING_ACCOUNTANT_REVIEW` — Đã trình Kế toán trưởng (`SUBMIT_ACCOUNTANT`).
4. `PENDING_DIRECTOR_APPROVAL` — Kế toán trưởng đã ký kiểm tra (`ACCOUNTANT_REVIEW`, bắt buộc khác người lập theo SoD).
5. `APPROVED` — Giám đốc phê duyệt chi (`DIRECTOR_APPROVE`, bắt buộc khác Kế toán trưởng theo SoD). Cho phép xuất `CSV Ngân hàng`, `CSV Cost Center`, `CSV OT & Biến động`.
6. `LOCKED` — Đã khóa kỳ lương (`LOCK`). Bất biến hoàn toàn: mọi API tính lại đều bị chặn (`409 PAYROLL_PERIOD_LOCKED`).
7. `PAID` — Đã chi chuyển khoản ngân hàng (`MARK_PAID`). Hệ thống tự động phát hành bản ghi `payslips` bất biến (`payload_snapshot`) cho từng nhân viên.

## 2. Truy vết Audit
- Mọi chuyển trạng thái ghi bản ghi vào `audit_events` (`before_data`, `after_data`, `actor_user_id`, `actor_role`).
- Mọi lần xuất file qua `/api/v1/payroll/runs/[id]/export` ghi vào `export_logs` kèm `file_sha256` để đối soát toàn vẹn file chi ngân hàng.

