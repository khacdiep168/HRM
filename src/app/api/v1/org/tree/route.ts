import { NextResponse } from "next/server";
import { handleApiError, resolveAuthContext } from "@/lib/security/auth-session";
import { assertAuthorized } from "@/lib/security/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "ORGANIZATION", "READ");

    const admin = getSupabaseAdminClient();
    const [companiesRes, locationsRes, departmentsRes, costCentersRes, positionsRes] =
      await Promise.all([
        admin.from("companies").select("id, code, legal_name, english_name, tax_code, address, payroll_cutoff_day, payroll_advance_day").limit(1).single(),
        admin.from("locations").select("id, code, name, address, min_wage_region_code, latitude, longitude, geofence_radius_m, gps_required").eq("is_active", true).order("code"),
        admin.from("departments").select("id, parent_id, code, name, cost_center_id, default_location_id, manager_employee_id, status").eq("status", "ACTIVE").order("code"),
        admin.from("cost_centers").select("id, code, name, accounting_ref").eq("is_active", true).order("code"),
        admin.from("positions").select("id, department_id, code, title, headcount_limit, allow_300h_ot").eq("is_active", true).order("code"),
      ]);

    if (companiesRes.error) throw companiesRes.error;

    return NextResponse.json({
      data: {
        company: companiesRes.data,
        locations: locationsRes.data ?? [],
        departments: departmentsRes.data ?? [],
        costCenters: costCentersRes.data ?? [],
        positions: positionsRes.data ?? [],
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

