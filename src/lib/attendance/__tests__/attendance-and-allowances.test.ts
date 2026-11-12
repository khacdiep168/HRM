import { describe, expect, it } from "vitest";
import { evaluateGpsCheckin, haversineDistanceMeters } from "../geofence";
import { computeFaceIdSignature, verifyFaceIdWebhookSignature } from "../face-id-hmac";
import {
  resolveEmployeeAllowances,
  type SalaryComponentDef,
} from "../../payroll/allowance-resolver";

describe("GPS Geofencing (Haversine) & Face ID HMAC Security", () => {
  const vp75a = { latitude: 11.0789, longitude: 106.1784 };

  it("allows check-in within VP-75A 150m geofence", () => {
    const result = evaluateGpsCheckin({
      userPoint: { latitude: 11.0792, longitude: 106.1786 },
      locationCenter: vp75a,
      geofenceRadiusMeters: 150,
      accuracyMeters: 20,
      workMode: "ONSITE",
    });
    expect(result.distanceMeters).toBeLessThan(60);
    expect(result.isWithinGeofence).toBe(true);
    expect(result.needsException).toBe(false);
  });

  it("flags OUT_OF_GEOFENCE exception for on-site check-in outside radius, but skips for REMOTE_DUTY drivers", () => {
    const farPoint = { latitude: 11.095, longitude: 106.19 };
    const dist = haversineDistanceMeters(vp75a, farPoint);
    expect(dist).toBeGreaterThan(2000);

    const onsite = evaluateGpsCheckin({
      userPoint: farPoint,
      locationCenter: vp75a,
      geofenceRadiusMeters: 150,
      accuracyMeters: 15,
      workMode: "ONSITE",
    });
    expect(onsite.isWithinGeofence).toBe(false);
    expect(onsite.needsException).toBe(true);

    const driver = evaluateGpsCheckin({
      userPoint: farPoint,
      locationCenter: vp75a,
      geofenceRadiusMeters: 150,
      accuracyMeters: 15,
      workMode: "REMOTE_DUTY",
    });
    expect(driver.needsException).toBe(false);
  });

  it("verifies valid Face ID HMAC signature and rejects replay outside ±300s", () => {
    const secret = "test-faceid-secret";
    const ts = "1794452400";
    const body = JSON.stringify({ batchId: "b1", events: [] });
    const sig = computeFaceIdSignature(secret, ts, body);

    expect(
      verifyFaceIdWebhookSignature({
        secret,
        timestampHeader: ts,
        signatureHeader: sig,
        rawBody: body,
        nowEpochSeconds: 1794452500,
      }).valid
    ).toBe(true);

    expect(
      verifyFaceIdWebhookSignature({
        secret,
        timestampHeader: ts,
        signatureHeader: sig,
        rawBody: body,
        nowEpochSeconds: 1794453000, // +600s > 300s
      }).valid
    ).toBe(false);

    expect(
      verifyFaceIdWebhookSignature({
        secret,
        timestampHeader: ts,
        signatureHeader: "deadbeef",
        rawBody: body,
        nowEpochSeconds: 1794452500,
      }).valid
    ).toBe(false);
  });
});

describe("3-Tier Flexible Allowance Resolver", () => {
  const components: SalaryComponentDef[] = [
    {
      id: "c-lunch",
      code: "LUNCH_ALLOWANCE",
      name: "Tiền ăn trưa",
      category: "ALLOWANCE",
      calcMode: "PER_WORKDAY",
      isTaxable: true,
      taxExemptRuleCode: "DECREE_253_2026_LUNCH",
      taxExemptCap: 1200000,
    },
    {
      id: "c-bonus",
      code: "SALES_COMMISSION",
      name: "Thưởng doanh số",
      category: "BONUS",
      calcMode: "VARIABLE_INPUT",
      isTaxable: true,
      taxExemptRuleCode: null,
      taxExemptCap: 0,
    },
  ];

  it("applies precedence Tier 3 > Tier 2 > Tier 1 and enforces 1.2M lunch tax-exempt cap", () => {
    const resolved = resolveEmployeeAllowances({
      employeeId: "emp-1",
      departmentId: "dept-baixe",
      positionId: "pos-nvbx",
      paidWorkDays: 22,
      components,
      deptPolicies: [
        {
          departmentId: "dept-baixe",
          positionId: null,
          salaryComponentId: "c-lunch",
          defaultAmount: 55000,
          calcMode: "PER_WORKDAY",
        },
      ],
      empOverrides: [
        {
          employeeId: "emp-1",
          salaryComponentId: "c-lunch",
          overrideAmount: 70000, // 70,000 * 22 = 1,540,000 -> 1,200,000 exempt, 340,000 taxable
          calcMode: "PER_WORKDAY",
        },
      ],
      periodVariables: [
        {
          employeeId: "emp-1",
          salaryComponentId: "c-bonus",
          amount: 2500000,
          quantity: 1,
        },
      ],
    });

    const lunch = resolved.lines.find((l) => l.componentCode === "LUNCH_ALLOWANCE");
    expect(lunch?.tierSource).toBe("EMPLOYEE_OVERRIDE");
    expect(lunch?.totalAmount).toBe(1540000);
    expect(lunch?.taxExemptAmount).toBe(1200000);
    expect(lunch?.taxableAmount).toBe(340000);
    expect(resolved.lunchCashAllowance).toBe(1540000);
    expect(resolved.taxableAllowancesAndBonuses).toBe(2500000);
  });
});

