import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, resolveAuthContext } from "@/lib/security/auth-session";
import { assertAuthorized } from "@/lib/security/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const importRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  employeeCode: z.string(),
  eventTime: z.string(),
  direction: z.string().optional(),
  deviceCode: z.string().optional(),
});

const importBatchSchema = z.object({
  rows: z.array(importRowSchema).min(1).max(5000),
});

function parseFlexibleVnDateTime(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Handle "YYYY-MM-DD HH:mm" or "YYYY-MM-DD HH:mm:ss" as +07:00
  const localMatch = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (localMatch) {
    const sec = localMatch[3] ?? "00";
    const d = new Date(`${localMatch[1]}T${localMatch[2]}:${sec}+07:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(req: Request) {
  try {
    const ctx = await resolveAuthContext();
    assertAuthorized(ctx, "ATTENDANCE", "CREATE");

    const body = importBatchSchema.parse(await req.json());
    const admin = getSupabaseAdminClient();

    const [{ data: company }, { data: employees }, { data: devices }] = await Promise.all([
      admin.from("companies").select("id").limit(1).single(),
      admin.from("employees").select("id, employee_code"),
      admin.from("attendance_devices").select("id, device_code, location_id"),
    ]);

    if (!company) {
      return NextResponse.json(
        { error: { code: "COMPANY_NOT_FOUND", message: "Không tìm thấy pháp nhân công ty." } },
        { status: 400 }
      );
    }

    const empByCode = new Map(
      (employees ?? []).map((e) => [e.employee_code.trim().toUpperCase(), e.id])
    );
    const devByCode = new Map(
      (devices ?? []).map((d) => [d.device_code.trim().toUpperCase(), d])
    );

    const candidateKeys: string[] = [];
    const prepared: Array<{
      rowNumber: number;
      employeeCode: string;
      eventTimeRaw: string;
      idempotencyKey: string;
      record: Record<string, unknown>;
    }> = [];
    const errors: Array<{
      rowNumber: number;
      employeeCode: string;
      eventTime: string;
      reason: string;
    }> = [];
    const seenInBatch = new Set<string>();
    let duplicateCount = 0;

    for (const r of body.rows) {
      const code = r.employeeCode.trim().toUpperCase();
      const empId = empByCode.get(code);
      if (!empId) {
        errors.push({
          rowNumber: r.rowNumber,
          employeeCode: r.employeeCode,
          eventTime: r.eventTime,
          reason: `Mã nhân viên "${r.employeeCode}" không tồn tại trong hệ thống.`,
        });
        continue;
      }

      const parsedDate = parseFlexibleVnDateTime(r.eventTime);
      if (!parsedDate) {
        errors.push({
          rowNumber: r.rowNumber,
          employeeCode: r.employeeCode,
          eventTime: r.eventTime,
          reason: `Thời gian "${r.eventTime}" không đúng định dạng (VD: 2026-11-12 08:00:00).`,
        });
        continue;
      }

      const dirUpper = (r.direction ?? "UNKNOWN").trim().toUpperCase();
      const direction =
        dirUpper === "IN" || dirUpper === "VAO" || dirUpper === "CHECKIN"
          ? "IN"
          : dirUpper === "OUT" || dirUpper === "RA" || dirUpper === "CHECKOUT"
            ? "OUT"
            : "UNKNOWN";

      const isoTime = parsedDate.toISOString();
      const idempotencyKey = `IMPORT:${empId}:${isoTime}:${direction}`;

      if (seenInBatch.has(idempotencyKey)) {
        duplicateCount += 1;
        continue;
      }
      seenInBatch.add(idempotencyKey);

      const dev = r.deviceCode ? devByCode.get(r.deviceCode.trim().toUpperCase()) : undefined;
      candidateKeys.push(idempotencyKey);
      prepared.push({
        rowNumber: r.rowNumber,
        employeeCode: r.employeeCode,
        eventTimeRaw: r.eventTime,
        idempotencyKey,
        record: {
          company_id: company.id,
          employee_id: empId,
          event_time: isoTime,
          direction,
          source_type: "IMPORT",
          verify_mode: "FACE_ID",
          device_id: dev?.id ?? null,
          location_id: dev?.location_id ?? null,
          work_mode: "ONSITE",
          idempotency_key: idempotencyKey,
          raw_payload: {
            importedBy: ctx.userId,
            deviceCode: r.deviceCode ?? null,
            originalTime: r.eventTime,
          },
        },
      });
    }

    const existingKeys = new Set<string>();
    if (candidateKeys.length > 0) {
      const { data: existingRows } = await admin
        .from("attendance_raw_events")
        .select("idempotency_key")
        .in("idempotency_key", candidateKeys);
      for (const ex of existingRows ?? []) {
        existingKeys.add(ex.idempotency_key);
      }
    }

    const toInsert = prepared
      .filter((p) => {
        if (existingKeys.has(p.idempotencyKey)) {
          duplicateCount += 1;
          return false;
        }
        return true;
      })
      .map((p) => p.record);

    if (toInsert.length > 0) {
      const { error: insErr } = await admin.from("attendance_raw_events").insert(toInsert);
      if (insErr) throw insErr;
    }

    return NextResponse.json(
      {
        data: {
          totalRows: body.rows.length,
          importedCount: toInsert.length,
          duplicateCount,
          errorCount: errors.length,
          errors,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}

