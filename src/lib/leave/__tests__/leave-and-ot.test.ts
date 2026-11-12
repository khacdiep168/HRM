import { describe, expect, it } from "vitest";
import {
  calcAvailableLeaveDays,
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

