import { describe, expect, it } from "vitest";
import {
  calcAvailableLeaveDays,
  computeAnnualLeaveQuota,
  computeSeniority,
  getOvertimeMultipliers,
  validateOvertimeCaps,
} from "../overtime-rules";
import {
  CostCenterJournalAdapter,
  NeutralCsvBankAdapter,
  escapeCsvCell,
} from "../../integrations/bank-export-adapter";

describe("Leave Balance & Overtime Statutory Rules (BLLĐ 2019)", () => {
  it("requires employee consent and enforces 40h/month & 200h vs 300h annual OT caps", () => {
    expect(
      validateOvertimeCaps({
        requestedHours: 4,
        monthHoursUsed: 0,
        yearHoursUsed: 0,
        allow300hYearCap: false,
        employeeConsent: false,
      }).code
    ).toBe("CONSENT_REQUIRED");

    expect(
      validateOvertimeCaps({
        requestedHours: 5,
        monthHoursUsed: 38,
        yearHoursUsed: 38,
        allow300hYearCap: true,
        employeeConsent: true,
      }).code
    ).toBe("MONTHLY_OT_CAP_EXCEEDED");

    expect(
      validateOvertimeCaps({
        requestedHours: 4,
        monthHoursUsed: 10,
        yearHoursUsed: 198,
        allow300hYearCap: false,
        employeeConsent: true,
      }).code
    ).toBe("ANNUAL_OT_CAP_EXCEEDED");

    expect(
      validateOvertimeCaps({
        requestedHours: 4,
        monthHoursUsed: 10,
        yearHoursUsed: 250,
        allow300hYearCap: true,
        employeeConsent: true,
      }).allowed
    ).toBe(true);
  });

  it("computes statutory day/night OT multipliers and tax-exempt excess", () => {
    expect(getOvertimeMultipliers("WEEKDAY", false)).toEqual({
      multiplier: 1.5,
      taxExemptMultiplier: 0.5,
    });
    expect(getOvertimeMultipliers("WEEKEND", true)).toEqual({
      multiplier: 2.7,
      taxExemptMultiplier: 1.7,
    });
    expect(getOvertimeMultipliers("HOLIDAY", false)).toEqual({
      multiplier: 3,
      taxExemptMultiplier: 2,
    });
  });

  it("expires unused carryover leave days after March 31", () => {
    const march = calcAvailableLeaveDays({
      entitledDays: 12,
      carriedOver: 3,
      adjustedDays: 0,
      usedDays: 1,
      pendingDays: 0,
      asOfMonth: 3,
    });
    expect(march.effectiveCarryover).toBe(3);
    expect(march.availableDays).toBe(14);

    const april = calcAvailableLeaveDays({
      entitledDays: 12,
      carriedOver: 3,
      adjustedDays: 0,
      usedDays: 1,
      pendingDays: 0,
      asOfMonth: 4,
    });
    expect(april.effectiveCarryover).toBe(0);
    expect(april.availableDays).toBe(11);
  });

  it("calculates seniority and leave bonus per Vietnam Labor Code Điều 113, 114 & NĐ 145/2020", () => {
    // 7 years seniority: 1 bonus day (+1 per 5 years)
    const asOf = new Date("2026-11-08T00:00:00Z");
    const sen7 = computeSeniority("2019-11-08", asOf);
    expect(sen7.years).toBe(7);
    expect(sen7.bonusDays).toBe(1);
    expect(sen7.display).toBe("7 năm");

    // 4 years seniority: 0 bonus days
    const sen4 = computeSeniority("2022-11-08", asOf);
    expect(sen4.years).toBe(4);
    expect(sen4.bonusDays).toBe(0);
    expect(sen4.display).toBe("4 năm");

    // 10 years seniority: 2 bonus days
    const sen10 = computeSeniority("2016-11-08", asOf);
    expect(sen10.years).toBe(10);
    expect(sen10.bonusDays).toBe(2);

    // Full year entitlement: base 12 + 1 bonus = 13 days
    const quota7 = computeAnnualLeaveQuota({
      baseDays: 12,
      hireDate: "2019-11-08",
      year: 2026,
      asOfDate: asOf,
    });
    expect(quota7.totalEntitledDays).toBe(13);
    expect(quota7.bonusDays).toBe(1);
    expect(quota7.isProrated).toBe(false);

    // Prorated entitlement for employee hired during the current year (March 2026 -> 10 months worked)
    const quotaNew = computeAnnualLeaveQuota({
      baseDays: 12,
      hireDate: "2026-03-01",
      year: 2026,
      asOfDate: asOf,
    });
    expect(quotaNew.isProrated).toBe(true);
    expect(quotaNew.workedMonthsInYear).toBe(10);
    expect(quotaNew.totalEntitledDays).toBe(10);
  });
});

describe("Bank Transfer & Cost-Center Accounting CSV Adapters", () => {
  it("neutralizes CSV formula injection and outputs UTF-8 BOM CSV", () => {
    expect(escapeCsvCell("=CMD('calc')")).toBe("'=CMD('calc')");

    const bankCsv = NeutralCsvBankAdapter.export([
      {
        employeeCode: "TKV-0001",
        fullName: "Khắc Điệp",
        bankAccountNumber: "1029384756",
        bankCode: "VCB",
        bankName: "Vietcombank",
        branchName: "Tây Ninh",
        amountVnd: 10000000,
        transferNote: "Luong T11/2026 Dot 1",
      },
    ]);
    expect(bankCsv.startsWith("\uFEFFSTT,Ma_NV")).toBe(true);
    expect(bankCsv).toContain("1029384756");

    const ccCsv = CostCenterJournalAdapter.export([
      {
        costCenterCode: "CC-BAIXE",
        costCenterName: "Bộ phận Bãi xe",
        accountingRef: "154-BAIXE",
        employeeCount: 12,
        totalGross: 150000000,
        totalEeInsurance: 15750000,
        totalErInsurance: 32250000,
        totalPit: 4200000,
        totalNetPayable: 130050000,
      },
    ]);
    expect(ccCsv).toContain("CC-BAIXE");
    expect(ccCsv).toContain("154-BAIXE");
  });
});

