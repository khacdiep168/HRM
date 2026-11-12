-- ==============================================================================
-- HRM Enterprise - Công ty TNHH Thương mại Thế Kỷ Vàng
-- Migration 0006: Phase 3 Schema (Leave Management, Overtime 40h/200h-300h,
--                 Recruitment ATS, Lifecycle Checklists & Approval Delegations)
-- Target: Supabase PostgreSQL (Project: xtswzywqbizunynahmvl)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- DOMAIN 7: Leave & Overtime Management (Vietnam Labor Code 2019)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  is_paid BOOLEAN NOT NULL DEFAULT TRUE,
  si_benefit_paid BOOLEAN NOT NULL DEFAULT FALSE,
  requires_document BOOLEAN NOT NULL DEFAULT FALSE,
  deducts_annual_quota BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS public.leave_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  leave_type_id UUID NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
  annual_quota NUMERIC(6,2) NOT NULL DEFAULT 12.00,
  accrual_method TEXT NOT NULL DEFAULT 'ANNUAL_UPFRONT' CHECK (accrual_method IN ('ANNUAL_UPFRONT', 'MONTHLY_ACCRUAL')),
  seniority_bonus_years INT NOT NULL DEFAULT 5,
  carryover_cap NUMERIC(6,2) NOT NULL DEFAULT 5.00,
  carryover_expiry_month INT NOT NULL DEFAULT 3 CHECK (carryover_expiry_month BETWEEN 1 AND 12),
  effective_from DATE NOT NULL DEFAULT '2026-01-01',
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
  year INT NOT NULL CHECK (year BETWEEN 2020 AND 2100),
  entitled_days NUMERIC(6,2) NOT NULL DEFAULT 12.00,
  carried_over NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  used_days NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  adjusted_days NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  pending_days NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, leave_type_id, year)
);

CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  requester_user_id UUID REFERENCES public.users(id),
  leave_type_id UUID NOT NULL REFERENCES public.leave_types(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days NUMERIC(6,2) NOT NULL CHECK (total_days > 0),
  reason TEXT NOT NULL,
  attachment_file_id UUID REFERENCES public.files(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.overtime_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  requester_user_id UUID REFERENCES public.users(id),
  work_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  requested_hours NUMERIC(6,2) NOT NULL CHECK (requested_hours > 0 AND requested_hours <= 12),
  ot_day_type TEXT NOT NULL CHECK (ot_day_type IN ('WEEKDAY', 'WEEKEND', 'HOLIDAY')),
  is_night_shift BOOLEAN NOT NULL DEFAULT FALSE,
  employee_consent BOOLEAN NOT NULL DEFAULT FALSE,
  employee_consent_at TIMESTAMPTZ,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.overtime_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  overtime_request_id UUID NOT NULL UNIQUE REFERENCES public.overtime_requests(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  actual_hours NUMERIC(6,2) NOT NULL CHECK (actual_hours >= 0),
  day_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  night_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  multiplier NUMERIC(6,4) NOT NULL,
  tax_exempt_multiplier NUMERIC(6,4) NOT NULL,
  verified_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- DOMAIN 5: Recruitment (ATS) & Onboarding/Offboarding Checklists
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  position_id UUID NOT NULL REFERENCES public.positions(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  headcount INT NOT NULL DEFAULT 1 CHECK (headcount > 0),
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('DRAFT', 'OPEN', 'FILLED', 'CLOSED')),
  created_by UUID REFERENCES public.users(id),
  approved_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  full_name TEXT NOT NULL,
  email TEXT,
  phone_enc TEXT,
  phone_last4 VARCHAR(4),
  source TEXT NOT NULL DEFAULT 'DIRECT',
  consent_record_id UUID REFERENCES public.consent_records(id) ON DELETE SET NULL,
  retention_until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  requisition_id UUID NOT NULL REFERENCES public.job_requisitions(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'APPLIED' CHECK (stage IN ('APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'HIRED', 'REJECTED', 'WITHDRAWN')),
  notes TEXT,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (requisition_id, candidate_id)
);

CREATE TABLE IF NOT EXISTS public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  application_id UUID NOT NULL UNIQUE REFERENCES public.applications(id) ON DELETE CASCADE,
  proposed_salary NUMERIC(18,2) NOT NULL CHECK (proposed_salary > 0),
  pay_structure TEXT NOT NULL DEFAULT 'GROSS' CHECK (pay_structure IN ('GROSS', 'NET')),
  start_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'ACCEPTED', 'DECLINED')),
  created_by UUID REFERENCES public.users(id),
  approved_by UUID REFERENCES public.users(id),
  converted_employee_id UUID REFERENCES public.employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lifecycle_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  checklist_type TEXT NOT NULL CHECK (checklist_type IN ('ONBOARDING', 'OFFBOARDING')),
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED')),
  target_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lifecycle_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES public.lifecycle_checklists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  owner_role TEXT NOT NULL,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  evidence_note TEXT
);

-- ------------------------------------------------------------------------------
-- DOMAIN 10: Workflow Approval Delegations
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  delegator_user_id UUID NOT NULL REFERENCES public.users(id),
  delegatee_user_id UUID NOT NULL REFERENCES public.users(id),
  scope_modules TEXT[] NOT NULL DEFAULT ARRAY['LEAVE', 'OVERTIME', 'PAYROLL'],
  effective_from DATE NOT NULL,
  effective_to DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (effective_to >= effective_from),
  CHECK (delegator_user_id <> delegatee_user_id)
);

-- Attach updated_at triggers
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'leave_balances', 'leave_requests', 'overtime_requests',
    'job_requisitions', 'applications', 'offers'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      tbl, tbl
    );
  END LOOP;
END;
$$;

