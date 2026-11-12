# 21 — LỘ TRÌNH TRIỂN KHAI THEO GIAI ĐOẠN (IMPLEMENTATION PLAN)

## Phase 0 — Audit & Requirement Validation (`HOÀN TẤT AUDIT — CHỜ CHỦ DỰ ÁN XÁC NHẬN OBD`)
- Đối chiếu toàn bộ DB (`0001`–`0010`), API, Engine, UI và Test hiện tại.
- Lập `23_AUDIT_REPORT.md`, `19_LEGAL_RULE_REGISTRY.md`, `20_OPEN_BUSINESS_DECISIONS.md` (`OBD-01` → `OBD-07`).

## Phase 1 — Attendance Foundation (Chuẩn hóa Chấm công & Import Máy)
- Xây dựng Connector & API Import CSV/Excel máy chấm công (`AttendanceImportBatches`, báo lỗi chi tiết, tải file lỗi, import lại không trùng).
- Thuật toán ghép cặp Check-in / Check-out sang `attendance_sessions` (xử lý qua đêm, lọc quét trùng, đánh dấu thiếu vào/ra).
- Tài liệu: `03_ATTENDANCE_WORKFLOW.md`, `04_GPS_ATTENDANCE_SPEC.md`, `05_DEVICE_INTEGRATION_SPEC.md`.

## Phase 2 — Shift, Reconciliation & Exception Approval
- API & UI quản lý Ca làm việc (`shift_templates`), Phân ca (`shift_assignments`), Lịch ngày lễ (`work_calendars`).
- Quy trình Ngoại lệ chấm công (`attendance_exceptions`): Nhân viên gửi → Quản lý duyệt → HR xác nhận → Cập nhật công kèm lưu trước/sau.
- Màn hình đối soát công ngày / tháng tách biệt 5 chỉ số giờ/công.
- Tài liệu: `06_SHIFT_AND_SCHEDULE_RULES.md`, `07_ATTENDANCE_RECONCILIATION.md`.

## Phase 3 — Payroll Configuration & Legal Rule Engine
- Đọc quy tắc từ bảng `legal_rule_versions` thay cho hằng số cứng.
- Hỗ trợ cấu hình hình thức lương (Tháng, Ngày công, Giờ, Ca, Sản phẩm, Hoa hồng, Hỗn hợp).
- Tài liệu: `08_PAYROLL_BUSINESS_RULES.md`, `11_PIT_INSURANCE_RULES.md`.

## Phase 4 — Payroll Calculation Engine (OT + Gross/Net + Versioned Recalculation)
- Bổ sung tính tiền OT (`150%/200%/300%` + đêm) từ `attendance_summaries` vào bảng lương.
- Triển khai `solveNetToGross` cho hợp đồng Net.
- Chế độ chạy thử (`Simulation`), phát hiện sai lệch `>20%`, lưu phiên bản tính lại.
- Tài liệu: `09_PAYROLL_CALCULATION_ENGINE.md`, `10_GROSS_NET_SPECIFICATION.md`.

## Phase 5 — Monthly Payroll, Payslips & Reports
- Trạng thái kỳ lương đầy đủ (`Attendance Pending -> Attendance Confirmed -> Simulation -> Calculated -> Reviewing -> Pending Approval -> Approved -> Locked -> Paid`).
- Xuất PDF phiếu lương cá nhân, báo cáo OT/Phụ cấp/Chênh lệch kỳ.
- Tài liệu: `12_MONTHLY_PAYROLL_WORKFLOW.md`, `13_DATABASE_DESIGN.md`, `14_API_SPECIFICATION.md`, `16_UI_UX_SPECIFICATION.md`.

## Phase 6 — Approval, Security Audit & QA Sign-off
- Tách quyền `SYSTEM_ADMIN` khỏi dữ liệu lương (`OBD-07`), hoàn thiện bộ test case Attendance (12 cases) + Payroll (22 cases) trong `17_TEST_PLAN.md` & `18_TEST_CASES.md`.
- Tài liệu: `15_RBAC_AND_SECURITY.md`, `22_DEPLOYMENT_AND_ROLLBACK.md`.

