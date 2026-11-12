import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import {
  calcMidMonthAdvance,
  calculateGrossPayroll,
  roundVnd,
  solveNetToGross,
} from "../decimal-engine";

describe("Vietnam Payroll Engine VN-2026-H2 (Golden Test Cases GTC-01..GTC-11)", () => {
  it("GTC-01: Standard employee below caps, PIT bracket 1", () => {
    const res = calculateGrossPayroll({
      baseSalaryPaid: 25_000_000,
      siSalaryBase: 25_000_000,
      regionCode: "I",
      dependentsCount: 1,
    });
    expect(res.eeInsuranceTotal.toNumber()).toBe(2_625_000);
    expect(res.pitAmount.toNumber()).toBe(33_750);
    expect(res.fullMonthNet.toNumber()).toBe(22_341_250);
    expect(res.employerTotalCost.toNumber()).toBe(30_375_000);
  });

  it("GTC-02: High salary split caps (above BHXH 50.6M, below BHTN Region I 106.2M)", () => {
    const res = calculateGrossPayroll({
      baseSalaryPaid: 70_000_000,
      siSalaryBase: 70_000_000,
      regionCode: "I",
      dependentsCount: 0,
    });
    expect(res.bhxhBase.toNumber()).toBe(50_600_000);
    expect(res.bhtnBase.toNumber()).toBe(70_000_000);
    expect(res.eeInsuranceTotal.toNumber()).toBe(5_507_000);
    expect(res.pitAmount.toNumber()).toBe(6_298_600);
    expect(res.fullMonthNet.toNumber()).toBe(58_194_400);
    expect(res.employerTotalCost.toNumber()).toBe(81_073_000);
  });

  it("GTC-03: Executive salary exceeding both caps and hitting PIT bracket 5 (35%)", () => {
    const res = calculateGrossPayroll({
      baseSalaryPaid: 150_000_000,
      siSalaryBase: 150_000_000,
      regionCode: "I",
      dependentsCount: 2,
    });
    expect(res.eeInsuranceTotal.toNumber()).toBe(5_869_000);
    expect(res.pitAmount.toNumber()).toBe(26_180_850);
    expect(res.fullMonthNet.toNumber()).toBe(117_950_150);
    expect(res.employerTotalCost.toNumber()).toBe(161_435_000);
  });

  it("GTC-04: Weekday OT (150%) + Holiday night OT (270%) with PIT tax exemption", () => {
    const otWeekday = roundVnd(new Decimal(10).times(125_000).times("1.5"));
    const otHolidayNight = roundVnd(new Decimal(4).times(125_000).times("2.7"));
    const otExempt = roundVnd(new Decimal(10).times(125_000).times("0.5")).plus(
      roundVnd(new Decimal(4).times(125_000).times("1.7"))
    );
    const res = calculateGrossPayroll({
      baseSalaryPaid: 22_000_000,
      siSalaryBase: 22_000_000,
      regionCode: "I",
      otTotalPay: otWeekday.plus(otHolidayNight),
      otTaxExemptPart: otExempt,
    });
    expect(res.grossTotal.toNumber()).toBe(25_225_000);
    expect(res.taxExemptIncome.toNumber()).toBe(1_475_000);
    expect(res.pitAmount.toNumber()).toBe(297_000);
    expect(res.fullMonthNet.toNumber()).toBe(22_618_000);
  });

  it("GTC-05: Unpaid leave proration (<14d keeps SI) + cash lunch above ND 253/2026 cap (1.2M)", () => {
    const proratedBase = roundVnd(new Decimal(20_000_000).times(18).div(22));
    const res = calculateGrossPayroll({
      baseSalaryPaid: proratedBase,
      siSalaryBase: 20_000_000,
      regionCode: "I",
      lunchCashAllowance: 1_500_000,
      taxableAllowancesAndBonuses: 1_000_000,
    });
    expect(res.grossTotal.toNumber()).toBe(18_863_636);
    expect(res.taxExemptIncome.toNumber()).toBe(1_200_000);
    expect(res.pitAmount.toNumber()).toBe(3_182);
    expect(res.fullMonthNet.toNumber()).toBe(16_760_454);
  });

  it("GTC-06: Net-to-Gross exactness (0 VND variance)", () => {
    const { solvedGross, result } = solveNetToGross(30_000_000, {
      regionCode: "I",
      dependentsCount: 1,
    });
    expect(solvedGross.toNumber()).toBe(34_007_645);
    expect(result.fullMonthNet.toNumber()).toBe(30_000_000);
    expect(result.pitAmount.toNumber()).toBe(436_842);
  });

  it("GTC-07: Probation flat 10% PIT withholding without SI", () => {
    const res = calculateGrossPayroll({
      baseSalaryPaid: 17_000_000,
      siSalaryBase: 0,
      regionCode: "III",
      isProbationFlat10: true,
    });
    expect(res.eeInsuranceTotal.toNumber()).toBe(0);
    expect(res.pitAmount.toNumber()).toBe(1_700_000);
    expect(res.fullMonthNet.toNumber()).toBe(15_300_000);
  });

  it("GTC-08: Foreign resident worker (exempt from BHTN)", () => {
    const res = calculateGrossPayroll({
      baseSalaryPaid: 80_000_000,
      siSalaryBase: 80_000_000,
      regionCode: "I",
      isForeignWorker: true,
    });
    expect(res.bhtnBase.toNumber()).toBe(0);
    expect(res.eeInsuranceTotal.toNumber()).toBe(4_807_000);
    expect(res.pitAmount.toNumber()).toBe(8_438_600);
    expect(res.fullMonthNet.toNumber()).toBe(66_754_400);
  });

  it("GTC-09: Region III (Ben Cau, Tay Ninh) BHTN cap 82.8M vs BHXH cap 50.6M", () => {
    const res = calculateGrossPayroll({
      baseSalaryPaid: 100_000_000,
      siSalaryBase: 100_000_000,
      regionCode: "III",
      dependentsCount: 1,
    });
    expect(res.bhxhBase.toNumber()).toBe(50_600_000);
    expect(res.bhtnBase.toNumber()).toBe(82_800_000);
    expect(res.eeInsuranceTotal.toNumber()).toBe(5_635_000);
    expect(res.pitAmount.toNumber()).toBe(12_299_500);
    expect(res.fullMonthNet.toNumber()).toBe(82_065_500);
    expect(res.employerTotalCost.toNumber()).toBe(111_201_000);
  });

  it("GTC-10: Flexible per-department & per-employee allowances (Bai xe Region III)", () => {
    const res = calculateGrossPayroll({
      baseSalaryPaid: 8_000_000,
      siSalaryBase: 8_000_000,
      regionCode: "III",
      lunchCashAllowance: 960_000,
      taxableAllowancesAndBonuses: 1_800_000,
    });
    expect(res.grossTotal.toNumber()).toBe(10_760_000);
    expect(res.taxExemptIncome.toNumber()).toBe(960_000);
    expect(res.eeInsuranceTotal.toNumber()).toBe(840_000);
    expect(res.pitAmount.toNumber()).toBe(0);
    expect(res.fullMonthNet.toNumber()).toBe(9_920_000);
  });

  it("GTC-11: Two-installment payroll (15th 50% advance without allowances + End-month settlement)", () => {
    const advance15 = calcMidMonthAdvance(12_000_000);
    expect(advance15.toNumber()).toBe(6_000_000);

    const hourly = new Decimal(12_000_000).div(176);
    const otTotal = roundVnd(hourly.times(8).times("1.5"));
    const otExempt = roundVnd(hourly.times(8).times("0.5"));

    const res = calculateGrossPayroll({
      baseSalaryPaid: 12_000_000,
      siSalaryBase: 12_000_000,
      regionCode: "III",
      lunchCashAllowance: 1_000_000,
      taxableAllowancesAndBonuses: 2_000_000,
      otTotalPay: otTotal,
      otTaxExemptPart: otExempt,
      midMonthAdvancePaid: advance15,
    });

    expect(res.grossTotal.toNumber()).toBe(15_818_182);
    expect(res.eeInsuranceTotal.toNumber()).toBe(1_260_000);
    expect(res.pitAmount.toNumber()).toBe(0);
    expect(res.fullMonthNet.toNumber()).toBe(14_558_182);
    expect(res.endMonthPayable.toNumber()).toBe(8_558_182);
    expect(advance15.plus(res.endMonthPayable).toNumber()).toBe(res.fullMonthNet.toNumber());
  });

  it("GTC-12: Union dues per Decision 1408/QD-TLD 2024 (1% BHXH salary, capped at 10% reference level) + 2% ER union fee", () => {
    const res15 = calculateGrossPayroll({
      baseSalaryPaid: 15_000_000,
      siSalaryBase: 15_000_000,
      regionCode: "III",
      isUnionMember: true,
    });
    expect(res15.eeUnionDues.toNumber()).toBe(150_000);
    expect(res15.erUnionFee.toNumber()).toBe(300_000);

    const res40 = calculateGrossPayroll({
      baseSalaryPaid: 40_000_000,
      siSalaryBase: 40_000_000,
      regionCode: "III",
      isUnionMember: true,
    });
    // Capped at 10% of 2,530,000 = 253,000 VND
    expect(res40.eeUnionDues.toNumber()).toBe(253_000);
    expect(res40.erUnionFee.toNumber()).toBe(800_000);
  });
});

