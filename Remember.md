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

