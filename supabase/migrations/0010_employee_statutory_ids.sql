-- ==============================================================================
-- HRM Enterprise - Công ty TNHH Thương mại Thế Kỷ Vàng
-- Migration 0010: Statutory IDs (BHXH, BHYT, MST TNCN, Công đoàn) on employees
-- Target: Supabase PostgreSQL (Project: xtswzywqbizunynahmvl)
-- ==============================================================================

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS social_insurance_no VARCHAR(20),
  ADD COLUMN IF NOT EXISTS health_insurance_no VARCHAR(20),
  ADD COLUMN IF NOT EXISTS pit_tax_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS is_union_member BOOLEAN NOT NULL DEFAULT TRUE;

