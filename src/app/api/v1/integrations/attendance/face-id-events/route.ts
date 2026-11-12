import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyFaceIdWebhookSignature } from "@/lib/attendance/face-id-hmac";
import { handleApiError } from "@/lib/security/auth-session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const faceIdBatchSchema = z.object({
  batchId: z.string().min(1).max(128),
  events: z
    .array(
      z.object({
        idempotencyKey: z.string().min(4).max(200),
        deviceUserId: z.string().min(1).max(64),
        eventTime: z.string().min(10),
        verifyMode: z.enum(["FACE_ID", "FINGERPRINT", "CARD"]).default("FACE_ID"),
        direction: z.enum(["IN", "OUT", "UNKNOWN"]).default("UNKNOWN"),
      })
    )
    .min(1)
    .max(500),
});

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const deviceCode = req.headers.get("x-device-code");
    const timestampHeader = req.headers.get("x-timestamp");
    const signatureHeader = req.headers.get("x-signature-hmac");

    const sigCheck = verifyFaceIdWebhookSignature({
      secret: process.env.FACE_ID_WEBHOOK_SECRET,
      timestampHeader,
      signatureHeader,
      rawBody,
    });

    if (!sigCheck.valid) {
      return NextResponse.json(
        { error: { code: "INVALID_WEBHOOK_SIGNATURE", message: sigCheck.reason } },
        { status: 401 }
      );
    }

    if (!deviceCode) {
      return NextResponse.json(
        { error: { code: "MISSING_DEVICE_CODE", message: "Thiếu header X-Device-Code." } },
        { status: 400 }
      );
    }

    const payload = faceIdBatchSchema.parse(JSON.parse(rawBody));
    const admin = getSupabaseAdminClient();

    const { data: device, error: devErr } = await admin
      .from("attendance_devices")
      .select("id, company_id, location_id, device_code, status")
      .eq("device_code", deviceCode)
      .maybeSingle();

    if (devErr || !device || device.status !== "ACTIVE") {
      return NextResponse.json(
        { error: { code: "DEVICE_NOT_ACTIVE", message: `Thiết bị ${deviceCode} chưa kích hoạt.` } },
        { status: 404 }
      );
    }

    const deviceUserIds = Array.from(new Set(payload.events.map((e) => e.deviceUserId)));
    const [{ data: mappings }, { data: codeMatches }] = await Promise.all([
      admin
        .from("device_user_mappings")
        .select("device_user_id, employee_id")
        .eq("company_id", device.company_id)
        .in("device_user_id", deviceUserIds),
      admin
        .from("employees")
        .select("id, employee_code")
        .eq("company_id", device.company_id)
        .in("employee_code", deviceUserIds),
    ]);

    const empMap = new Map<string, string>();
    for (const emp of codeMatches ?? []) empMap.set(emp.employee_code, emp.id);
    for (const m of mappings ?? []) empMap.set(m.device_user_id, m.employee_id);

    let acceptedCount = 0;
    let duplicateOrIgnoredCount = 0;
    let unmappedCount = 0;

    for (const ev of payload.events) {
      const employeeId = empMap.get(ev.deviceUserId);
      if (!employeeId) {
        unmappedCount += 1;
        await admin.from("integration_jobs").insert({
          company_id: device.company_id,
          job_type: "FACE_ID_EVENT_SYNC",
          external_ref: ev.idempotencyKey,
          payload: { batchId: payload.batchId, deviceCode, event: ev },
          status: "UNMAPPED_USER",
          error_message: `Chưa ánh xạ deviceUserId=${ev.deviceUserId}`,
        });
        continue;
      }

      const { error: insErr } = await admin.from("attendance_raw_events").upsert(
        {
          company_id: device.company_id,
          employee_id: employeeId,
          event_time: ev.eventTime,
          direction: ev.direction,
          source_type: "DEVICE_FACE_ID",
          verify_mode: "FACE_ID",
          device_id: device.id,
          location_id: device.location_id,
          work_mode: "ONSITE",
          idempotency_key: ev.idempotencyKey,
          raw_payload: { batchId: payload.batchId, deviceUserId: ev.deviceUserId },
        },
        { onConflict: "idempotency_key", ignoreDuplicates: true }
      );

      if (insErr) {
        duplicateOrIgnoredCount += 1;
      } else {
        acceptedCount += 1;
      }
    }

    await admin
      .from("attendance_devices")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", device.id);

    return NextResponse.json({
      data: {
        batchId: payload.batchId,
        deviceCode: device.device_code,
        totalReceived: payload.events.length,
        acceptedCount,
        duplicateOrIgnoredCount,
        unmappedCount,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

