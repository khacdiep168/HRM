# Remember.md — Project Memory & Phase Tracker

## Current Baseline (Observed 2026-11-12)
- **Existing Docs:** `docs/phase-0/DOC-09`, `DOC-14`, `DOC-15`, `DOC-16`, `DOC-17`, `DOC-19`, `DOC-24` (16/16 Open Decisions `APPROVED` for Thế Kỷ Vàng).
- **Existing Migrations:** `0001` through `0010` (`0010_employee_statutory_ids.sql` written on disk).
- **Existing Automated Tests:** 4 test files, 25/25 tests passing (`vitest run`).
- **Existing Build:** 42/42 Next.js routes compiling (`next build`).

## Active Initiative: Attendance & Automated Payroll Module (`docs/attendance-payroll/`)
- **Phase 0 (Audit & Requirement Validation):** `COMPLETED` (`OBD-01` → `OBD-07` `APPROVED` on `2026-11-12`).
- **Phase 1 (Attendance Foundation):** `COMPLETED` (`session-normalizer.ts`, `/api/v1/attendance/import`, `/api/v1/attendance/normalize`, CSV error export, 5 unit tests).
- **Phase 2 (Shift Management, Reconciliation & Exception Approval):** `COMPLETED` (`/api/v1/attendance/shifts`, `/api/v1/attendance/exceptions`, bulk shift assignment, holiday calendar, locked-period guard + audit trail).
- **Phase 3 & Phase 4 (Payroll Configuration, Legal Rule Registry, OT Pay, Net-to-Gross & Simulation):** `COMPLETED` (`legal-rule-loader.ts`, `calcOvertimePay`, `solveNetToGross` for NET contracts, `isSimulation` DRAFT mode, `BHXH_EXEMPT_MONTH` & `VARIANCE_OVER_20%` warnings, `OVERTIME_PAY` item breakdown, 4 unit tests, docs `08`–`11`).
- **Phase 5 & Phase 6 (Approval Workflow, Bank/OT Export, Payslip Portal & Audit/Hardening):** `COMPLETED` (`transition/route.ts` multi-level SoD + `audit_events` + immutable `payslips`, `export/route.ts` `bank_csv` + `accounting_csv` + `ot_variance_csv` with SHA-256 `export_logs`, 3 unit tests in `phase5-6-workflow.test.ts`, docs `12`–`18` & `22`).
- **Initiative Status:** `ALL PHASES (0–6) COMPLETED` — Ready for UAT & production cutover per `22_DEPLOYMENT_AND_ROLLBACK.md`.
- **Key Architectural Decisions Already Locked (`DOC-24`):**
  - 2-installment payroll (`15th` 50% advance, `end-of-month` settlement, `25th` cutoff).
  - 100% Gross contracts by default (Net-to-Gross solver planned as optional policy).
  - 3-tier allowance resolution (`PERIOD_VARIABLE` > `EMPLOYEE_OVERRIDE` > `DEPARTMENT_POLICY`).
  - Region III minimum wage (`4,140,000` in 2026; `4,450,000` from 01/01/2027).
  - Union dues 1% of BHXH salary (capped at 10% reference level = `253,000 đ` per QĐ 1408/QĐ-TLĐ 2024) + ER union fee 2%.

## Transformation Initiative: Practical HRM Enterprise for Thế Kỷ Vàng (Steps 0 – 6)
- **Bước 0 (Audit & Roadmap):** `COMPLETED` (`docs/AUDIT.md` comprehensive repo scan).
- **Bước 1 (Navigation & Feature Flags):** `COMPLETED` (5 activity-based menu groups, 5 inactive modules hidden behind flags, auth middleware guard).
- **Bước 2 (Core Flows & Approvals):** `COMPLETED` (Mobile ESS, unified `/approvals` with schema fix for `overtime_requests`, 5-step payroll with secure unlock, transparent payslips).
- **Bước 3 (Legal Compliance & Decimal Engine):** `COMPLETED` (`docs/LEGAL_PARAMS.md`, VN-2026-H2 rules, `decimal-engine.ts`, 15 statutory tests).
- **Bước 4 (UX, StateViews & i18n):** `COMPLETED` (Skeleton/Empty/Error states, standard Vietnamese formatting, 390px mobile responsiveness).
- **Bước 5 (Data Privacy & Security Scoping):** `COMPLETED` (Server-side RBAC scoping, PII protection, audit trail, rate limit, anti-buddy punch).
- **Bước 6 (Simulation & Verification):** `COMPLETED` (`scripts/seed-enterprise-50.mjs` with 50 staff & 3 months data, 56/56 automated tests passing, `docs/USER_GUIDE.md`, `docs/CHANGELOG.md`).
- **Bước 7 (User Management, RBAC Assignment & Password Controls):** `COMPLETED` (16/11/2026):
  - API `/api/v1/admin/users`: Tạo User Supabase Auth, liên kết Employee, gán Role RBAC (`SUPER_ADMIN`, `HR_ADMIN`, `DIRECTOR`, `ACCOUNTANT`, `DEPARTMENT_MANAGER`, `HR_STAFF`, `EMPLOYEE`, `AUDITOR`), đặt lại mật khẩu, khóa/mở khóa tài khoản.
  - API `/api/v1/auth/change-password`: Cho phép người dùng tự đổi mật khẩu cá nhân với xác thực mật khẩu hiện tại.
  - Trang `/admin/users`: Giao diện quản lý người dùng, tìm kiếm, lọc theo vai trò/trạng thái, modal tạo user, modal phân quyền vai trò đa chọn, modal đổi mật khẩu.
  - Header & Sidebar `AppShell`: Nút "Đổi pass" và Modal đổi mật khẩu nhanh cho người dùng đang đăng nhập.



