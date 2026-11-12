import { describe, expect, it } from "vitest";
import {
  deduplicateRawEvents,
  normalizeAttendanceForEmployeeDay,
  type ShiftTemplateConfig,
} from "../session-normalizer";

const HC_SHIFT: ShiftTemplateConfig = {
  code: "HC",
  startTime: "08:00:00",
  endTime: "17:00:00",
  isOvernight: false,
  breakMinutes: 60,
  standardWorkHours: 8,
};

const NIGHT_SHIFT: ShiftTemplateConfig = {
  code: "CA_DEM",
  startTime: "22:00:00",
  endTime: "06:00:00",
  isOvernight: true,
  breakMinutes: 0,
  standardWorkHours: 8,
};

describe("Phase 1 Attendance Session Normalizer", () => {
  it("OBD-01: deduplicates repeated scans within 5 minutes", () => {
    const { kept, duplicateCount } = deduplicateRawEvents(
      [
        { id: "1", employeeId: "e1", eventTime: "2026-11-12T08:00:00+07:00", direction: "IN" },
        { id: "2", employeeId: "e1", eventTime: "2026-11-12T08:02:30+07:00", direction: "IN" },
        { id: "3", employeeId: "e1", eventTime: "2026-11-12T17:01:00+07:00", direction: "OUT" },
      ],
      5
    );
    expect(duplicateCount).toBe(1);
    expect(kept.map((k) => k.id)).toEqual(["1", "3"]);
  });

  it("OBD-02: pairs day shift with 5-min grace period and 60-min break deduction", () => {
    const res = normalizeAttendanceForEmployeeDay({
      employeeId: "e1",
      workDate: "2026-11-12",
      shift: HC_SHIFT,
      graceMinutes: 5,
      allEmployeeEvents: [
        { id: "1", employeeId: "e1", eventTime: "2026-11-12T08:04:00+07:00", direction: "IN" },
        { id: "2", employeeId: "e1", eventTime: "2026-11-12T17:00:00+07:00", direction: "OUT" },
      ],
    });
    expect(res).not.toBeNull();
    expect(res?.status).toBe("VALID");
    expect(res?.lateMinutes).toBe(0); // within 5 min grace period
    expect(res?.earlyMinutes).toBe(0);
    expect(res?.workedHours).toBe(7.93);
  });

  it("handles overnight shift pairing across midnight and calculates nightHours", () => {
    const res = normalizeAttendanceForEmployeeDay({
      employeeId: "e1",
      workDate: "2026-11-12",
      shift: NIGHT_SHIFT,
      allEmployeeEvents: [
        { id: "1", employeeId: "e1", eventTime: "2026-11-12T22:00:00+07:00", direction: "IN" },
        { id: "2", employeeId: "e1", eventTime: "2026-11-13T06:00:00+07:00", direction: "OUT" },
      ],
    });
    expect(res?.status).toBe("VALID");
    expect(res?.workedHours).toBe(8);
    expect(res?.nightHours).toBe(8);
  });

  it("flags MISSING_OUT without fabricating checkout time", () => {
    const res = normalizeAttendanceForEmployeeDay({
      employeeId: "e1",
      workDate: "2026-11-12",
      shift: HC_SHIFT,
      allEmployeeEvents: [
        { id: "1", employeeId: "e1", eventTime: "2026-11-12T08:00:00+07:00", direction: "IN" },
      ],
    });
    expect(res?.status).toBe("EXCEPTION");
    expect(res?.exceptionType).toBe("MISSING_OUT");
    expect(res?.effectiveOut).toBeNull();
    expect(res?.workedHours).toBe(0);
  });

  it("flags MISSING_IN without fabricating checkin time", () => {
    const res = normalizeAttendanceForEmployeeDay({
      employeeId: "e1",
      workDate: "2026-11-12",
      shift: HC_SHIFT,
      allEmployeeEvents: [
        { id: "2", employeeId: "e1", eventTime: "2026-11-12T17:05:00+07:00", direction: "OUT" },
      ],
    });
    expect(res?.status).toBe("EXCEPTION");
    expect(res?.exceptionType).toBe("MISSING_IN");
    expect(res?.effectiveIn).toBeNull();
    expect(res?.workedHours).toBe(0);
  });
});

