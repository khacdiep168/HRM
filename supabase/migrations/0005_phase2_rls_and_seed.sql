-- ==============================================================================
-- HRM Enterprise - Công ty TNHH Thương mại Thế Kỷ Vàng
-- Migration 0005: Phase 2 RLS Policies + Seed Shifts, Face ID Devices,
--                 3-Tier Salary Components, VN-2026-H2 Rule & Payroll Period
-- ==============================================================================

-- 1. Enable RLS across all Phase 2 tables & revoke anon access
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'shift_templates', 'work_calendars', 'shift_assignments', 'attendance_devices',
    'device_user_mappings', 'attendance_raw_events', 'attendance_sessions',
    'attendance_exceptions', 'legal_rule_registry', 'payroll_periods',
    'attendance_summaries', 'salary_components', 'department_allowance_policies',
    'employee_allowance_overrides', 'payroll_period_variables', 'tax_profiles',
    'insurance_profiles', 'payroll_runs', 'payroll_results', 'payroll_items',
    'payslips', 'integration_jobs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', tbl);
  END LOOP;
END;
$$;

-- Minimal ESS self-service read policies (all writes / payroll / admin go through Vercel service_role)
DROP POLICY IF EXISTS payslips_self_select ON public.payslips;
CREATE POLICY payslips_self_select ON public.payslips
  FOR SELECT TO authenticated
  USING (
    employee_id IN (SELECT u.employee_id FROM public.users u WHERE u.id = auth.uid())
  );

DROP POLICY IF EXISTS att_raw_self_select ON public.attendance_raw_events;
CREATE POLICY att_raw_self_select ON public.attendance_raw_events
  FOR SELECT TO authenticated
  USING (
    employee_id IN (SELECT u.employee_id FROM public.users u WHERE u.id = auth.uid())
  );

-- 2. Seed Shift Templates (QĐ 13/2026/QĐ-TKV: Văn phòng, Bảo vệ 30', Bãi xe 15', Ca đêm 24/24)
INSERT INTO public.shift_templates (
  id, company_id, code, name, start_time, end_time, is_overnight,
  break_minutes, early_handover_minutes, count_early_handover_as_work, standard_work_hours
) VALUES
  ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'SHIFT-VP-HC',   'Ca Hành chính Văn phòng (Thứ 2–6)', '08:00:00', '17:00:00', FALSE, 60, 0,  FALSE, 8.00),
  ('50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'SHIFT-BX-DAY',  'Ca Ngày Bãi xe (Giao ca sớm 15p)',  '06:00:00', '18:00:00', FALSE, 60, 15, TRUE,  11.00),
  ('50000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'SHIFT-BX-NGT',  'Ca Đêm Bãi xe / Bảo vệ 24/24',      '18:00:00', '06:00:00', TRUE,  60, 30, TRUE,  11.00),
  ('50000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'SHIFT-CHMT',    'Ca Cửa hàng Miễn thuế Mộc Bài',     '07:30:00', '17:30:00', FALSE, 60, 10, TRUE,  9.00)
ON CONFLICT (company_id, code) DO NOTHING;

-- 3. Seed 4 Physical Face ID Terminals mapped to the 4 Locations
INSERT INTO public.attendance_devices (
  id, company_id, location_id, device_code, device_name, device_type, vendor, status
) VALUES
  ('51000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'FACEID-VP75A-01', 'Máy Face ID Văn phòng 75A',          'FACE_ID', 'ZKTeco/Hikvision Sync', 'ACTIVE'),
  ('51000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'FACEID-KHO-01',   'Máy Face ID Kho hàng khu vực Miếu', 'FACE_ID', 'ZKTeco/Hikvision Sync', 'ACTIVE'),
  ('51000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', 'FACEID-CHMT-01',  'Máy Face ID CHMT Cửa khẩu Mộc Bài', 'FACE_ID', 'ZKTeco/Hikvision Sync', 'ACTIVE'),
  ('51000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000004', 'FACEID-BAIXE-01', 'Máy Face ID Bãi xe Điểm tập kết',   'FACE_ID', 'ZKTeco/Hikvision Sync', 'ACTIVE')
ON CONFLICT (device_code) DO NOTHING;

-- 4. Seed Legal Rule VN-2026-H2
INSERT INTO public.legal_rule_registry (
  id, company_id, rule_code, rule_name, domain, legal_basis, effective_from, parameters, status
) VALUES (
  '52000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'VN-2026-H2',
  'Quy tắc Lương, Thuế TNCN 5 bậc & BHXH H2/2026 (Vùng III)',
  'PIT',
  'Luật Thuế TNCN 109/2025/QH15; NĐ 293/2025/NĐ-CP; NĐ 253/2026/NĐ-CP',
  '2026-07-01',
  '{
    "minWageRegionIII": 4140000,
    "bhxhRefSalary": 2530000,
    "bhxhCapMultiplier": 20,
    "bhtnCapMultiplier": 20,
    "personalDeduction": 15500000,
    "dependentDeduction": 6200000,
    "lunchCashExemptCap": 1200000
  }'::jsonb,
  'APPROVED'
) ON CONFLICT (company_id, rule_code, effective_from) DO NOTHING;

-- 5. Seed Flexible Salary & Allowance Components (3-Tier Allowance Engine)
INSERT INTO public.salary_components (
  id, company_id, code, name, category, calc_mode, is_taxable, tax_exempt_rule_code, tax_exempt_cap, is_si_base, is_prorated
) VALUES
  ('53000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'LUNCH_ALLOWANCE',     'Tiền ăn trưa / ăn ca',          'ALLOWANCE', 'PER_WORKDAY',    TRUE,  'DECREE_253_2026_LUNCH', 1200000, FALSE, TRUE),
  ('53000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'PHONE_ALLOWANCE',     'Phụ cấp điện thoại',            'ALLOWANCE', 'FIXED_MONTHLY',  FALSE, 'INTERNAL_QUOTA',        0,       FALSE, FALSE),
  ('53000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'TRANSPORT_ALLOWANCE', 'Phụ cấp xăng xe / đi lại',      'ALLOWANCE', 'FIXED_MONTHLY',  TRUE,  NULL,                    0,       FALSE, TRUE),
  ('53000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'SHIFT_HAZARD_ALLOW',  'Phụ cấp ca đêm / nặng nhọc',    'ALLOWANCE', 'FIXED_MONTHLY',  TRUE,  NULL,                    0,       FALSE, TRUE),
  ('53000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'SALES_COMMISSION',    'Thưởng doanh số CHMT / KD',     'BONUS',     'VARIABLE_INPUT', TRUE,  NULL,                    0,       FALSE, FALSE)
ON CONFLICT (company_id, code) DO NOTHING;

-- 6. Seed Tier 1 Department-Varying Lunch & Allowance Policies (Non-uniform by department!)
INSERT INTO public.department_allowance_policies (
  id, company_id, department_id, salary_component_id, default_amount, calc_mode
) VALUES
  ('54000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', '53000000-0000-4000-8000-000000000001', 40000,   'PER_WORKDAY'),   -- HC-NS Văn phòng: 40k/ngày
  ('54000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000015', '53000000-0000-4000-8000-000000000001', 55000,   'PER_WORKDAY'),   -- Bãi xe 24/24: 55k/ngày
  ('54000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000024', '53000000-0000-4000-8000-000000000001', 50000,   'PER_WORKDAY'),   -- Kho hàng Miếu: 50k/ngày
  ('54000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000025', '53000000-0000-4000-8000-000000000001', 45000,   'PER_WORKDAY'),   -- CHMT Mộc Bài: 45k/ngày
  ('54000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000013', '53000000-0000-4000-8000-000000000003', 1500000, 'FIXED_MONTHLY')  -- Lái xe: xăng xe/lưu trú 1.5M/tháng
ON CONFLICT DO NOTHING;

-- 7. Seed Default Payroll Period (2026-11: cutoff 25, advance 15, EOM 30)
INSERT INTO public.payroll_periods (
  id, company_id, period_code, period_month, period_year,
  start_date, end_date, cutoff_date, advance_pay_date, settlement_pay_date, standard_work_days, status
) VALUES (
  '55000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '2026-11',
  11,
  2026,
  '2026-10-26',
  '2026-11-25',
  '2026-11-25',
  '2026-11-15',
  '2026-11-30',
  22.00,
  'OPEN'
) ON CONFLICT (company_id, period_code) DO NOTHING;

