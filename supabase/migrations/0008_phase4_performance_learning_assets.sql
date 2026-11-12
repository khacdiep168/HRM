-- ==============================================================================
-- HRM Enterprise - Công ty TNHH Thương mại Thế Kỷ Vàng
-- Migration 0008: Phase 4 Schema (Performance/KPI, Learning & Certifications,
--                 Company Assets & Handover)
-- Target: Supabase PostgreSQL (Project: xtswzywqbizunynahmvl)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- DOMAIN 11: Performance Management (KPI / OKR & Reviews)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.performance_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('DRAFT', 'OPEN', 'CLOSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, code),
  CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  cycle_id UUID NOT NULL REFERENCES public.performance_cycles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  metric_target TEXT,
  weight_percent NUMERIC(5,2) NOT NULL DEFAULT 25.00 CHECK (weight_percent > 0 AND weight_percent <= 100),
  progress_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.performance_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  cycle_id UUID NOT NULL REFERENCES public.performance_cycles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  reviewer_user_id UUID REFERENCES public.users(id),
  self_score NUMERIC(4,2) CHECK (self_score >= 0 AND self_score <= 100),
  manager_score NUMERIC(4,2) CHECK (manager_score >= 0 AND manager_score <= 100),
  final_rating TEXT CHECK (final_rating IN ('A_OUTSTANDING', 'B_EXCEEDS', 'C_MEETS', 'D_NEEDS_IMPROVEMENT')),
  summary_note TEXT,
  status TEXT NOT NULL DEFAULT 'SELF_REVIEW' CHECK (status IN ('SELF_REVIEW', 'MANAGER_REVIEW', 'CALIBRATED', 'FINALIZED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cycle_id, employee_id)
);

-- ------------------------------------------------------------------------------
-- DOMAIN 11B: Learning, Training & Mandatory Compliance Certifications
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'COMPLIANCE' CHECK (category IN ('COMPLIANCE', 'SAFETY', 'OPERATIONS', 'TECHNICAL', 'SOFT_SKILLS')),
  duration_hours NUMERIC(5,2) NOT NULL DEFAULT 2.00,
  is_mandatory BOOLEAN NOT NULL DEFAULT FALSE,
  validity_months INT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS public.training_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'ENROLLED' CHECK (status IN ('ENROLLED', 'IN_PROGRESS', 'COMPLETED', 'FAILED')),
  score NUMERIC(5,2),
  completed_at TIMESTAMPTZ,
  certificate_expires_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, employee_id)
);

-- ------------------------------------------------------------------------------
-- DOMAIN 12: Company Assets & Handover (IT, Keys, Uniforms, POS, Vehicles)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.asset_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  category_id UUID NOT NULL REFERENCES public.asset_categories(id) ON DELETE RESTRICT,
  asset_code TEXT NOT NULL,
  name TEXT NOT NULL,
  serial_no TEXT,
  purchase_value NUMERIC(18,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'RETIRED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, asset_code)
);

CREATE TABLE IF NOT EXISTS public.asset_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  assigned_by UUID REFERENCES public.users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  returned_at TIMESTAMPTZ,
  return_condition TEXT CHECK (return_condition IN ('GOOD', 'DAMAGED', 'LOST')),
  handover_note TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RETURNED'))
);

-- Attach updated_at triggers
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['goals', 'performance_reviews', 'training_enrollments', 'assets']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      tbl, tbl
    );
  END LOOP;
END;
$$;

