import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, resolveAuthContext } from "@/lib/security/auth-session";
import { assertAuthorized } from "@/lib/security/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const syncDeviceSchema = z.object({
  action: z.enum(["SYNC_PING", "SIMULATE_SCAN", "ADD_DEVICE"]),
  deviceId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  direction: z.enum(["IN", "OUT"]).optional(),
  deviceCode: z.string().min(2).max(40).optional(),
  deviceName: z.string().min(2).max(120).optional(),
  vendor: z.string().min(2).max(60).optional(),
  locationId: z.string().uuid().optional(),
});

export async function GET() {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "ATTENDANCE", "READ");

    const isAdminOrManager = ctx.roles.some((r) =>
      ["HR_ADMIN", "HR_STAFF", "DEPARTMENT_MANAGER", "DIRECTOR", "AUDITOR", "SUPER_ADMIN"].includes(r)
    );

    if (!isAdminOrManager && !ctx.employeeId) {
      return NextResponse.json({ data: { summaries: [] } });
    }

    const admin = getSupabaseAdminClient();
    let empQuery = admin
      .from("employees")
      .select("id, employee_code, full_name")
      .neq("employment_status", "TERMINATED")
      .order("employee_code");
    let rawQuery = admin
      .from("attendance_raw_events")
      .select("employee_id, event_time, direction")
      .order("event_time", { ascending: false })
      .limit(1000);

    if (!isAdminOrManager && ctx.employeeId) {
      empQuery = empQuery.eq("id", ctx.employeeId);
      rawQuery = rawQuery.eq("employee_id", ctx.employeeId);
    }

    const [{ data: employees }, { data: rawEvents }] = await Promise.all([
      empQuery,
      rawQuery,
    ]);

    // Aggregate distinct work days per employee
    const dayMap = new Map<string, Set<string>>();
    const countMap = new Map<string, number>();
    for (const ev of rawEvents ?? []) {
      const dateStr = String(ev.event_time).slice(0, 10);
      if (!dayMap.has(ev.employee_id)) dayMap.set(ev.employee_id, new Set());
      dayMap.get(ev.employee_id)!.add(dateStr);
      countMap.set(ev.employee_id, (countMap.get(ev.employee_id) ?? 0) + 1);
    }

    const summary = (employees ?? []).map((emp) => ({
      employee_id: emp.id,
      employee_code: emp.employee_code,
      full_name: emp.full_name,
      worked_days: dayMap.get(emp.id)?.size ?? 0,
      total_scans: countMap.get(emp.id) ?? 0,
    }));

    return NextResponse.json({ data: { employees: employees ?? [], summary } });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "ATTENDANCE", "UPDATE");

    const body = syncDeviceSchema.parse(await req.json());
    const admin = getSupabaseAdminClient();

    const { data: company } = await admin
      .from("companies")
      .select("id")
      .limit(1)
      .single();
    if (!company) throw new Error("Không tìm thấy pháp nhân.");

    if (body.action === "ADD_DEVICE") {
      if (!body.deviceCode || !body.deviceName || !body.locationId) {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "Thiếu mã, tên hoặc địa điểm thiết bị." } },
          { status: 400 }
        );
      }
      const { data: device, error: devErr } = await admin
        .from("attendance_devices")
        .insert({
          company_id: company.id,
          location_id: body.locationId,
          device_code: body.deviceCode.trim().toUpperCase(),
          device_name: body.deviceName.trim(),
          device_type: "FACE_ID",
          vendor: body.vendor ?? "Hikvision / ZKTeco",
          status: "ONLINE",
          last_sync_at: new Date().toISOString(),
        })
        .select("*")
        .single();
      if (devErr) throw devErr;
      return NextResponse.json({ data: device }, { status: 201 });
    }

    if (!body.deviceId) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Thiếu deviceId." } },
        { status: 400 }
      );
    }

    const { data: device, error: dErr } = await admin
      .from("attendance_devices")
      .update({ status: "ONLINE", last_sync_at: new Date().toISOString() })
      .eq("id", body.deviceId)
      .select("*")
      .single();
    if (dErr) throw dErr;

    if (body.action === "SIMULATE_SCAN" && body.employeeId) {
      const nowIso = new Date().toISOString();
      const { error: evErr } = await admin.from("attendance_raw_events").insert({
        company_id: company.id,
        employee_id: body.employeeId,
        event_time: nowIso,
        direction: body.direction ?? "IN",
        source_type: "DEVICE_FACE_ID",
        verify_mode: "FACE_ID",
        device_id: device.id,
        location_id: device.location_id,
        is_within_geofence: true,
        work_mode: "ONSITE",
        idempotency_key: `SYNC-${device.device_code}-${body.employeeId}-${Date.now()}`,
      });
      if (evErr) throw evErr;
    }

    await admin.from("audit_events").insert({
      company_id: company.id,
      actor_user_id: ctx.userId,
      actor_role: ctx.roles[0],
      action: body.action === "SIMULATE_SCAN" ? "SYNC_FACE_ID_SCAN" : "PING_ATTENDANCE_DEVICE",
      target_entity: "attendance_devices",
      target_id: device.id,
      after_data: { device_code: device.device_code, employee_id: body.employeeId },
    });

    return NextResponse.json({ data: device });
  } catch (err) {
    return handleApiError(err);
  }
}

