export type OtDayType = "WEEKDAY" | "WEEKEND" | "HOLIDAY";

export interface OtValidationResult {
  allowed: boolean;
  code?: "CONSENT_REQUIRED" | "MONTHLY_OT_CAP_EXCEEDED" | "ANNUAL_OT_CAP_EXCEEDED";
  message?: string;
  monthlyCap: number;
  annualCap: number;
}

/**
 * Validates Vietnam Labor Code 2019 Điều 107 overtime consent and statutory caps:
 * - Mandatory employee consent (`employeeConsent === true`)
 * - Monthly cap: 40 hours/month
 * - Annual cap: 200 hours/year (or 300 hours/year for approved operational positions)
 */
export function validateOvertimeCaps(params: {
  requestedHours: number;
  monthHoursUsed: number;
  yearHoursUsed: number;
  allow300hYearCap: boolean;
  employeeConsent: boolean;
}): OtValidationResult {
  const monthlyCap = 40;
  const annualCap = params.allow300hYearCap ? 300 : 200;

  if (!params.employeeConsent) {
    return {
      allowed: false,
      code: "CONSENT_REQUIRED",
      message: "Bắt buộc có sự đồng ý làm thêm giờ của người lao động (BLLĐ Điều 107).",
      monthlyCap,
      annualCap,
    };
  }

  if (params.monthHoursUsed + params.requestedHours > monthlyCap) {
    return {
      allowed: false,
      code: "MONTHLY_OT_CAP_EXCEEDED",
      message: `Vượt trần tăng ca tháng 40h (đã dùng ${params.monthHoursUsed}h + đăng ký ${params.requestedHours}h).`,
      monthlyCap,
      annualCap,
    };
  }

  if (params.yearHoursUsed + params.requestedHours > annualCap) {
    return {
      allowed: false,
      code: "ANNUAL_OT_CAP_EXCEEDED",
      message: `Vượt trần tăng ca năm ${annualCap}h (đã dùng ${params.yearHoursUsed}h + đăng ký ${params.requestedHours}h).`,
      monthlyCap,
      annualCap,
    };
  }

  return { allowed: true, monthlyCap, annualCap };
}

/**
 * Returns total OT multiplier and tax-exempt excess multiplier per Vietnam Labor Code Điều 98
 * and Circular 111/2013/TT-BTC (excess above 1.0x normal rate is PIT tax-exempt).
 */
export function getOvertimeMultipliers(otDayType: OtDayType, isNightShift: boolean): {
  multiplier: number;
  taxExemptMultiplier: number;
} {
  const baseOt = otDayType === "HOLIDAY" ? 3.0 : otDayType === "WEEKEND" ? 2.0 : 1.5;
  if (!isNightShift) {
    return {
      multiplier: baseOt,
      taxExemptMultiplier: Number((baseOt - 1.0).toFixed(4)),
    };
  }
  // Night OT: baseOt + 0.30 night diff + 0.20 * baseOt night OT premium
  const nightTotal = Number((baseOt + 0.3 + 0.2 * baseOt).toFixed(4));
  return {
    multiplier: nightTotal,
    taxExemptMultiplier: Number((nightTotal - 1.0).toFixed(4)),
  };
}

/**
 * Computes available annual leave balance, expiring carried-over days after carryoverExpiryMonth (default March 31).
 */
export function calcAvailableLeaveDays(params: {
  entitledDays: number;
  carriedOver: number;
  adjustedDays: number;
  usedDays: number;
  pendingDays: number;
  asOfMonth: number;
  carryoverExpiryMonth?: number;
}): { effectiveCarryover: number; availableDays: number } {
  const expiryMonth = params.carryoverExpiryMonth ?? 3;
  const effectiveCarryover = params.asOfMonth > expiryMonth ? 0 : params.carriedOver;
  const available =
    params.entitledDays +
    effectiveCarryover +
    params.adjustedDays -
    params.usedDays -
    params.pendingDays;

  return {
    effectiveCarryover,
    availableDays: Math.max(0, Math.round(available * 100) / 100),
  };
}

