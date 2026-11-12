/**
 * Attendance Event Normalization & Check-in / Check-out Pairing Engine (Phase 1)
 *
 * Rules:
 * - Never fabricates missing IN/OUT timestamps.
 * - Filters duplicate scans within `duplicateWindowMinutes` (OBD-01: default 5 min).
 * - Supports overnight shifts (isOvernight = true, e.g., 22:00 day D -> 06:00 day D+1).
 * - Computes presenceHours, workedHours (minus break), lateMinutes (with graceMinutes, OBD-02),
 *   earlyMinutes, and nightHours (overlap with 22:00–06:00).
 */

export interface RawAttendanceEventInput {
  id: string;
  employeeId: string;
  eventTime: string; // ISO timestamp
  direction: "IN" | "OUT" | "UNKNOWN";
}

export interface ShiftTemplateConfig {
  id?: string;
  code: string;
  startTime: string; // HH:mm:ss or HH:mm
  endTime: string; // HH:mm:ss or HH:mm
  isOvernight: boolean;
  breakMinutes: number;
  standardWorkHours: number;
}

export interface NormalizedSessionOutput {
  employeeId: string;
  workDate: string; // YYYY-MM-DD (UTC+7 local date)
  checkInEventId: string | null;
  checkOutEventId: string | null;
  effectiveIn: string | null;
  effectiveOut: string | null;
  presenceHours: number;
  workedHours: number;
  lateMinutes: number;
  earlyMinutes: number;
  nightHours: number;
  status: "VALID" | "EXCEPTION";
  exceptionType: "MISSING_IN" | "MISSING_OUT" | null;
  duplicateCount: number;
}

const DEFAULT_SHIFT: ShiftTemplateConfig = {
  code: "HC",
  startTime: "08:00:00",
  endTime: "17:00:00",
  isOvernight: false,
  breakMinutes: 60,
  standardWorkHours: 8,
};

function toVnDateStr(isoOrDate: Date): string {
  // Convert to UTC+7 string YYYY-MM-DD
  const vnMs = isoOrDate.getTime() + 7 * 3600 * 1000;
  return new Date(vnMs).toISOString().slice(0, 10);
}

function parseVnTimestamp(workDate: string, timeStr: string, addDays = 0): Date {
  const cleanTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  const base = new Date(`${workDate}T${cleanTime}+07:00`);
  if (addDays !== 0) {
    base.setUTCDate(base.getUTCDate() + addDays);
  }
  return base;
}

function computeNightMinutes(startMs: number, endMs: number, workDate: string): number {
  if (endMs <= startMs) return 0;
  const w1Start = parseVnTimestamp(workDate, "22:00:00", 0).getTime();
  const w1End = parseVnTimestamp(workDate, "06:00:00", 1).getTime();
  const w0Start = parseVnTimestamp(workDate, "22:00:00", -1).getTime();
  const w0End = parseVnTimestamp(workDate, "06:00:00", 0).getTime();

  const overlap = (a1: number, a2: number, b1: number, b2: number) =>
    Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));

  const ms = overlap(startMs, endMs, w1Start, w1End) + overlap(startMs, endMs, w0Start, w0End);
  return Math.round(ms / 60000);
}

export function deduplicateRawEvents(
  events: RawAttendanceEventInput[],
  duplicateWindowMinutes = 5
): { kept: RawAttendanceEventInput[]; duplicateCount: number } {
  const sorted = [...events].sort(
    (a, b) => new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime()
  );
  const kept: RawAttendanceEventInput[] = [];
  let duplicateCount = 0;
  const windowMs = duplicateWindowMinutes * 60 * 1000;

  for (const ev of sorted) {
    const evMs = new Date(ev.eventTime).getTime();
    const last = kept[kept.length - 1];
    if (
      last &&
      evMs - new Date(last.eventTime).getTime() <= windowMs &&
      (ev.direction === last.direction || ev.direction === "UNKNOWN" || last.direction === "UNKNOWN")
    ) {
      duplicateCount += 1;
      continue;
    }
    kept.push(ev);
  }

  return { kept, duplicateCount };
}

export function normalizeAttendanceForEmployeeDay(params: {
  employeeId: string;
  workDate: string;
  allEmployeeEvents: RawAttendanceEventInput[];
  shift?: ShiftTemplateConfig;
  duplicateWindowMinutes?: number;
  graceMinutes?: number;
}): NormalizedSessionOutput | null {
  const {
    employeeId,
    workDate,
    allEmployeeEvents,
    shift = DEFAULT_SHIFT,
    duplicateWindowMinutes = 5,
    graceMinutes = 5,
  } = params;

  const shiftStart = parseVnTimestamp(workDate, shift.startTime, 0);
  const shiftEnd = parseVnTimestamp(
    workDate,
    shift.endTime,
    shift.isOvernight ? 1 : 0
  );

  // Window for capturing events belonging to this shift:
  // For overnight shifts: [shiftStart - 4h, shiftEnd + 4h]
  // For day shifts: full VN calendar day [00:00, 23:59:59]
  const windowStartMs = shift.isOvernight
    ? shiftStart.getTime() - 4 * 3600 * 1000
    : parseVnTimestamp(workDate, "00:00:00", 0).getTime();
  const windowEndMs = shift.isOvernight
    ? shiftEnd.getTime() + 4 * 3600 * 1000
    : parseVnTimestamp(workDate, "23:59:59", 0).getTime();

  const dayEvents = allEmployeeEvents.filter((ev) => {
    const ms = new Date(ev.eventTime).getTime();
    return ms >= windowStartMs && ms <= windowEndMs;
  });

  if (dayEvents.length === 0) return null;

  const { kept, duplicateCount } = deduplicateRawEvents(dayEvents, duplicateWindowMinutes);

  let inEvent: RawAttendanceEventInput | null = null;
  let outEvent: RawAttendanceEventInput | null = null;

  const explicitIns = kept.filter((e) => e.direction === "IN");
  const explicitOuts = kept.filter((e) => e.direction === "OUT");

  if (explicitIns.length > 0 || explicitOuts.length > 0) {
    inEvent = explicitIns[0] ?? null;
    outEvent = explicitOuts[explicitOuts.length - 1] ?? null;
    // Fallback if one side is UNKNOWN
    if (!inEvent && kept.length >= 2 && kept[0].id !== outEvent?.id) {
      inEvent = kept[0];
    }
    if (!outEvent && kept.length >= 2 && kept[kept.length - 1].id !== inEvent?.id) {
      outEvent = kept[kept.length - 1];
    }
  } else {
    // All UNKNOWN
    if (kept.length >= 2) {
      inEvent = kept[0];
      outEvent = kept[kept.length - 1];
    } else if (kept.length === 1) {
      const evMs = new Date(kept[0].eventTime).getTime();
      const distStart = Math.abs(evMs - shiftStart.getTime());
      const distEnd = Math.abs(evMs - shiftEnd.getTime());
      if (distStart <= distEnd) inEvent = kept[0];
      else outEvent = kept[0];
    }
  }

  if (!inEvent || !outEvent) {
    return {
      employeeId,
      workDate,
      checkInEventId: inEvent?.id ?? null,
      checkOutEventId: outEvent?.id ?? null,
      effectiveIn: inEvent?.eventTime ?? null,
      effectiveOut: outEvent?.eventTime ?? null,
      presenceHours: 0,
      workedHours: 0,
      lateMinutes: 0,
      earlyMinutes: 0,
      nightHours: 0,
      status: "EXCEPTION",
      exceptionType: !inEvent ? "MISSING_IN" : "MISSING_OUT",
      duplicateCount,
    };
  }

  const inMs = new Date(inEvent.eventTime).getTime();
  const outMs = new Date(outEvent.eventTime).getTime();
  if (outMs <= inMs) {
    return {
      employeeId,
      workDate,
      checkInEventId: inEvent.id,
      checkOutEventId: null,
      effectiveIn: inEvent.eventTime,
      effectiveOut: null,
      presenceHours: 0,
      workedHours: 0,
      lateMinutes: 0,
      earlyMinutes: 0,
      nightHours: 0,
      status: "EXCEPTION",
      exceptionType: "MISSING_OUT",
      duplicateCount,
    };
  }

  const presenceMinutes = Math.round((outMs - inMs) / 60000);
  const breakDeduct = presenceMinutes > 240 ? shift.breakMinutes : 0;
  const workedMinutes = Math.max(0, presenceMinutes - breakDeduct);

  const rawLate = Math.round((inMs - shiftStart.getTime()) / 60000);
  const lateMinutes = rawLate > graceMinutes ? rawLate : 0;

  const rawEarly = Math.round((shiftEnd.getTime() - outMs) / 60000);
  const earlyMinutes = rawEarly > 0 ? rawEarly : 0;

  const nightMinutes = computeNightMinutes(inMs, outMs, workDate);

  return {
    employeeId,
    workDate,
    checkInEventId: inEvent.id,
    checkOutEventId: outEvent.id,
    effectiveIn: inEvent.eventTime,
    effectiveOut: outEvent.eventTime,
    presenceHours: Number((presenceMinutes / 60).toFixed(2)),
    workedHours: Number((workedMinutes / 60).toFixed(2)),
    lateMinutes,
    earlyMinutes,
    nightHours: Number((nightMinutes / 60).toFixed(2)),
    status: "VALID",
    exceptionType: null,
    duplicateCount,
  };
}

export function extractDistinctVnWorkDates(events: RawAttendanceEventInput[]): string[] {
  const set = new Set<string>();
  for (const ev of events) {
    set.add(toVnDateStr(new Date(ev.eventTime)));
  }
  return Array.from(set).sort();
}

