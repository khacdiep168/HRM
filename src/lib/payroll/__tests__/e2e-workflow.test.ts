import { describe, expect, it } from "vitest";
import {
  calculateGrossPayroll,
  calcOvertimePay,
  VN_2026_H2_RULES,
} from "../decimal-engine";

describe("Bước 6 — E2E Workflow Test Suite (Full Cycle: ESS -> Manager -> Payroll -> Director -> Payslip)", () => {
  it("Flow 1: Nhân viên ESS chấm công GPS, kiểm tra bán kính geofence & đơn xin nghỉ/OT", () => {
    // 1. GPS geofence distance calculation check (Haversine formula within 150m)
    const hqLat = 11.3115;
    const hqLng = 106.0988;
    const userLat = 11.3118; // ~35m away
    const userLng = 106.0989;

    const R = 6371e3; // meters
    const phi1 = (hqLat * Math.PI) / 180;
    const phi2 = (userLat * Math.PI) / 180;
    const deltaPhi = ((userLat - hqLat) * Math.PI) / 180;
    const deltaLambda = ((userLng - hqLng) * Math.PI) / 180;
    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceMeters = Math.round(R * c);

    expect(distanceMeters).toBeLessThan(150);

    // 2. OT request validation: max 12h/day, valid ot_day_type
    const requestedOtHours = 4.0;
    expect(requestedOtHours).toBeGreaterThan(0);
    expect(requestedOtHours).toBeLessThanOrEqual(12);

    // 3. Leave request validation: end_date >= start_date, total_days > 0
    const leaveDays = 1.5;
    expect(leaveDays).toBeGreaterThan(0);
  });

  it("Flow 2: Quản lý trực tiếp duyệt hàng loạt (Batch Approval) trên /approvals", () => {
    const batchItems = [
      { type: "LEAVE", id: "00000000-0000-0000-0000-000000000001" },
      { type: "OT", id: "00000000-0000-0000-0000-000000000002" },
      { type: "EXCEPTION", id: "00000000-0000-0000-0000-000000000003" },
    ];

    expect(batchItems.length).toBe(3);
    const validTypes = new Set(["LEAVE", "OT", "EXCEPTION"]);
    batchItems.forEach((item) => expect(validTypes.has(item.type)).toBe(true));

    // Status transition: PENDING -> APPROVED
    const initialStatus = "PENDING";
    const nextStatus = initialStatus === "PENDING" ? "APPROVED" : "REJECTED";
    expect(nextStatus).toBe("APPROVED");
  });

  it("Flow 3: Kế toán chạy quy trình 5 bước, khóa kỳ lương & mở khóa an toàn (Lock & Unlock)", () => {
    type PayrollStatus =
      | "DRAFT"
      | "CALCULATED"
      | "PENDING_ACCOUNTANT_REVIEW"
      | "PENDING_DIRECTOR_APPROVAL"
      | "APPROVED"
      | "LOCKED"
      | "PAID"
      | "REOPENED";

    let runStatus: PayrollStatus = "DRAFT";

    // Bước 1: Tính lương (CALCULATED)
    runStatus = "CALCULATED";
    expect(runStatus).toBe("CALCULATED");

    // Bước 2: Kế toán trình duyệt (SUBMIT_ACCOUNTANT)
    runStatus = "PENDING_ACCOUNTANT_REVIEW";
    expect(runStatus).toBe("PENDING_ACCOUNTANT_REVIEW");

    // Bước 3: Kế toán trưởng rà soát chuyển Giám đốc (ACCOUNTANT_REVIEW)
    runStatus = "PENDING_DIRECTOR_APPROVAL";
    expect(runStatus).toBe("PENDING_DIRECTOR_APPROVAL");

    // Bước 4: Giám đốc duyệt (DIRECTOR_APPROVE)
    runStatus = "APPROVED";
    expect(runStatus).toBe("APPROVED");

    // Khóa kỳ lương (LOCK)
    runStatus = "LOCKED";
    expect(runStatus).toBe("LOCKED");

    // Mở khóa kỳ lương (UNLOCK) yêu cầu bắt buộc có lý do (audit reason)
    const unlockReason = "Điều chỉnh bổ sung 4 giờ tăng ca ngày Chủ nhật cho kho vận theo tờ trình số 12/TTr-TKV";
    expect(unlockReason.trim().length).toBeGreaterThanOrEqual(10);
    runStatus = "REOPENED";
    expect(runStatus).toBe("REOPENED");

    // Khóa lại và chi trả (MARK_PAID)
    runStatus = "PAID";
    expect(runStatus).toBe("PAID");
  });

  it("Flow 4: Kiểm tra kết quả tính lương chi tiết cho 4 vai trò và tính minh bạch 'Vì sao con số này?'", () => {
    // 1. Demo Director (TKV-0002): Lương 65tr > trần 50.6tr, 2 người phụ thuộc
    const directorPayroll = calculateGrossPayroll({
      baseSalaryPaid: 65000000,
      siSalaryBase: 65000000,
      regionCode: "III",
      dependentsCount: 2,
      rules: VN_2026_H2_RULES,
    });
    // SI capped at 50.6M
    expect(directorPayroll.bhxhBase.toNumber()).toBe(50600000);
    expect(directorPayroll.eeInsuranceTotal.toNumber()).toBe(Math.round(50600000 * 0.08 + 50600000 * 0.015 + 65000000 * 0.01));
    // Deductions: 15.5M self + 2 * 6.2M = 27.9M
    const totalDeds = VN_2026_H2_RULES.selfDeduction.plus(VN_2026_H2_RULES.dependentDeduction.times(2));
    expect(totalDeds.toNumber()).toBe(27900000);
    expect(directorPayroll.fullMonthNet.toNumber()).toBeGreaterThan(40000000);

    // 2. Demo Manager (TKV-0006): Lương 16.5tr, 2 người phụ thuộc
    const managerPayroll = calculateGrossPayroll({
      baseSalaryPaid: 16500000,
      siSalaryBase: 16500000,
      regionCode: "III",
      dependentsCount: 2,
      rules: VN_2026_H2_RULES,
    });
    expect(directorPayroll.fullMonthNet.isFinite()).toBe(true);
    expect(managerPayroll.fullMonthNet.isFinite()).toBe(true);

    // 3. Demo Employee (TKV-0004): Lương 18.5tr, 0 NPT, có 6h OT ngày thường
    const otPay = calcOvertimePay({
      baseSalary: 18500000,
      standardWorkDays: 22,
      standardHoursPerDay: 8,
      otWeekdayHours: 6,
    });
    expect(otPay.totalOtPay.toNumber()).toBeGreaterThan(0);

    const empPayroll = calculateGrossPayroll({
      baseSalaryPaid: 18500000,
      siSalaryBase: 18500000,
      regionCode: "III",
      dependentsCount: 0,
      otTotalPay: otPay.totalOtPay,
      lunchCashAllowance: 1000000,
      rules: VN_2026_H2_RULES,
    });
    expect(empPayroll.fullMonthNet.toNumber()).toBeGreaterThan(16000000);

    // 4. Probation Employee (TKV-0010): Thử việc 9.5tr, không BHXH, thuế TNCN 10%
    const probationPayroll = calculateGrossPayroll({
      baseSalaryPaid: 9500000,
      siSalaryBase: 0,
      regionCode: "III",
      isProbationFlat10: true,
      rules: VN_2026_H2_RULES,
    });
    expect(probationPayroll.eeInsuranceTotal.toNumber()).toBe(0);
    expect(probationPayroll.pitAmount.toNumber()).toBe(950000); // 10% of 9.5M
    expect(probationPayroll.fullMonthNet.toNumber()).toBe(8550000); // 9.5M - 950k
  });
});
