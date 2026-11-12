# AGENTS.md — HRM Enterprise (Thế Kỷ Vàng)

## 1. Project Context
- **Product:** HRM Enterprise — Công ty TNHH Thương mại Thế Kỷ Vàng (MST: `3900336463`, Vùng III Tây Ninh).
- **Tech Stack:** Next.js 16 (App Router, TypeScript), Tailwind CSS, Supabase PostgreSQL (RLS + AES-256-GCM PII encryption), Vitest, `decimal.js`.
- **Supabase Project:** `xtswzywqbizunynahmvl`.

## 2. Mandatory Working Principles
1. **No destructive migrations or live device/payroll side effects** without explicit owner approval.
2. **No hardcoded business/legal constants** in new logic — all statutory rules (BHXH/BHYT/BHTN, PIT brackets, deductions, OT multipliers) must reference versioned rules (`legal_rule_versions`) with source, effective date, and approval status.
3. **Immutable raw data:** Never overwrite or delete `attendance_raw_events` or `LOCKED`/`PAID` `payroll_runs`.
4. **RBAC & Security:** Enforce authorization in server API routes (`resolveAuthContext` + `assertAuthorized`) and PostgreSQL RLS; never rely on UI hiding alone.
5. **Verification:** Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` after code changes; report only observed outputs (`PASS`, `FAIL`, `NOT TESTED`, `BLOCKED`, `NEEDS REVIEW`).
6. **Documentation:** Keep `Remember.md` and `docs/attendance-payroll/` synchronized across phases.

