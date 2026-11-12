import Decimal from "decimal.js";

export type RegionCode = "I" | "II" | "III" | "IV";

export interface LegalRuleConfig {
  ruleVersion: string;
  bhxhReferenceLevel: Decimal;
  bhxhBhytCapMultiplier: number;
  bhtnCapMultiplier: number;
  regionalMinWage: Record<RegionCode, Decimal>;
  selfDeduction: Decimal;
  dependentDeduction: Decimal;
  lunchCashExemptCap: Decimal;
  pitBrackets: Array<{ upTo: Decimal | null; rate: Decimal }>;
}

/**
 * Legal parameters effective 11/2026 in Vietnam (DOC-09 Rule Version VN-2026-H2):
 * - BHXH Reference Level: 2,530,000 VND (Decree 161/2026/ND-CP from 01/07/2026)
 * - Regional Min Wage: Decree 293/2025/ND-CP (Region III Ben Cau Tay Ninh = 4,140,000 VND)
 * - PIT 5-bracket progressive scale: Law 109/2025/QH15
 * - Deductions & Lunch cash exempt cap (1,200,000 VND): Resolution 110/2025 & Decree 253/2026
 */
export const VN_2026_H2_RULES: LegalRuleConfig = {
  ruleVersion: "VN-2026-H2",
  bhxhReferenceLevel: new Decimal("2530000"),
  bhxhBhytCapMultiplier: 20,
  bhtnCapMultiplier: 20,
  regionalMinWage: {
    I: new Decimal("5310000"),
    II: new Decimal("4730000"),
    III: new Decimal("4140000"),
    IV: new Decimal("3700000"),
  },
  selfDeduction: new Decimal("15500000"),
  dependentDeduction: new Decimal("6200000"),
  lunchCashExemptCap: new Decimal("1200000"),
  pitBrackets: [
    { upTo: new Decimal("10000000"), rate: new Decimal("0.05") },
    { upTo: new Decimal("30000000"), rate: new Decimal("0.10") },
    { upTo: new Decimal("60000000"), rate: new Decimal("0.20") },
    { upTo: new Decimal("100000000"), rate: new Decimal("0.30") },
    { upTo: null, rate: new Decimal("0.35") },
  ],
};

export function roundVnd(value: Decimal.Value): Decimal {
  return new Decimal(value).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
}

export function calcProgressivePit(
  taxableIncome: Decimal,
  brackets = VN_2026_H2_RULES.pitBrackets
): Decimal {
  if (taxableIncome.lte(0)) return new Decimal(0);
  let tax = new Decimal(0);
  let prev = new Decimal(0);
  for (const bracket of brackets) {
    if (taxableIncome.lte(prev)) break;
    const upper = bracket.upTo ? Decimal.min(taxableIncome, bracket.upTo) : taxableIncome;
    const slice = upper.minus(prev);
    tax = tax.plus(slice.times(bracket.rate));
    if (!bracket.upTo) break;
    prev = bracket.upTo;
  }
  return roundVnd(tax);
}

export interface GrossPayrollInput {
  baseSalaryPaid: Decimal.Value;
  siSalaryBase: Decimal.Value;
  regionCode: RegionCode;
  dependentsCount?: number;
  isForeignWorker?: boolean;
  isProbationFlat10?: boolean;
  lunchCashAllowance?: Decimal.Value;
  taxableAllowancesAndBonuses?: Decimal.Value;
  otTotalPay?: Decimal.Value;
  otTaxExemptPart?: Decimal.Value;
  otherDeductions?: Decimal.Value;
  midMonthAdvancePaid?: Decimal.Value;
  isUnionMember?: boolean;
  rules?: LegalRuleConfig;
}

export interface GrossPayrollOutput {
  grossTotal: Decimal;
  bhxhBase: Decimal;
  bhtnBase: Decimal;
  eeBhxh: Decimal;
  eeBhyt: Decimal;
  eeBhtn: Decimal;
  eeInsuranceTotal: Decimal;
  erInsuranceTotal: Decimal;
  eeUnionDues: Decimal;
  erUnionFee: Decimal;
  taxExemptIncome: Decimal;
  assessableIncome: Decimal;
  taxableIncome: Decimal;
  pitAmount: Decimal;
  fullMonthNet: Decimal;
  midMonthAdvancePaid: Decimal;
  endMonthPayable: Decimal;
  negativeBalanceCarryover: Decimal;
  employerTotalCost: Decimal;
}

/**
 * Computes Period 1 (Mid-month 15th) advance: 50% of contract base salary without allowances or deductions.
 */
export function calcMidMonthAdvance(contractBaseSalary: Decimal.Value): Decimal {
  return roundVnd(new Decimal(contractBaseSalary).times("0.5"));
}

/**
 * Computes full-month Gross-to-Net and Period 2 (End-of-month) settlement after deducting 15th advance.
 */
export function calculateGrossPayroll(input: GrossPayrollInput): GrossPayrollOutput {
  const rules = input.rules ?? VN_2026_H2_RULES;
  const basePaid = new Decimal(input.baseSalaryPaid);
  const siBaseRaw = new Decimal(input.siSalaryBase);
  const lunchCash = new Decimal(input.lunchCashAllowance ?? 0);
  const otherAllowances = new Decimal(input.taxableAllowancesAndBonuses ?? 0);
  const otTotal = new Decimal(input.otTotalPay ?? 0);
  const otExempt = new Decimal(input.otTaxExemptPart ?? 0);
  const otherDed = new Decimal(input.otherDeductions ?? 0);
  const advancePaid = new Decimal(input.midMonthAdvancePaid ?? 0);
  const dependents = input.dependentsCount ?? 0;

  const grossTotal = basePaid.plus(lunchCash).plus(otherAllowances).plus(otTotal);

  const capBhxhBhyt = rules.bhxhReferenceLevel.times(rules.bhxhBhytCapMultiplier);
  const capBhtn = rules.regionalMinWage[input.regionCode].times(rules.bhtnCapMultiplier);

  const bhxhBase = siBaseRaw.gt(0) ? Decimal.min(siBaseRaw, capBhxhBhyt) : new Decimal(0);
  const bhtnBase =
    siBaseRaw.gt(0) && !input.isForeignWorker
      ? Decimal.min(siBaseRaw, capBhtn)
      : new Decimal(0);

  const eeBhxh = roundVnd(bhxhBase.times("0.08"));
  const eeBhyt = roundVnd(bhxhBase.times("0.015"));
  const eeBhtn = roundVnd(bhtnBase.times("0.01"));
  const eeInsuranceTotal = eeBhxh.plus(eeBhyt).plus(eeBhtn);

  const erBhxh = roundVnd(bhxhBase.times("0.175"));
  const erBhyt = roundVnd(bhxhBase.times("0.03"));
  const erBhtn = roundVnd(bhtnBase.times("0.01"));
  const erInsuranceTotal = erBhxh.plus(erBhyt).plus(erBhtn);

  // Điều 30 QĐ 1408/QĐ-TLĐ (2024): Đoàn phí CĐ = 1% lương đóng BHXH (trần 10% mức lương cơ sở/tham chiếu)
  const unionCap = roundVnd(rules.bhxhReferenceLevel.times("0.10"));
  const eeUnionDues =
    input.isUnionMember && bhxhBase.gt(0)
      ? Decimal.min(roundVnd(bhxhBase.times("0.01")), unionCap)
      : new Decimal(0);
  // Kinh phí Công đoàn DN đóng = 2% quỹ lương đóng BHXH
  const erUnionFee = roundVnd(bhxhBase.times("0.02"));

  const lunchExempt = Decimal.min(lunchCash, rules.lunchCashExemptCap);
  const taxExemptIncome = lunchExempt.plus(otExempt);
  const assessableIncome = Decimal.max(0, grossTotal.minus(taxExemptIncome));

  let taxableIncome = new Decimal(0);
  let pitAmount = new Decimal(0);

  if (input.isProbationFlat10) {
    taxableIncome = assessableIncome;
    pitAmount = roundVnd(assessableIncome.times("0.10"));
  } else {
    const totalDeductions = rules.selfDeduction
      .plus(rules.dependentDeduction.times(dependents))
      .plus(eeInsuranceTotal);
    taxableIncome = Decimal.max(0, assessableIncome.minus(totalDeductions));
    pitAmount = calcProgressivePit(taxableIncome, rules.pitBrackets);
  }

  const fullMonthNet = grossTotal
    .minus(eeInsuranceTotal)
    .minus(pitAmount)
    .minus(eeUnionDues)
    .minus(otherDed);
  const rawEndMonth = fullMonthNet.minus(advancePaid);
  const endMonthPayable = rawEndMonth.gte(0) ? rawEndMonth : new Decimal(0);
  const negativeBalanceCarryover = rawEndMonth.lt(0) ? rawEndMonth.abs() : new Decimal(0);
  const employerTotalCost = grossTotal.plus(erInsuranceTotal);

  return {
    grossTotal,
    bhxhBase,
    bhtnBase,
    eeBhxh,
    eeBhyt,
    eeBhtn,
    eeInsuranceTotal,
    erInsuranceTotal,
    eeUnionDues,
    erUnionFee,
    taxExemptIncome,
    assessableIncome,
    taxableIncome,
    pitAmount,
    fullMonthNet,
    midMonthAdvancePaid: advancePaid,
    endMonthPayable,
    negativeBalanceCarryover,
    employerTotalCost,
  };
}

/**
 * Standby Net-to-Gross solver (binary search + local +/-5 VND neighborhood exactness check).
 */
export function solveNetToGross(
  targetNet: Decimal.Value,
  options: Omit<GrossPayrollInput, "baseSalaryPaid" | "siSalaryBase"> & { siFollowsGross?: boolean }
): { solvedGross: Decimal; result: GrossPayrollOutput } {
  const target = new Decimal(targetNet);
  let low = target;
  let high = roundVnd(target.times("2.5"));

  const evalGross = (g: Decimal) =>
    calculateGrossPayroll({
      ...options,
      baseSalaryPaid: g,
      siSalaryBase: options.siFollowsGross === false ? 0 : g,
    });

  while (low.lt(high)) {
    const mid = low.plus(high).div(2).floor();
    const res = evalGross(mid);
    if (res.fullMonthNet.lt(target)) {
      low = mid.plus(1);
    } else {
      high = mid;
    }
  }

  for (let offset = -5; offset <= 5; offset++) {
    const candidate = low.plus(offset);
    if (candidate.lt(0)) continue;
    const res = evalGross(candidate);
    if (res.fullMonthNet.eq(target)) {
      return { solvedGross: candidate, result: res };
    }
  }

  return { solvedGross: low, result: evalGross(low) };
}

export interface OvertimePayInput {
  baseSalary: Decimal.Value;
  standardWorkDays: number;
  standardHoursPerDay?: number;
  otWeekdayHours?: number;
  otWeekendHours?: number;
  otHolidayHours?: number;
  nightHours?: number;
  weekdayMultiplier?: number;
  weekendMultiplier?: number;
  holidayMultiplier?: number;
  nightDifferentialRate?: number;
}

export interface OvertimePayOutput {
  hourlyRate: Decimal;
  weekdayPay: Decimal;
  weekendPay: Decimal;
  holidayPay: Decimal;
  nightSurcharge: Decimal;
  totalOtPay: Decimal;
}

/**
 * Calculates OT pay & night-shift differential (Art. 98 Labor Code 2019).
 * Note: OT pay above normal hourly wage is PIT-exempt under Vietnamese tax law,
 * while base-rate portion is taxable (handled as taxable/exempt split when needed).
 */
export function calcOvertimePay(input: OvertimePayInput): OvertimePayOutput {
  const stdDays = Math.max(1, input.standardWorkDays);
  const stdHours = Math.max(1, input.standardHoursPerDay ?? 8);
  const hourlyRate = new Decimal(input.baseSalary).div(stdDays * stdHours);

  const weekdayPay = roundVnd(
    hourlyRate
      .times(input.weekdayMultiplier ?? 1.5)
      .times(input.otWeekdayHours ?? 0)
  );
  const weekendPay = roundVnd(
    hourlyRate
      .times(input.weekendMultiplier ?? 2.0)
      .times(input.otWeekendHours ?? 0)
  );
  const holidayPay = roundVnd(
    hourlyRate
      .times(input.holidayMultiplier ?? 3.0)
      .times(input.otHolidayHours ?? 0)
  );
  const nightSurcharge = roundVnd(
    hourlyRate
      .times(input.nightDifferentialRate ?? 0.3)
      .times(input.nightHours ?? 0)
  );

  const totalOtPay = weekdayPay.plus(weekendPay).plus(holidayPay).plus(nightSurcharge);
  return {
    hourlyRate: roundVnd(hourlyRate),
    weekdayPay,
    weekendPay,
    holidayPay,
    nightSurcharge,
    totalOtPay,
  };
}

