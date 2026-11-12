import { NextResponse } from "next/server";
import { z } from "zod";
import { evaluateGpsCheckin } from "@/lib/attendance/geofence";
import { handleApiError, resolveAuthContext } from "@/lib/security/auth-session";
import { assertAuthorized } from "@/lib/security/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const gpsCheckinSchema = z.object({
  direction: z.enum(["IN", "OUT"]).default("IN"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().min(0).max(5000).default(20),
  workMode: z.enum(["ONSITE", "REMOTE_DUTY"]).default("ONSITE"),
  locationId: z.string().uuid().optional(),
  note: z.string().max(300).optional(),
  clientCapturedAt: z.string().optional(),
  idempotencyKey: z.string().min(8).max(160).optional(),
});

export async function GET() {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "ATTENDANCE", "READ");

    const admin = getSupabaseAdminClient();
    const isAdminOrManager = ctx.roles.some((r) =>
      ["HR_ADMIN", "HR_STAFF", "DEPARTMENT_MANAGER", "DIRECTOR", "AUDITOR", "SUPER_ADMIN"].includes(r)
    );

    let eventsQuery = admin
      .from("attendance_raw_events")
      .select(
        "id, employee_id, event_time, direction, source_type, verify_mode, location_id, distance_m, is_within_geofence, work_mode, employees(employee_code, full_name), locations(code, name)"
      )
      .order("event_time", { ascending: false })
      .limit(50);

    let exceptionsQuery = admin
      .from("attendance_exceptions")
      .select("id, employee_id, work_date, exception_type, explanation_note, status, created_at, employees(employee_code, full_name)")
      .order("created_at", { ascending: false })
      .limit(30);

    if (!isAdminOrManager && !ctx.employeeId) {
      return NextResponse.json({
        data: { events: [], exceptions: [], devices: [], locations: [], shifts: [] },
      });
    }

    if (!isAdminOrManager && ctx.employeeId) {
      eventsQuery = eventsQuery.eq("employee_id", ctx.employeeId);
      exceptionsQuery = exceptionsQuery.eq("employee_id", ctx.employeeId);
    }

    const [eventsRes, exceptionsRes, devicesRes, locationsRes, shiftsRes] = await Promise.all([
      eventsQuery,
      exceptionsQuery,
      admin
        .from("attendance_devices")
        .select("id, device_code, device_name, device_type, location_id, last_sync_at, status, locations(code, name)")
        .order("device_code"),
      admin
        .from("locations")
        .select("id, code, name, latitude, longitude, geofence_radius_m")
        .eq("is_active", true)
        .order("code"),
      admin
        .from("shift_templates")
        .select("id, code, name, start_time, end_time, is_overnight, early_handover_minutes, standard_work_hours")
        .eq("is_active", true)
        .order("code"),
    ]);

    if (eventsRes.error) throw eventsRes.error;

    return NextResponse.json({
      data: {
        events: eventsRes.data ?? [],
        exceptions: exceptionsRes.data ?? [],
        devices: devicesRes.data ?? [],
        locations: locationsRes.data ?? [],
        shifts: shiftsRes.data ?? [],
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "ATTENDANCE", "CREATE");

    if (!ctx.employeeId) {
      return NextResponse.json(
        {
          error: {
            code: "NO_EMPLOYEE_PROFILE",
            message: "Tài khoản chưa liên kết hồ sơ nhân viên để chấm công GPS.",
          },
        },
        { status: 400 }
      );
    }

    const body = gpsCheckinSchema.parse(await req.json());
    const admin = getSupabaseAdminClient();

    // 1. Verify active PDPL 91/2025 consent for ATTENDANCE_GPS
    const { data: consent } = await admin
      .from("consent_records")
      .select("id, company_id")
      .eq("subject_type", "EMPLOYEE")
      .eq("subject_id", ctx.employeeId)
      .eq("purpose_code", "ATTENDANCE_GPS")
      .is("withdrawn_at", null)
      .order("consented_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!consent) {
      return NextResponse.json(
        {
          error: {
            code: "CONSENT_REQUIRED",
            message:
              "Chưa có đồng thuận PDPL cho mục đích ATTENDANCE_GPS. Vui lòng xác nhận tại trang Đồng thuận PDPL 91/2025.",
          },
        },
        { status: 403 }
      );
    }

    // 2. Determine target workplace location (explicit locationId or employee primary location)
    let targetLocationId = body.locationId;
    if (!targetLocationId) {
      const { data: assignment } = await admin
        .from("org_assignments")
        .select("location_id")
        .eq("employee_id", ctx.employeeId)
        .eq("is_primary", true)
        .limit(1)
        .maybeSingle();
      targetLocationId = assignment?.location_id;
    }

    const { data: location } = targetLocationId
      ? await admin
          .from("locations")
          .select("id, company_id, code, name, latitude, longitude, geofence_radius_m")
          .eq("id", targetLocationId)
          .single()
      : await admin
          .from("locations")
          .select("id, company_id, code, name, latitude, longitude, geofence_radius_m")
          .order("code")
          .limit(1)
          .single();

    if (!location) {
      return NextResponse.json(
        { error: { code: "LOCATION_NOT_FOUND", message: "Không tìm thấy địa điểm chấm công." } },
        { status: 404 }
      );
    }

    const evaluation = evaluateGpsCheckin({
      userPoint: { latitude: body.latitude, longitude: body.longitude },
      locationCenter: {
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
      },
      geofenceRadiusMeters: location.geofence_radius_m,
      accuracyMeters: body.accuracyMeters,
      workMode: body.workMode,
    });

    const eventTimeIso = body.clientCapturedAt || new Date().toISOString();
    const minuteBucket = eventTimeIso.slice(0, 16);
    const idempotencyKey =
      body.idempotencyKey ?? `GPS:${ctx.employeeId}:${body.direction}:${minuteBucket}`;

    // Idempotent insert into append-only attendance_raw_events
    const { data: existing } = await admin
      .from("attendance_raw_events")
      .select("id, event_time, distance_m, is_within_geofence")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        data: { ...existing, deduplicated: true, evaluation },
      });
    }

    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    const { data: inserted, error: insErr } = await admin
      .from("attendance_raw_events")
      .insert({
        company_id: location.company_id,
        employee_id: ctx.employeeId,
        event_time: eventTimeIso,
        direction: body.direction,
        source_type: "WEB_GPS",
        verify_mode: "GPS_GEOFENCE",
        location_id: location.id,
        gps_lat: body.latitude,
        gps_lng: body.longitude,
        gps_accuracy_m: body.accuracyMeters,
        distance_m: evaluation.distanceMeters,
        is_within_geofence: evaluation.isWithinGeofence,
        work_mode: body.workMode,
        consent_record_id: consent.id,
        idempotency_key: idempotencyKey,
        raw_payload: {
          note: body.note ?? null,
          locationCode: location.code,
          clientIp,
          userAgent,
          suspiciousAccuracy: body.accuracyMeters > 150,
        },
      })
      .select("id, event_time, direction, distance_m, is_within_geofence")
      .single();

    if (insErr) throw insErr;

    let exceptionCreated = false;
    if (evaluation.needsException) {
      await admin.from("attendance_exceptions").insert({
        company_id: location.company_id,
        employee_id: ctx.employeeId,
        work_date: eventTimeIso.slice(0, 10),
        raw_event_id: inserted.id,
        exception_type: "OUT_OF_GEOFENCE",
        explanation_note: body.note
          ? `${evaluation.exceptionReason} — Ghi chú: ${body.note}`
          : evaluation.exceptionReason,
        status: "PENDING",
      });
      exceptionCreated = true;
    }

    return NextResponse.json(
      {
        data: {
          event: inserted,
          location: { code: location.code, name: location.name },
          evaluation,
          exceptionCreated,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}

