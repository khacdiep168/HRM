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

/**
 * Calculates employee seniority from hire date per Vietnam Labor Code (BLLĐ 2019) Điều 114:
 * "Cứ đủ 05 năm làm việc cho một người sử dụng lao động thì số ngày nghỉ hằng năm... được tăng thêm tương ứng 01 ngày."
 */
export function computeSeniority(hireDateStr: string, asOfDate: Date = new Date()): {
  years: number;
  months: number;
  totalMonths: number;
  bonusDays: number;
  display: string;
} {
  const hire = new Date(hireDateStr);
  if (isNaN(hire.getTime())) {
    return { years: 0, months: 0, totalMonths: 0, bonusDays: 0, display: "0 năm" };
  }

  let years = asOfDate.getFullYear() - hire.getFullYear();
  let months = asOfDate.getMonth() - hire.getMonth();
  if (asOfDate.getDate() < hire.getDate()) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  years = Math.max(0, years);
  months = Math.max(0, months);
  const totalMonths = years * 12 + months;

  // Điều 114 BLLĐ 2019: Cứ đủ 5 năm thâm niên được tăng thêm 1 ngày phép
  const bonusDays = Math.floor(years / 5);

  const display = years > 0 ? `${years} năm` : `${months} tháng`;
  return { years, months, totalMonths, bonusDays, display };
}

/**
 * Calculates annual leave entitlement based on:
 * - Điều 113 BLLĐ 2019: Base 12 days (normal), 14 days (hazardous/heavy), 16 days (extremely hazardous)
 * - Điều 114 BLLĐ 2019: Seniority bonus (+1 day per full 5 years)
 * - Điều 66 Nghị định 145/2020/NĐ-CP: Prorated quota for employees working less than 12 months in the year
 */
export function computeAnnualLeaveQuota(params: {
  baseDays: number;
  hireDate: string;
  year: number;
  asOfDate?: Date;
}): {
  seniorityYears: number;
  seniorityMonths: number;
  seniorityDisplay: string;
  bonusDays: number;
  totalEntitledDays: number;
  isProrated: boolean;
  workedMonthsInYear: number;
} {
  const asOf = params.asOfDate ?? new Date();
  const seniority = computeSeniority(params.hireDate, asOf);
  const hire = new Date(params.hireDate);
  const hireYear = hire.getFullYear();

  if (hireYear > params.year) {
    return {
      seniorityYears: 0,
      seniorityMonths: 0,
      seniorityDisplay: "0 năm",
      bonusDays: 0,
      totalEntitledDays: 0,
      isProrated: true,
      workedMonthsInYear: 0,
    };
  }

  if (hireYear === params.year) {
    // Chưa đủ 12 tháng làm việc trong năm: Điều 66 NĐ 145/2020
    const hireMonth = hire.getMonth() + 1; // 1-12
    const workedMonths = 12 - hireMonth + (hire.getDate() <= 15 ? 1 : 0);
    const cappedMonths = Math.max(1, Math.min(12, workedMonths));
    const rawDays = ((params.baseDays + seniority.bonusDays) / 12) * cappedMonths;
    const totalEntitledDays = Math.round(rawDays);
    return {
      seniorityYears: seniority.years,
      seniorityMonths: seniority.months,
      seniorityDisplay: seniority.display,
      bonusDays: seniority.bonusDays,
      totalEntitledDays,
      isProrated: true,
      workedMonthsInYear: cappedMonths,
    };
  }

  // Đã làm việc từ các năm trước: đủ 12 tháng
  return {
    seniorityYears: seniority.years,
    seniorityMonths: seniority.months,
    seniorityDisplay: seniority.display,
    bonusDays: seniority.bonusDays,
    totalEntitledDays: params.baseDays + seniority.bonusDays,
    isProrated: false,
    workedMonthsInYear: 12,
  };
}

