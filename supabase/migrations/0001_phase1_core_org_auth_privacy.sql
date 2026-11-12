-- ==============================================================================
-- HRM Enterprise - Công ty TNHH Thương mại Thế Kỷ Vàng
-- Migration 0001: Phase 1 Core Schema (Identity, RBAC, PDPL 91/2025, Org, Employee, Employment, Audit)
-- Target: Supabase PostgreSQL (Project: xtswzywqbizunynahmvl)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------------------------
-- Helper Functions: Updated At, Immutability Guard & Legal Hold Protection
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_immutable_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only / immutable. UPDATE or DELETE is forbidden.', TG_TABLE_NAME
    USING ERRCODE = '42501';
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_legal_hold_before_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_hold_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.legal_holds lh
    WHERE lh.target_entity = TG_TABLE_NAME
      AND lh.target_id = OLD.id
      AND lh.active = TRUE
  ) INTO v_hold_exists;

  IF v_hold_exists THEN
    RAISE EXCEPTION 'Hard delete blocked by active legal_hold on %.id = % (Vietnam Labor/Tax/Accounting retention).', TG_TABLE_NAME, OLD.id
      USING ERRCODE = 'P0001';
  END IF;

  RAISE EXCEPTION 'Hard delete is disabled on %. Use status transition / soft archive / legal retention workflow.', TG_TABLE_NAME
    USING ERRCODE = '42501';
END;
$$;

-- ==============================================================================
-- DOMAIN 2 (Base): Companies & Organization Structure (Created first for FK refs)
-- ==============================================================================
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(32) NOT NULL UNIQUE,
  legal_name VARCHAR(255) NOT NULL,
  english_name VARCHAR(255),
  tax_code VARCHAR(32) NOT NULL UNIQUE,
  address TEXT NOT NULL,
  phone VARCHAR(64),
  default_currency CHAR(3) NOT NULL DEFAULT 'VND',
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  payroll_cutoff_day SMALLINT NOT NULL DEFAULT 25 CHECK (payroll_cutoff_day BETWEEN 1 AND 28),
  payroll_advance_day SMALLINT NOT NULL DEFAULT 15 CHECK (payroll_advance_day BETWEEN 1 AND 28),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  code VARCHAR(32) NOT NULL,
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  min_wage_region_code VARCHAR(4) NOT NULL CHECK (min_wage_region_code IN ('I', 'II', 'III', 'IV')),
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  geofence_radius_m INT NOT NULL DEFAULT 150 CHECK (geofence_radius_m > 0),
  gps_required BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, code),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TRIGGER trg_locations_updated_at
  BEFORE UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  code VARCHAR(32) NOT NULL,
  name VARCHAR(255) NOT NULL,
  accounting_ref VARCHAR(64),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, code)
);

CREATE TABLE public.job_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  code VARCHAR(32) NOT NULL,
  name VARCHAR(128) NOT NULL,
  rank_order INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, code)
);

CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  parent_id UUID REFERENCES public.departments(id),
  code VARCHAR(32) NOT NULL,
  name VARCHAR(255) NOT NULL,
  cost_center_id UUID REFERENCES public.cost_centers(id),
  default_location_id UUID REFERENCES public.locations(id),
  manager_employee_id UUID, -- FK added after employees table
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, code),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TRIGGER trg_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  department_id UUID REFERENCES public.departments(id),
  code VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  job_grade_id UUID REFERENCES public.job_grades(id),
  headcount_limit INT NOT NULL DEFAULT 1 CHECK (headcount_limit >= 0),
  allow_300h_ot BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, code)
);

-- ==============================================================================
-- DOMAIN 3: Employee Core
-- ==============================================================================
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  employee_code VARCHAR(32) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  dob DATE,
  gender VARCHAR(16) CHECK (gender IN ('MALE', 'FEMALE', 'OTHER')),
  nationality VARCHAR(64) NOT NULL DEFAULT 'VN',
  is_foreign_worker BOOLEAN NOT NULL DEFAULT FALSE,
  -- AES-256-GCM ciphertext & HMAC-SHA256 blind index
  national_id_enc TEXT,
  national_id_hash VARCHAR(128),
  national_id_last4 VARCHAR(4),
  work_email VARCHAR(255),
  employment_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (employment_status IN ('ONBOARDING', 'PROBATION', 'ACTIVE', 'ON_LEAVE', 'TERMINATED')),
  hire_date DATE NOT NULL,
  probation_end_date DATE,
  termination_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, employee_code),
  UNIQUE (company_id, national_id_hash)
);

CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.departments
  ADD CONSTRAINT fk_departments_manager_employee
  FOREIGN KEY (manager_employee_id) REFERENCES public.employees(id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE public.org_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  department_id UUID NOT NULL REFERENCES public.departments(id),
  position_id UUID NOT NULL REFERENCES public.positions(id),
  location_id UUID NOT NULL REFERENCES public.locations(id),
  cost_center_id UUID NOT NULL REFERENCES public.cost_centers(id),
  manager_id UUID REFERENCES public.employees(id),
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX idx_org_assignments_emp_active ON public.org_assignments(employee_id, effective_from, effective_to);

CREATE TABLE public.employee_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  employee_id UUID NOT NULL UNIQUE REFERENCES public.employees(id),
  phone_enc TEXT,
  phone_last4 VARCHAR(4),
  personal_email VARCHAR(255),
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone_enc TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.employee_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  address_type VARCHAR(16) NOT NULL CHECK (address_type IN ('PERMANENT', 'CURRENT')),
  full_address TEXT NOT NULL,
  province_code VARCHAR(32),
  ward_code VARCHAR(32),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, address_type)
);

CREATE TABLE public.employee_dependents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  full_name VARCHAR(255) NOT NULL,
  relationship VARCHAR(64) NOT NULL,
  dob DATE NOT NULL,
  national_id_enc TEXT,
  is_tax_dependent BOOLEAN NOT NULL DEFAULT FALSE,
  tax_effective_from DATE,
  tax_effective_to DATE,
  verification_status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.employee_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  bank_code VARCHAR(32) NOT NULL,
  bank_name VARCHAR(255) NOT NULL,
  branch_name VARCHAR(255),
  account_no_enc TEXT NOT NULL,
  account_no_last4 VARCHAR(4) NOT NULL,
  account_holder VARCHAR(255) NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.employee_education (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  institution VARCHAR(255) NOT NULL,
  degree VARCHAR(128),
  major VARCHAR(128),
  graduated_year INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.employee_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  skill_name VARCHAR(128) NOT NULL,
  proficiency_level VARCHAR(64),
  certified_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  bucket_name VARCHAR(128) NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(128) NOT NULL,
  size_bytes BIGINT NOT NULL,
  sha256 VARCHAR(64) NOT NULL,
  is_encrypted BOOLEAN NOT NULL DEFAULT TRUE,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  doc_type VARCHAR(64) NOT NULL, -- CCCD, HEALTH_CERT, DEGREE, WORK_PERMIT, CONTRACT_SCAN
  file_id UUID NOT NULL REFERENCES public.files(id),
  issue_date DATE,
  expiry_date DATE,
  verification_status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (verification_status IN ('PENDING', 'VERIFIED', 'EXPIRED', 'REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- DOMAIN 1: Identity, RBAC & Privacy Compliance (Luật BVDLCN 91/2025/QH15)
-- ==============================================================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY, -- Matches Supabase auth.users.id
  company_id UUID NOT NULL REFERENCES public.companies(id),
  employee_id UUID UNIQUE REFERENCES public.employees(id),
  email VARCHAR(255) NOT NULL UNIQUE,
  mfa_required BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'LOCKED', 'DISABLED')),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(128) NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT
);

CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code VARCHAR(64) NOT NULL,
  resource VARCHAR(64) NOT NULL,
  action VARCHAR(32) NOT NULL CHECK (action IN ('READ', 'CREATE', 'UPDATE', 'APPROVE', 'LOCK', 'EXPORT', 'UNMASK_PII')),
  sensitivity_level VARCHAR(32) NOT NULL DEFAULT 'STANDARD'
    CHECK (sensitivity_level IN ('STANDARD', 'SENSITIVE_PERSONAL', 'HIGH_PII', 'CRITICAL_CONFIDENTIAL')),
  UNIQUE (module_code, resource, action)
);

CREATE TABLE public.role_permissions (
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  role_id UUID NOT NULL REFERENCES public.roles(id),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  granted_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE public.data_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  role_id UUID NOT NULL REFERENCES public.roles(id),
  scope_type VARCHAR(32) NOT NULL
    CHECK (scope_type IN ('SELF', 'DEPT_TREE', 'LOCATION', 'COMPANY_FIN', 'COMPANY_HR', 'COMPANY_EXEC', 'COMPANY_AUDIT', 'SYSTEM_ONLY')),
  scope_ref_id UUID, -- department_id or location_id when DEPT_TREE/LOCATION
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE
);

CREATE TABLE public.mfa_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  event_type VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  subject_type VARCHAR(32) NOT NULL CHECK (subject_type IN ('EMPLOYEE', 'CANDIDATE')),
  subject_id UUID NOT NULL,
  purpose_code VARCHAR(64) NOT NULL
    CHECK (purpose_code IN ('HR_EMPLOYMENT', 'PAYROLL_TAX_SI', 'ATTENDANCE_GPS', 'ATTENDANCE_BIOMETRIC_FACE_ID', 'RECRUITMENT')),
  policy_version VARCHAR(32) NOT NULL,
  consent_method VARCHAR(32) NOT NULL CHECK (consent_method IN ('WEB_CLICKWRAP', 'SIGNED_PAPER', 'ESS_MODAL')),
  consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  withdrawn_at TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT,
  evidence_file_id UUID REFERENCES public.files(id)
);

CREATE INDEX idx_consent_subject_purpose ON public.consent_records(subject_id, purpose_code, withdrawn_at);

CREATE TABLE public.data_subject_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  request_type VARCHAR(32) NOT NULL CHECK (request_type IN ('ACCESS', 'RECTIFY', 'DELETE', 'RESTRICT', 'WITHDRAW_CONSENT')),
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'REJECTED_LEGAL_HOLD')),
  reason TEXT,
  due_at TIMESTAMPTZ NOT NULL,
  handled_by UUID REFERENCES public.users(id),
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.legal_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  target_entity VARCHAR(64) NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  legal_basis VARCHAR(255) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ
);

CREATE INDEX idx_legal_holds_target ON public.legal_holds(target_entity, target_id, active);

-- ==============================================================================
-- DOMAIN 4: Employment, Contracts & Movements
-- ==============================================================================
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  contract_no VARCHAR(64) NOT NULL,
  contract_type VARCHAR(32) NOT NULL CHECK (contract_type IN ('PROBATION', 'FIXED_TERM', 'INDEFINITE', 'PART_TIME', 'SEASONAL')),
  signed_date DATE NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED')),
  file_id UUID REFERENCES public.files(id),
  created_by UUID NOT NULL REFERENCES public.users(id),
  approved_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, contract_no),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE public.contract_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL UNIQUE REFERENCES public.contracts(id),
  work_hours_per_day NUMERIC(4, 2) NOT NULL DEFAULT 8.00,
  work_days_per_week NUMERIC(4, 2) NOT NULL DEFAULT 5.00,
  probation_rate NUMERIC(5, 4) NOT NULL DEFAULT 1.0000,
  notice_days INT NOT NULL DEFAULT 30,
  notes TEXT
);

CREATE TABLE public.contract_amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  contract_id UUID NOT NULL REFERENCES public.contracts(id),
  amendment_no VARCHAR(64) NOT NULL,
  effective_from DATE NOT NULL,
  change_summary TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'CANCELLED')),
  file_id UUID REFERENCES public.files(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.salary_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  contract_id UUID REFERENCES public.contracts(id),
  pay_structure VARCHAR(16) NOT NULL DEFAULT 'GROSS' CHECK (pay_structure IN ('GROSS', 'NET')),
  base_salary NUMERIC(18, 2) NOT NULL CHECK (base_salary >= 0),
  si_salary_base NUMERIC(18, 2) NOT NULL CHECK (si_salary_base >= 0),
  currency_code CHAR(3) NOT NULL DEFAULT 'VND',
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_by UUID NOT NULL REFERENCES public.users(id),
  approved_by UUID REFERENCES public.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE public.employee_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  movement_type VARCHAR(32) NOT NULL CHECK (movement_type IN ('HIRE', 'TRANSFER', 'PROMOTE', 'SALARY_CHANGE', 'TERMINATE')),
  effective_date DATE NOT NULL,
  from_snapshot JSONB,
  to_snapshot JSONB NOT NULL,
  decision_no VARCHAR(64),
  created_by UUID NOT NULL REFERENCES public.users(id),
  approved_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.employment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  event_type VARCHAR(64) NOT NULL,
  event_date DATE NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- DOMAIN 13: Audit, Access, Export & Retention Logs (Immutable)
-- ==============================================================================
CREATE TABLE public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  actor_user_id UUID REFERENCES public.users(id),
  actor_role VARCHAR(64),
  action VARCHAR(64) NOT NULL,
  target_entity VARCHAR(64) NOT NULL,
  target_id UUID,
  before_data JSONB,
  after_data JSONB,
  ip_address INET,
  user_agent TEXT,
  trace_id VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  actor_user_id UUID NOT NULL REFERENCES public.users(id),
  actor_role VARCHAR(64) NOT NULL,
  access_type VARCHAR(32) NOT NULL CHECK (access_type IN ('UNMASK_PII', 'VIEW_PAYROLL', 'DOWNLOAD_SIGNED_URL')),
  target_entity VARCHAR(64) NOT NULL,
  target_id UUID,
  reason TEXT NOT NULL,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.export_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  actor_user_id UUID NOT NULL REFERENCES public.users(id),
  actor_role VARCHAR(64) NOT NULL,
  module_code VARCHAR(64) NOT NULL,
  export_format VARCHAR(16) NOT NULL CHECK (export_format IN ('CSV', 'XLSX', 'PDF')),
  filter_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  row_count INT NOT NULL,
  file_sha256 VARCHAR(64),
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  data_category VARCHAR(64) NOT NULL,
  retention_months INT NOT NULL,
  action_on_expiry VARCHAR(32) NOT NULL CHECK (action_on_expiry IN ('ANONYMIZE', 'HARD_DELETE', 'ARCHIVE')),
  legal_basis VARCHAR(255) NOT NULL,
  UNIQUE (company_id, data_category)
);

-- Apply Immutability & No-Hard-Delete Triggers
CREATE TRIGGER trg_audit_events_immutable BEFORE UPDATE OR DELETE ON public.audit_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_mutation();
CREATE TRIGGER trg_access_logs_immutable BEFORE UPDATE OR DELETE ON public.access_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_mutation();
CREATE TRIGGER trg_export_logs_immutable BEFORE UPDATE OR DELETE ON public.export_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_mutation();
CREATE TRIGGER trg_employment_events_immutable BEFORE UPDATE OR DELETE ON public.employment_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_mutation();

CREATE TRIGGER trg_employees_no_hard_delete BEFORE DELETE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.enforce_legal_hold_before_delete();
CREATE TRIGGER trg_contracts_no_hard_delete BEFORE DELETE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_legal_hold_before_delete();
CREATE TRIGGER trg_salary_assignments_no_hard_delete BEFORE DELETE ON public.salary_assignments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_legal_hold_before_delete();

