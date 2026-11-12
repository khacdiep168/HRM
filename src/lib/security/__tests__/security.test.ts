import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  computePiiBlindIndex,
  decryptPii,
  encryptPii,
  maskSensitiveValue,
} from "../pii-crypto";
import {
  assertAuthorized,
  assertNotSelfApproval,
  AuthorizationError,
  hasPermission,
} from "../rbac";

describe("Security Layer: PII Crypto & RBAC/SoD", () => {
  const aesKey = crypto.randomBytes(32).toString("base64");
  const hmacKey = crypto.randomBytes(32).toString("base64");

  it("encrypts and decrypts CCCD/bank numbers with AES-256-GCM", () => {
    const cccd = "072099001234";
    const cipher = encryptPii(cccd, aesKey);
    expect(cipher).not.toContain(cccd);
    expect(cipher.split(".")).toHaveLength(3);
    expect(decryptPii(cipher, aesKey)).toBe(cccd);
    expect(maskSensitiveValue(cccd, 4)).toBe("********1234");
  });

  it("computes deterministic blind index for duplicate lookup", () => {
    const h1 = computePiiBlindIndex(" 072099001234 ", hmacKey);
    const h2 = computePiiBlindIndex("072099001234", hmacKey);
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
  });

  it("enforces Deny-by-default: SUPER_ADMIN (IT) cannot read or export PAYROLL", () => {
    expect(hasPermission(["SUPER_ADMIN"], "PAYROLL", "READ")).toBe(false);
    expect(hasPermission(["SUPER_ADMIN"], "EMPLOYEE_SENSITIVE", "UNMASK_PII")).toBe(false);
    expect(hasPermission(["SUPER_ADMIN"], "ADMIN_AUDIT", "UPDATE")).toBe(true);
  });

  it("allows password-only login by default and enforces MFA when REQUIRE_MFA=true", () => {
    expect(() =>
      assertAuthorized(
        { userId: "u1", employeeId: "e1", roles: ["ACCOUNTANT"], mfaVerified: false },
        "PAYROLL",
        "APPROVE"
      )
    ).not.toThrow();

    process.env.REQUIRE_MFA = "true";
    try {
      expect(() =>
        assertAuthorized(
          { userId: "u1", employeeId: "e1", roles: ["ACCOUNTANT"], mfaVerified: false },
          "PAYROLL",
          "APPROVE"
        )
      ).toThrowError(AuthorizationError);

      expect(() =>
        assertAuthorized(
          { userId: "u1", employeeId: "e1", roles: ["ACCOUNTANT"], mfaVerified: true },
          "PAYROLL",
          "APPROVE"
        )
      ).not.toThrow();
    } finally {
      delete process.env.REQUIRE_MFA;
    }
  });

  it("enforces Separation of Duties (SoD): blocks self-approval", () => {
    expect(() => assertNotSelfApproval("user-123", "user-123")).toThrowError(
      AuthorizationError
    );
    expect(() => assertNotSelfApproval("user-456", "user-123")).not.toThrow();
  });
});

