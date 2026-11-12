import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import {
  calcOvertimePay,
  solveNetToGross,
  VN_2026_H2_RULES,
} from "../decimal-engine";
import { buildLegalRuleConfigFromRows } from "../legal-rule-loader";
import { hasPermission } from "../../security/rbac";

describe("Phase 3 & 4 Payroll Engine", () => {
  it("loads versioned statutory rules by effective date without hardcoding", () => {
    const rows = [
      {
        rule_code: "VN_MIN_WAGE_2026",
        effective_from: "2026-01-01",
        effective_to: "2026-12-31",
        status: "APPROVED",
        parameters: {
          ruleVersion: "VN-2026-H2",
          regionalMinWage: { III: 4160000 },
        },
      },
      {
        rule_code: "VN_MIN_WAGE_2027",
        effective_from: "2027-01-01",
        effective_to: null,
        status: "APPROVED",
        parameters: {
          ruleVersion: "VN-2027-Q1",
          regionalMinWage: { III: 4450000 },
        },
      },
      {
        rule_code: "UNAPPROVED_DRAFT",
        effective_from: "2026-01-01",
        effective_to: null,
        status: "DRAFT",
        parameters: {
          ruleVersion: "SHOULD-NOT-APPLY",
          regionalMinWage: { III: 9999999 },
        },
      },
    ];

    const rules2026 = buildLegalRuleConfigFromRows(rows, "2026-11-25");
    expect(rules2026.ruleVersion).toBe("VN-2026-H2");
    expect(rules2026.regionalMinWage.III.toNumber()).toBe(4160000);

    const rules2027 = buildLegalRuleConfigFromRows(rows, "2027-02-15");
    expect(rules2027.ruleVersion).toBe("VN-2027-Q1");
    expect(rules2027.regionalMinWage.III.toNumber()).toBe(4450000);
  });

  it("calculates OT Pay (150% weekday, 200% weekend, 300% holiday, +30% night surcharge)", () => {
    const res = calcOvertimePay({
      baseSalary: 17600000,
      standardWorkDays: 22,
      standardHoursPerDay: 8,
      otWeekdayHours: 2, // 2 * 100,000 * 1.5 = 300,000
      otWeekendHours: 4, // 4 * 100,000 * 2.0 = 800,000
      otHolidayHours: 1, // 1 * 100,000 * 3.0 = 300,000
      nightHours: 3,   // 3 * 100,000 * 0.3 = 90,000
    });

    expect(res.hourlyRate.toNumber()).toBe(100000);
    expect(res.weekdayPay.toNumber()).toBe(300000);
    expect(res.weekendPay.toNumber()).toBe(800000);
    expect(res.holidayPay.toNumber()).toBe(300000);
    expect(res.nightSurcharge.toNumber()).toBe(90000);
    expect(res.totalOtPay.toNumber()).toBe(1490000);
  });

  it("solves NET-to-GROSS within 1 VND tolerance", () => {
    const targetNet = new Decimal(25000000);
    const { solvedGross, result } = solveNetToGross(targetNet, {
      regionCode: "III",
      dependentsCount: 1,
      lunchCashAllowance: 730000,
      rules: VN_2026_H2_RULES,
    });

    expect(solvedGross.gt(targetNet)).toBe(true);
    expect(result.fullMonthNet.minus(targetNet).abs().lte(1)).toBe(true);
  });

  it("enforces OBD-07: SUPER_ADMIN does not have PAYROLL permissions", () => {
    expect(hasPermission(["SUPER_ADMIN"], "PAYROLL", "READ")).toBe(false);
    expect(hasPermission(["SUPER_ADMIN"], "PAYROLL", "CREATE")).toBe(false);
    expect(hasPermission(["SUPER_ADMIN"], "PAYROLL", "LOCK")).toBe(false);
    expect(hasPermission(["ACCOUNTANT"], "PAYROLL", "APPROVE")).toBe(true);
    expect(hasPermission(["HR_ADMIN"], "PAYROLL", "LOCK")).toBe(true);
  });
});
