-- ==============================================================================
-- HRM Enterprise - Công ty TNHH Thương mại Thế Kỷ Vàng
-- Migration 0007: Phase 3 RLS Policies + Seed Leave Types, Policies & 300h OT Positions
-- ==============================================================================

-- 1. Enable RLS across all Phase 3 tables & revoke anon access
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'leave_types', 'leave_policies', 'leave_balances', 'leave_requests',
    'overtime_requests', 'overtime_records', 'job_requisitions', 'candidates',
    'applications', 'offers', 'lifecycle_checklists', 'lifecycle_checklist_items',
    'delegations'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', tbl);
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS leave_requests_self_select ON public.leave_requests;
CREATE POLICY leave_requests_self_select ON public.leave_requests
  FOR SELECT TO authenticated
  USING (
    employee_id IN (SELECT u.employee_id FROM public.users u WHERE u.id = auth.uid())
  );

DROP POLICY IF EXISTS ot_requests_self_select ON public.overtime_requests;
CREATE POLICY ot_requests_self_select ON public.overtime_requests
  FOR SELECT TO authenticated
  USING (
    employee_id IN (SELECT u.employee_id FROM public.users u WHERE u.id = auth.uid())
  );

-- 2. Seed Statutory Vietnam Leave Types & Policies
INSERT INTO public.leave_types (id, company_id, code, name, is_paid, si_benefit_paid, requires_document, deducts_annual_quota)
VALUES
  ('60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'ANNUAL',        'Nghỉ phép năm (100% lương)',            TRUE,  FALSE, FALSE, TRUE),
  ('60000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'SICK',          'Nghỉ ốm đau (Hưởng chế độ BHXH)',       FALSE, TRUE,  TRUE,  FALSE),
  ('60000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'MATERNITY',     'Nghỉ thai sản (Hưởng chế độ BHXH)',     FALSE, TRUE,  TRUE,  FALSE),
  ('60000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'PERSONAL_PAID', 'Việc riêng hưởng lương (Kết hôn/Tang)', TRUE,  FALSE, TRUE,  FALSE),
  ('60000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'UNPAID',        'Nghỉ không hưởng lương',                FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (company_id, code) DO NOTHING;

INSERT INTO public.leave_policies (id, company_id, leave_type_id, annual_quota, accrual_method, seniority_bonus_years, carryover_cap, carryover_expiry_month)
VALUES
  ('61000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', 12.00, 'ANNUAL_UPFRONT', 5, 5.00, 3)
ON CONFLICT DO NOTHING;

-- 3. Enable 300h/year OT eligibility for operational 24/24 & Logistics positions (BLLĐ 2019 Điều 107)
UPDATE public.positions
SET allow_300h_ot = TRUE
WHERE company_id = '10000000-0000-4000-8000-000000000001'
  AND code IN ('POS-NVBX', 'POS-BV', 'POS-LX', 'POS-NVKHO', 'POS-BANHANG', 'POS-THUNGAN');

