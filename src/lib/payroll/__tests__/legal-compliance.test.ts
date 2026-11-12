import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import {
  calcOvertimePay,
  calculateGrossPayroll,
  VN_2026_H2_RULES,
} from "../decimal-engine";
import { buildLegalRuleConfigFromRows } from "../legal-rule-loader";
import { hasPermission } from "../../security/rbac";

describe("Bước 3 & 5 — Legal Payroll Engine (15 Edge & Compliance Cases)", () => {
  it("01. Lương tối thiểu vùng III (4.140.000 đ) tính đúng mức sàn BHXH 10.5%", () => {
    const res = calculateGrossPayroll({
      baseSalaryPaid: 4140000,
      siSalaryBase: 4140000,
      regionCode: "III",
      rules: VN_2026_H2_RULES,
    });
    expect(res.bhxhBase.toNumber()).toBe(4140000);
    expect(res.eeInsuranceTotal.toNumber()).toBe(434700);
  });

  it("02. Lương dưới trần BHXH tính đúng 10.5% NLĐ và 21.5% DN", () => {
    const res = calculateGrossPayroll({
      baseSalaryPaid: 20000000,
      siSalaryBase: 20000000,
      regionCode: "III",
      rules: VN_2026_H2_RULES,
    });
    expect(res.eeInsuranceTotal.toNumber()).toBe(2100000);
    expect(res.erInsuranceTotal.toNumber()).toBe(4300000);
  });

  it("03. Lương trên trần BHXH (60tr): BHXH/BHYT khóa trần 50.6tr (20x 2.53tr), BHTN tính trên 60tr (< 20x LTTV)", () => {
    const res = calculateGrossPayroll({
      baseSalaryPaid: 60000000,
      siSalaryBase: 60000000,
      regionCode: "III",
      rules: VN_2026_H2_RULES,
    });
    expect(res.bhxhBase.toNumber()).toBe(50600000);
    expect(res.bhtnBase.toNumber()).toBe(60000000);
    expect(res.eeBhxh.toNumber()).toBe(Math.round(50600000 * 0.08));
    expect(res.eeBhyt.toNumber()).toBe(Math.round(50600000 * 0.015));
    expect(res.eeBhtn.toNumber()).toBe(Math.round(60000000 * 0.01));
  });

  it("04. Không có người phụ thuộc (0 NPT) tính thuế TNCN chính xác", () => {
    const res = calculateGrossPayroll({
      baseSalaryPaid: 25000000,
      siSalaryBase: 25000000,
      dependentsCount: 0,
      regionCode: "III",
      rules: VN_2026_H2_RULES,
    });
    // Assessable 25,000,000 - (15,500,000 + 2,625,000) = 6,875,000 -> 5% = 343,750
    expect(res.taxableIncome.toNumber()).toBe(6875000);
    expect(res.pitAmount.toNumber()).toBe(343750);
  });

  it("05. Có 2 người phụ thuộc được trừ thêm 12.400.000 đ", () => {
    const res = calculateGrossPayroll({
      baseSalaryPaid: 25000000,
      siSalaryBase: 25000000,
      dependentsCount: 2,
      regionCode: "III",
      rules: VN_2026_H2_RULES,
    });
    expect(res.taxableIncome.toNumber()).toBe(0);
    expect(res.pitAmount.toNumber()).toBe(0);
  });

  it("06. Phụ cấp ăn trưa trong hạn mức (730.000 đ) được miễn thuế 100%", () => {
    const res = calculateGrossPayroll({
      baseSalaryPaid: 20000000,
      siSalaryBase: 20000000,
      lunchCashAllowance: 730000,
      regionCode: "III",
      rules: VN_2026_H2_RULES,
    });
    expect(res.taxExemptIncome.toNumber()).toBe(730000);
    expect(res.assessableIncome.toNumber()).toBe(20000000);
  });

  it("07. Phụ cấp ăn trưa vượt hạn mức (1.500.000 đ > 1.200.000 đ) đưa 300.000 đ vào thu nhập chịu thuế", () => {
    const res = calculateGrossPayroll({
      baseSalaryPaid: 20000000,
      siSalaryBase: 20000000,
      lunchCashAllowance: 1500000,
      regionCode: "III",
      rules: VN_2026_H2_RULES,
    });
    expect(res.taxExemptIncome.toNumber()).toBe(1200000);
    expect(res.assessableIncome.toNumber()).toBe(20300000);
  });

  it("08. OT ngày thường nhân hệ số 150%", () => {
    const ot = calcOvertimePay({
      baseSalary: 17600000,
      standardWorkDays: 22,
      otWeekdayHours: 5,
    });
    expect(ot.weekdayPay.toNumber()).toBe(750000);
  });

  it("09. OT cuối tuần nhân hệ số 200%", () => {
    const ot = calcOvertimePay({
      baseSalary: 17600000,
      standardWorkDays: 22,
      otWeekendHours: 4,
    });
    expect(ot.weekendPay.toNumber()).toBe(800000);
  });

  it("10. OT ngày lễ 300% + phụ trội làm đêm 30%", () => {
    const ot = calcOvertimePay({
      baseSalary: 17600000,
      standardWorkDays: 22,
      otHolidayHours: 2,
      nightHours: 4,
    });
    expect(ot.holidayPay.toNumber()).toBe(600000);
    expect(ot.nightSurcharge.toNumber()).toBe(120000);
    expect(ot.totalOtPay.toNumber()).toBe(720000);
  });

  it("11. Nghỉ không lương 2 ngày giảm lương theo tỷ lệ công thực tế", () => {
    const base = new Decimal(22000000);
    const prorated = base.times(20).div(22).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
    const res = calculateGrossPayroll({
      baseSalaryPaid: prorated,
      siSalaryBase: 22000000,
      regionCode: "III",
      rules: VN_2026_H2_RULES,
    });
    expect(res.grossTotal.toNumber()).toBe(20000000);
  });

  it("12. Thử việc áp dụng thuế TNCN phẳng 10% (FLAT_10) và không đóng BHXH", () => {
    const res = calculateGrossPayroll({
      baseSalaryPaid: 9500000,
      siSalaryBase: 0,
      isProbationFlat10: true,
      isUnionMember: false,
      regionCode: "III",
      rules: VN_2026_H2_RULES,
    });
    expect(res.eeInsuranceTotal.toNumber()).toBe(0);
    expect(res.pitAmount.toNumber()).toBe(950000);
    expect(res.eeUnionDues.toNumber()).toBe(0);
    expect(res.fullMonthNet.toNumber()).toBe(8550000);
  });

  it("13. Nghỉ giữa tháng (< 14 ngày công) cho phép siSalaryBase = 0 (miễn BHXH tháng)", () => {
    const res = calculateGrossPayroll({
      baseSalaryPaid: 8000000,
      siSalaryBase: 0,
      isUnionMember: false,
      regionCode: "III",
      rules: VN_2026_H2_RULES,
    });
    expect(res.eeInsuranceTotal.toNumber()).toBe(0);
    expect(res.fullMonthNet.toNumber()).toBe(8000000);
  });

  it("14. Làm tròn số nguyên VND bằng Decimal.js không bị sai số dấu phẩy động", () => {
    const ot = calcOvertimePay({
      baseSalary: 10000000,
      standardWorkDays: 22,
      otWeekdayHours: 3,
    });
    expect(Number.isInteger(ot.totalOtPay.toNumber())).toBe(true);
  });

  it("15. RBAC chéo: EMPLOYEE không có quyền PAYROLL LOCK/CREATE/UPDATE; DEPARTMENT_MANAGER không đọc ADMIN_AUDIT", () => {
    expect(hasPermission(["EMPLOYEE"], "PAYROLL", "CREATE")).toBe(false);
    expect(hasPermission(["EMPLOYEE"], "PAYROLL", "LOCK")).toBe(false);
    expect(hasPermission(["DEPARTMENT_MANAGER"], "ADMIN_AUDIT", "READ")).toBe(false);
    expect(hasPermission(["SUPER_ADMIN"], "PAYROLL", "READ")).toBe(false);
    const cfg = buildLegalRuleConfigFromRows([], "2026-11-25");
    expect(cfg.ruleVersion).toBe("VN-2026-H2");
  });
});

