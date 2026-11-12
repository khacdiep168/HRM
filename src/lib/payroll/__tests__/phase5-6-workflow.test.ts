import { describe, expect, it } from "vitest";
import {
  CostCenterJournalAdapter,
  NeutralCsvBankAdapter,
  escapeCsvCell,
} from "../../integrations/bank-export-adapter";
import {
  AuthorizationError,
  assertAuthorized,
  assertNotSelfApproval,
  type AuthContext,
} from "../../security/rbac";

const makeCtx = (userId: string, roles: AuthContext["roles"]): AuthContext => ({
  userId,
  employeeId: null,
  roles,
  mfaVerified: true,
});

describe("Phase 5 & 6 Payroll Workflow, Export & Security", () => {
  it("blocks self-approval in multi-level payroll transition (SoD)", () => {
    expect(() => assertNotSelfApproval("user-1", "user-1")).toThrowError(
      AuthorizationError
    );
    expect(() => assertNotSelfApproval("accountant-1", "hr-1")).not.toThrow();
  });

  it("enforces OBD-07: SUPER_ADMIN is blocked from PAYROLL read/update/approve/lock/export", () => {
    const superAdmin = makeCtx("sa-1", ["SUPER_ADMIN"]);
    for (const action of ["READ", "UPDATE", "APPROVE", "LOCK", "EXPORT"] as const) {
      expect(() => assertAuthorized(superAdmin, "PAYROLL", action)).toThrowError(
        AuthorizationError
      );
    }

    const accountant = makeCtx("acc-1", ["ACCOUNTANT"]);
    expect(() => assertAuthorized(accountant, "PAYROLL", "APPROVE")).not.toThrow();
    expect(() => assertAuthorized(accountant, "PAYROLL", "EXPORT")).not.toThrow();
  });

  it("prevents CSV formula injection and generates Bank Transfer & Cost Center CSVs", () => {
    expect(escapeCsvCell("=cmd|' /C calc'!A0")).toBe("'=cmd|' /C calc'!A0");

    const bankCsv = NeutralCsvBankAdapter.export([
      {
        employeeCode: "TKV-0001",
        fullName: "Nguyễn Khắc Diệp",
        bankAccountNumber: "1903000123456",
        bankCode: "TCB",
        bankName: "Techcombank",
        branchName: "Tây Ninh",
        amountVnd: 15082000,
        transferNote: "TKV Luong 2026-11 Dot 2",
      },
    ]);
    expect(bankCsv.startsWith("\uFEFF")).toBe(true);
    expect(bankCsv).toContain("TKV-0001");
    expect(bankCsv).toContain("15082000");

    const ccCsv = CostCenterJournalAdapter.export([
      {
        costCenterCode: "CC-SALES",
        costCenterName: "Phòng Kinh doanh",
        accountingRef: "6411",
        employeeCount: 12,
        totalGross: 250000000,
        totalEeInsurance: 26250000,
        totalErInsurance: 53750000,
        totalPit: 12000000,
        totalNetPayable: 211750000,
      },
    ]);
    expect(ccCsv).toContain("CC-SALES");
    expect(ccCsv).toContain("6411");
  });
});
