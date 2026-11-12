-- ==============================================================================
-- HRM Enterprise - Công ty TNHH Thương mại Thế Kỷ Vàng
-- Migration 0004: Phase 2 Schema (Time & Attendance, GPS/Face ID Devices,
--                 3-Tier Allowances, 2-Installment Payroll Engine, Legal Rules)
-- Target: Supabase PostgreSQL (Project: xtswzywqbizunynahmvl)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- DOMAIN 6: Time & Attendance (GPS Geofencing + Face ID Sync Agent)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shift_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_overnight BOOLEAN NOT NULL DEFAULT FALSE,
  break_minutes INT NOT NULL DEFAULT 60,
  early_handover_minutes INT NOT NULL DEFAULT 0,
  count_early_handover_as_work BOOLEAN NOT NULL DEFAULT TRUE,
  standard_work_hours NUMERIC(6,2) NOT NULL DEFAULT 8.00,
  night_window_start TIME NOT NULL DEFAULT '22:00:00',
  night_window_end TIME NOT NULL DEFAULT '06:00:00',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS public.work_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
  calendar_date DATE NOT NULL,
  day_type TEXT NOT NULL CHECK (day_type IN ('WORKDAY', 'WEEKEND', 'HOLIDAY', 'COMPENSATORY_OFF')),
  holiday_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, location_id, calendar_date)
);

CREATE TABLE IF NOT EXISTS public.shift_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  shift_template_id UUID NOT NULL REFERENCES public.shift_templates(id) ON DELETE RESTRICT,
  work_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'SWAPPED', 'CANCELLED')),
  source TEXT NOT NULL DEFAULT 'SCHEDULE' CHECK (source IN ('SCHEDULE', 'SWAP', 'AUTO')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, work_date)
);

CREATE TABLE IF NOT EXISTS public.attendance_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  device_code TEXT NOT NULL UNIQUE,
  device_name TEXT NOT NULL,
  device_type TEXT NOT NULL DEFAULT 'FACE_ID' CHECK (device_type IN ('FACE_ID', 'FINGERPRINT', 'CARD')),
  vendor TEXT,
  serial_no TEXT,
  last_sync_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'MAINTENANCE', 'RETIRED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Map device user badge / employee code on Face ID terminal to employees table
CREATE TABLE IF NOT EXISTS public.device_user_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  device_id UUID REFERENCES public.attendance_devices(id) ON DELETE CASCADE,
  device_user_id TEXT NOT NULL,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, device_user_id)
);

-- Immutable raw attendance event log (GPS & Face ID)
CREATE TABLE IF NOT EXISTS public.attendance_raw_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  event_time TIMESTAMPTZ NOT NULL,
  direction TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK (direction IN ('IN', 'OUT', 'UNKNOWN')),
  source_type TEXT NOT NULL CHECK (source_type IN ('DEVICE_FACE_ID', 'WEB_GPS', 'QR', 'IMPORT')),
  verify_mode TEXT NOT NULL CHECK (verify_mode IN ('FACE_ID', 'GPS_GEOFENCE', 'MANUAL_CORRECTION')),
  device_id UUID REFERENCES public.attendance_devices(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  gps_lat NUMERIC(10,7),
  gps_lng NUMERIC(10,7),
  gps_accuracy_m NUMERIC(8,2),
  distance_m NUMERIC(10,2),
  is_within_geofence BOOLEAN,
  work_mode TEXT NOT NULL DEFAULT 'ONSITE' CHECK (work_mode IN ('ONSITE', 'REMOTE_DUTY')),
  consent_record_id UUID REFERENCES public.consent_records(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL UNIQUE,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_att_raw_emp_time ON public.attendance_raw_events(employee_id, event_time DESC);

DROP TRIGGER IF EXISTS trg_att_raw_events_immutable ON public.attendance_raw_events;
CREATE TRIGGER trg_att_raw_events_immutable
BEFORE UPDATE OR DELETE ON public.attendance_raw_events
FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  shift_assignment_id UUID REFERENCES public.shift_assignments(id) ON DELETE SET NULL,
  check_in_event_id UUID REFERENCES public.attendance_raw_events(id) ON DELETE SET NULL,
  check_out_event_id UUID REFERENCES public.attendance_raw_events(id) ON DELETE SET NULL,
  effective_in TIMESTAMPTZ,
  effective_out TIMESTAMPTZ,
  worked_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  late_minutes INT NOT NULL DEFAULT 0,
  early_minutes INT NOT NULL DEFAULT 0,
  night_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'VALID', 'EXCEPTION', 'APPROVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, work_date)
);

CREATE TABLE IF NOT EXISTS public.attendance_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  raw_event_id UUID REFERENCES public.attendance_raw_events(id) ON DELETE SET NULL,
  exception_type TEXT NOT NULL CHECK (exception_type IN ('MISSING_IN', 'MISSING_OUT', 'DUPLICATE', 'OUT_OF_GEOFENCE', 'OUT_OF_SHIFT')),
  explanation_note TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- DOMAIN 8 & 9: Flexible 3-Tier Allowances, Payroll Periods, 2-Installment Runs
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.legal_rule_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  rule_code TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  domain TEXT NOT NULL CHECK (domain IN ('LABOR', 'PIT', 'SI', 'PDPL')),
  legal_basis TEXT NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  parameters JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'APPROVED' CHECK (status IN ('DRAFT', 'REVIEWED', 'APPROVED', 'RETIRED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, rule_code, effective_from)
);

CREATE TABLE IF NOT EXISTS public.payroll_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  period_code TEXT NOT NULL,
  period_month INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INT NOT NULL CHECK (period_year BETWEEN 2020 AND 2100),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  cutoff_date DATE NOT NULL,
  advance_pay_date DATE NOT NULL,
  settlement_pay_date DATE NOT NULL,
  standard_work_days NUMERIC(6,2) NOT NULL DEFAULT 22.00,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ADVANCE_PAID', 'CLOSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, period_code)
);

CREATE TABLE IF NOT EXISTS public.attendance_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  payroll_period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  standard_days NUMERIC(6,2) NOT NULL DEFAULT 22.00,
  paid_days NUMERIC(6,2) NOT NULL DEFAULT 22.00,
  unpaid_days NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  ot_weekday_hours NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  ot_weekend_hours NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  ot_holiday_hours NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  ot_night_hours NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (payroll_period_id, employee_id, version)
);

CREATE TABLE IF NOT EXISTS public.salary_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('EARNING', 'ALLOWANCE', 'OT', 'BONUS', 'DEDUCTION', 'EMPLOYER_COST', 'ADJUSTMENT')),
  calc_mode TEXT NOT NULL CHECK (calc_mode IN ('FIXED_MONTHLY', 'PER_WORKDAY', 'PERCENT_BASE', 'VARIABLE_INPUT', 'FORMULA')),
  is_taxable BOOLEAN NOT NULL DEFAULT TRUE,
  tax_exempt_rule_code TEXT,
  tax_exempt_cap NUMERIC(18,2) NOT NULL DEFAULT 0,
  is_si_base BOOLEAN NOT NULL DEFAULT FALSE,
  is_prorated BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, code)
);

-- Tier 1: Department / Position default allowance policy (Lunch, Meal, Responsibility, etc.)
CREATE TABLE IF NOT EXISTS public.department_allowance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  position_id UUID REFERENCES public.positions(id) ON DELETE CASCADE,
  salary_component_id UUID NOT NULL REFERENCES public.salary_components(id) ON DELETE CASCADE,
  default_amount NUMERIC(18,2) NOT NULL CHECK (default_amount >= 0),
  calc_mode TEXT NOT NULL DEFAULT 'FIXED_MONTHLY' CHECK (calc_mode IN ('FIXED_MONTHLY', 'PER_WORKDAY', 'VARIABLE_INPUT')),
  effective_from DATE NOT NULL DEFAULT '2026-01-01',
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tier 2: Per-employee override (non-fixed individual lunch / allowance level)
CREATE TABLE IF NOT EXISTS public.employee_allowance_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  salary_component_id UUID NOT NULL REFERENCES public.salary_components(id) ON DELETE CASCADE,
  override_amount NUMERIC(18,2) NOT NULL CHECK (override_amount >= 0),
  calc_mode TEXT NOT NULL DEFAULT 'FIXED_MONTHLY' CHECK (calc_mode IN ('FIXED_MONTHLY', 'PER_WORKDAY', 'VARIABLE_INPUT')),
  reason TEXT NOT NULL,
  approved_by UUID REFERENCES public.users(id),
  effective_from DATE NOT NULL DEFAULT '2026-01-01',
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tier 3: Per-payroll-period variable allowance / meal / commission input
CREATE TABLE IF NOT EXISTS public.payroll_period_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  payroll_period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  salary_component_id UUID NOT NULL REFERENCES public.salary_components(id) ON DELETE RESTRICT,
  amount NUMERIC(18,2) NOT NULL,
  quantity NUMERIC(10,4) NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL', 'IMPORT', 'CHMT_POS')),
  note TEXT,
  approved_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (payroll_period_id, employee_id, salary_component_id)
);

CREATE TABLE IF NOT EXISTS public.tax_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  residency_status TEXT NOT NULL DEFAULT 'RESIDENT' CHECK (residency_status IN ('RESIDENT', 'NON_RESIDENT')),
  pit_method TEXT NOT NULL DEFAULT 'PROGRESSIVE' CHECK (pit_method IN ('PROGRESSIVE', 'FLAT_10', 'FLAT_20')),
  self_deduction_eligible BOOLEAN NOT NULL DEFAULT TRUE,
  dependent_count INT NOT NULL DEFAULT 0 CHECK (dependent_count >= 0),
  effective_from DATE NOT NULL DEFAULT '2026-01-01',
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.insurance_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  social_insurance_no TEXT,
  is_bhxh_eligible BOOLEAN NOT NULL DEFAULT TRUE,
  is_bhyt_eligible BOOLEAN NOT NULL DEFAULT TRUE,
  is_bhtn_eligible BOOLEAN NOT NULL DEFAULT TRUE,
  region_code TEXT NOT NULL DEFAULT 'III',
  effective_from DATE NOT NULL DEFAULT '2026-01-01',
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  payroll_period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE RESTRICT,
  run_type TEXT NOT NULL CHECK (run_type IN ('MID_MONTH_ADVANCE', 'END_MONTH_SETTLEMENT', 'ADJUSTMENT', 'OFF_CYCLE')),
  run_version INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (
    status IN (
      'DRAFT',
      'CALCULATED',
      'PENDING_ACCOUNTANT_REVIEW',
      'PENDING_DIRECTOR_APPROVAL',
      'APPROVED',
      'LOCKED',
      'PAID',
      'REOPENED'
    )
  ),
  legal_rule_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_employees INT NOT NULL DEFAULT 0,
  total_gross_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_net_payable NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.users(id),
  accountant_reviewed_by UUID REFERENCES public.users(id),
  accountant_reviewed_at TIMESTAMPTZ,
  director_approved_by UUID REFERENCES public.users(id),
  director_approved_at TIMESTAMPTZ,
  locked_by UUID REFERENCES public.users(id),
  locked_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (payroll_period_id, run_type, run_version)
);

CREATE TABLE IF NOT EXISTS public.payroll_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id UUID NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  base_salary_snapshot NUMERIC(18,2) NOT NULL DEFAULT 0,
  gross_income NUMERIC(18,2) NOT NULL DEFAULT 0,
  si_base_bhxh NUMERIC(18,2) NOT NULL DEFAULT 0,
  si_base_bhtn NUMERIC(18,2) NOT NULL DEFAULT 0,
  ee_insurance_total NUMERIC(18,2) NOT NULL DEFAULT 0,
  er_insurance_total NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_exempt_income NUMERIC(18,2) NOT NULL DEFAULT 0,
  assessable_income NUMERIC(18,2) NOT NULL DEFAULT 0,
  personal_deduction NUMERIC(18,2) NOT NULL DEFAULT 0,
  dependent_deduction NUMERIC(18,2) NOT NULL DEFAULT 0,
  taxable_income NUMERIC(18,2) NOT NULL DEFAULT 0,
  pit_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  other_deductions NUMERIC(18,2) NOT NULL DEFAULT 0,
  full_month_net NUMERIC(18,2) NOT NULL DEFAULT 0,
  mid_month_advance_paid NUMERIC(18,2) NOT NULL DEFAULT 0,
  net_payable NUMERIC(18,2) NOT NULL DEFAULT 0,
  negative_balance_carryover NUMERIC(18,2) NOT NULL DEFAULT 0,
  employer_total_cost NUMERIC(18,2) NOT NULL DEFAULT 0,
  explanation_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (payroll_run_id, employee_id)
);

CREATE TABLE IF NOT EXISTS public.payroll_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_result_id UUID NOT NULL REFERENCES public.payroll_results(id) ON DELETE CASCADE,
  salary_component_id UUID REFERENCES public.salary_components(id) ON DELETE SET NULL,
  component_code TEXT NOT NULL,
  category TEXT NOT NULL,
  tier_source TEXT,
  quantity NUMERIC(10,4) NOT NULL DEFAULT 1,
  rate NUMERIC(18,4) NOT NULL DEFAULT 0,
  amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_exempt_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  explanation_text TEXT
);

CREATE TABLE IF NOT EXISTS public.payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_result_id UUID NOT NULL REFERENCES public.payroll_results(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  payroll_period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE RESTRICT,
  payslip_no TEXT NOT NULL UNIQUE,
  payload_snapshot JSONB NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.integration_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  job_type TEXT NOT NULL,
  external_ref TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSED', 'UNMAPPED_USER', 'FAILED')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Attach updated_at triggers
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'shift_templates', 'shift_assignments', 'attendance_devices', 'attendance_sessions',
    'attendance_exceptions', 'payroll_periods', 'department_allowance_policies',
    'employee_allowance_overrides', 'payroll_runs', 'integration_jobs'
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

