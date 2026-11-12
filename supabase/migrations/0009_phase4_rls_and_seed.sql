-- ==============================================================================
-- HRM Enterprise - Công ty TNHH Thương mại Thế Kỷ Vàng
-- Migration 0009: Phase 4 RLS Policies + Seed Performance Cycle, Courses & Assets
-- ==============================================================================

-- 1. Enable RLS across all Phase 4 tables & revoke anon access
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'performance_cycles', 'goals', 'performance_reviews',
    'courses', 'training_enrollments',
    'asset_categories', 'assets', 'asset_assignments'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', tbl);
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS goals_self_select ON public.goals;
CREATE POLICY goals_self_select ON public.goals
  FOR SELECT TO authenticated
  USING (
    employee_id IN (SELECT u.employee_id FROM public.users u WHERE u.id = auth.uid())
  );

DROP POLICY IF EXISTS assets_self_select ON public.asset_assignments;
CREATE POLICY assets_self_select ON public.asset_assignments
  FOR SELECT TO authenticated
  USING (
    employee_id IN (SELECT u.employee_id FROM public.users u WHERE u.id = auth.uid())
  );

-- 2. Seed Performance Cycle
INSERT INTO public.performance_cycles (id, company_id, code, name, start_date, end_date, status)
VALUES (
  '70000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '2026-Q4',
  'Kỳ Đánh giá KPI Quý IV/2026',
  '2026-10-01',
  '2026-12-31',
  'OPEN'
) ON CONFLICT (company_id, code) DO NOTHING;

-- 3. Seed Mandatory Compliance & Operations Courses
INSERT INTO public.courses (id, company_id, code, title, category, duration_hours, is_mandatory, validity_months)
VALUES
  ('71000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'CRS-PDPL-2026', 'Bảo vệ Dữ liệu Cá nhân (Luật 91/2025/QH15)', 'COMPLIANCE', 2.00, TRUE, 12),
  ('71000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'CRS-PCCC-KHO',  'An toàn PCCC & Vận hành Kho / Bãi xe 24/24', 'SAFETY', 4.00, TRUE, 12),
  ('71000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'CRS-CHMT-POS',  'Nghiệp vụ Bán hàng & Hải quan Cửa hàng Miễn thuế', 'OPERATIONS', 6.00, FALSE, 24)
ON CONFLICT (company_id, code) DO NOTHING;

-- 4. Seed Asset Categories & Sample Company Assets
INSERT INTO public.asset_categories (id, company_id, code, name)
VALUES
  ('72000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'IT_HARDWARE',  'Máy tính / Laptop / Thiết bị IT'),
  ('72000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'POS_DEVICE',   'Máy POS / Máy quét mã vạch CHMT'),
  ('72000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'UNIFORM_GEAR', 'Đồng phục & Bộ đàm Bảo vệ / Bãi xe'),
  ('72000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'VEHICLE_KEY',  'Chìa khóa & Thẻ xe công vụ')
ON CONFLICT (company_id, code) DO NOTHING;

INSERT INTO public.assets (company_id, category_id, asset_code, name, serial_no, purchase_value, status)
VALUES
  ('10000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', 'AST-IT-001', 'Laptop Dell Latitude 5440 (HC-NS)', 'DL5440-TKV01', 22000000, 'AVAILABLE'),
  ('10000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000002', 'AST-POS-01', 'Máy POS Thu ngân Quầy 1 CHMT',      'POS-MB-001',   14500000, 'AVAILABLE'),
  ('10000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000003', 'AST-BD-001', 'Bộ đàm Motorola GP328 (Bãi xe)',    'MOT-BX-001',    3200000, 'AVAILABLE')
ON CONFLICT (company_id, asset_code) DO NOTHING;

