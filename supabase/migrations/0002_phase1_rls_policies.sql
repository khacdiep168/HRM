-- ==============================================================================
-- HRM Enterprise - Công ty TNHH Thương mại Thế Kỷ Vàng
-- Migration 0002: Defense-in-Depth PostgreSQL Row Level Security (RLS)
-- Rule: Deny ALL direct anon access; Browser reads go through Vercel Server API
--       (service_role bypasses RLS after strict RBAC + Data Scope + SoD checks).
-- ==============================================================================

-- Helper: Get authenticated user's employee_id cleanly
CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT employee_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

-- Enable RLS across ALL Phase 1 tables
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_dependents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_education ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfa_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_amendments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retention_policies ENABLE ROW LEVEL SECURITY;

-- Explicitly revoke direct anon privileges from schema tables
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

-- Minimal self-service SELECT policies for authenticated users (defense-in-depth)
-- Sensitive tables (salary_assignments, bank_accounts, legal_holds, audit/access/export logs)
-- intentionally have NO direct client policy and are ONLY accessible via Vercel Server Layer.

CREATE POLICY "auth_read_company_basic" ON public.companies
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "auth_read_locations_basic" ON public.locations
  FOR SELECT TO authenticated USING (is_active = TRUE);

CREATE POLICY "auth_read_departments_basic" ON public.departments
  FOR SELECT TO authenticated USING (status = 'ACTIVE');

CREATE POLICY "auth_read_self_user" ON public.users
  FOR SELECT TO authenticated USING (id = auth.uid());

CREATE POLICY "auth_read_self_employee" ON public.employees
  FOR SELECT TO authenticated USING (id = public.current_employee_id());

CREATE POLICY "auth_read_self_org_assignment" ON public.org_assignments
  FOR SELECT TO authenticated USING (employee_id = public.current_employee_id());

CREATE POLICY "auth_read_self_consents" ON public.consent_records
  FOR SELECT TO authenticated USING (subject_type = 'EMPLOYEE' AND subject_id = public.current_employee_id());

CREATE POLICY "auth_read_self_dsr" ON public.data_subject_requests
  FOR SELECT TO authenticated USING (employee_id = public.current_employee_id());

