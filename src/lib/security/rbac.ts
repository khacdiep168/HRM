export type RoleCode =
  | "SUPER_ADMIN"
  | "HR_ADMIN"
  | "HR_STAFF"
  | "DEPARTMENT_MANAGER"
  | "ACCOUNTANT"
  | "DIRECTOR"
  | "EMPLOYEE"
  | "AUDITOR";

export type ActionCode =
  | "READ"
  | "CREATE"
  | "UPDATE"
  | "APPROVE"
  | "LOCK"
  | "EXPORT"
  | "UNMASK_PII";

export type ModuleCode =
  | "EMPLOYEE"
  | "EMPLOYEE_SENSITIVE"
  | "ORGANIZATION"
  | "RECRUITMENT"
  | "LIFECYCLE"
  | "CONTRACTS"
  | "ATTENDANCE"
  | "SHIFTS"
  | "LEAVE"
  | "OVERTIME"
  | "PAYROLL"
  | "PIT"
  | "INSURANCE"
  | "PERFORMANCE"
  | "LEARNING"
  | "ASSETS"
  | "ESS"
  | "WORKFLOW"
  | "ADMIN_AUDIT";

export const MFA_REQUIRED_ROLES: ReadonlySet<RoleCode> = new Set([
  "SUPER_ADMIN",
  "HR_ADMIN",
  "ACCOUNTANT",
  "DIRECTOR",
  "AUDITOR",
]);

/**
 * Declarative RBAC matrix aligned 1:1 with DOC-17_Security_and_RBAC_Matrix.md.
 * Deny-by-default: anything omitted is denied.
 */
const ROLE_PERMISSIONS: Record<RoleCode, Partial<Record<ModuleCode, readonly ActionCode[]>>> = {
  SUPER_ADMIN: {
    ORGANIZATION: ["READ"],
    LIFECYCLE: ["READ", "UPDATE"], // Create/lock IT accounts only
    WORKFLOW: ["READ", "UPDATE"],
    ADMIN_AUDIT: ["READ", "CREATE", "UPDATE"], // Tech/devices/geofence; NO payroll/PII
  },
  HR_ADMIN: {
    EMPLOYEE: ["READ", "CREATE", "UPDATE", "EXPORT"],
    EMPLOYEE_SENSITIVE: ["READ", "UPDATE", "UNMASK_PII", "EXPORT"],
    ORGANIZATION: ["READ", "CREATE", "UPDATE", "APPROVE"],
    RECRUITMENT: ["READ", "CREATE", "UPDATE", "APPROVE", "EXPORT"],
    LIFECYCLE: ["READ", "CREATE", "UPDATE", "APPROVE"],
    CONTRACTS: ["READ", "CREATE", "UPDATE", "APPROVE", "EXPORT"],
    ATTENDANCE: ["READ", "UPDATE", "APPROVE", "LOCK", "EXPORT"],
    SHIFTS: ["READ", "CREATE", "UPDATE", "APPROVE"],
    LEAVE: ["READ", "CREATE", "UPDATE", "APPROVE", "EXPORT"],
    OVERTIME: ["READ", "UPDATE", "APPROVE", "EXPORT"],
    PAYROLL: ["READ", "CREATE", "UPDATE", "LOCK", "EXPORT"],
    PIT: ["READ", "CREATE", "UPDATE"],
    INSURANCE: ["READ", "CREATE", "UPDATE", "EXPORT"],
    PERFORMANCE: ["READ", "CREATE", "UPDATE", "APPROVE", "EXPORT"],
    LEARNING: ["READ", "CREATE", "UPDATE", "APPROVE", "EXPORT"],
    ASSETS: ["READ", "CREATE", "UPDATE", "EXPORT"],
    ESS: ["READ"],
    WORKFLOW: ["READ", "CREATE", "UPDATE"],
    ADMIN_AUDIT: ["READ", "CREATE", "UPDATE", "EXPORT"],
  },
  HR_STAFF: {
    EMPLOYEE: ["READ", "CREATE", "UPDATE"],
    EMPLOYEE_SENSITIVE: ["READ", "CREATE", "UPDATE"], // Masked
    ORGANIZATION: ["READ", "CREATE", "UPDATE"],
    RECRUITMENT: ["READ", "CREATE", "UPDATE"],
    LIFECYCLE: ["READ", "CREATE", "UPDATE"],
    CONTRACTS: ["READ", "CREATE", "UPDATE"],
    ATTENDANCE: ["READ", "CREATE", "UPDATE"],
    SHIFTS: ["READ", "CREATE", "UPDATE"],
    LEAVE: ["READ", "CREATE", "UPDATE"],
    OVERTIME: ["READ", "CREATE", "UPDATE"],
    PAYROLL: ["READ", "CREATE"],
    PIT: ["READ", "CREATE", "UPDATE"],
    INSURANCE: ["READ", "CREATE", "UPDATE"],
    PERFORMANCE: ["READ"],
    LEARNING: ["READ", "CREATE", "UPDATE"],
    ASSETS: ["READ", "CREATE", "UPDATE"],
    ESS: ["READ"],
    WORKFLOW: ["READ"],
    ADMIN_AUDIT: ["READ"],
  },
  DEPARTMENT_MANAGER: {
    EMPLOYEE: ["READ"],
    ORGANIZATION: ["READ"],
    RECRUITMENT: ["READ", "CREATE", "UPDATE"],
    LIFECYCLE: ["READ", "UPDATE"],
    CONTRACTS: ["READ"],
    ATTENDANCE: ["READ", "APPROVE"],
    SHIFTS: ["READ", "CREATE", "UPDATE", "APPROVE"],
    LEAVE: ["READ", "APPROVE"],
    OVERTIME: ["READ", "APPROVE"],
    PERFORMANCE: ["READ", "CREATE", "UPDATE", "APPROVE"],
    LEARNING: ["READ", "APPROVE"],
    ASSETS: ["READ"],
    ESS: ["READ"],
    WORKFLOW: ["READ", "APPROVE"],
  },
  ACCOUNTANT: {
    EMPLOYEE: ["READ"],
    EMPLOYEE_SENSITIVE: ["READ", "UNMASK_PII"], // Bank & tax code only (enforced in field projection)
    ORGANIZATION: ["READ"],
    LIFECYCLE: ["READ", "UPDATE"],
    CONTRACTS: ["READ"],
    ATTENDANCE: ["READ"],
    LEAVE: ["READ"],
    OVERTIME: ["READ"],
    PAYROLL: ["READ", "UPDATE", "APPROVE", "EXPORT"], // Mandatory Kế toán trưởng sign-off
    PIT: ["READ", "UPDATE", "APPROVE", "EXPORT"],
    INSURANCE: ["READ", "APPROVE", "EXPORT"],
    ASSETS: ["READ"],
    ESS: ["READ"],
    WORKFLOW: ["READ", "APPROVE"],
    ADMIN_AUDIT: ["READ", "EXPORT"],
  },
  DIRECTOR: {
    EMPLOYEE: ["READ"],
    ORGANIZATION: ["READ", "APPROVE"],
    RECRUITMENT: ["READ", "APPROVE"],
    LIFECYCLE: ["READ"],
    CONTRACTS: ["READ", "APPROVE"],
    ATTENDANCE: ["READ"],
    SHIFTS: ["READ"],
    LEAVE: ["READ", "APPROVE"],
    OVERTIME: ["READ", "APPROVE"],
    PAYROLL: ["READ", "APPROVE"], // Final sign-off before Lock
    PIT: ["READ"],
    INSURANCE: ["READ"],
    PERFORMANCE: ["READ", "APPROVE"],
    LEARNING: ["READ"],
    ASSETS: ["READ"],
    ESS: ["READ"],
    WORKFLOW: ["READ", "APPROVE"],
    ADMIN_AUDIT: ["READ", "EXPORT"],
  },
  EMPLOYEE: {
    EMPLOYEE: ["READ"],
    EMPLOYEE_SENSITIVE: ["READ", "UPDATE"], // Self only with approval
    ORGANIZATION: ["READ"],
    LIFECYCLE: ["READ", "UPDATE"],
    CONTRACTS: ["READ"],
    ATTENDANCE: ["READ", "CREATE"], // GPS check-in & explanation
    SHIFTS: ["READ", "CREATE"], // Shift swap request
    LEAVE: ["READ", "CREATE"],
    OVERTIME: ["READ", "CREATE", "APPROVE"], // Self consent
    PAYROLL: ["READ"], // Own payslip only
    PIT: ["READ", "CREATE"], // Own dependents
    INSURANCE: ["READ"],
    PERFORMANCE: ["READ", "CREATE", "UPDATE"],
    LEARNING: ["READ", "CREATE"],
    ASSETS: ["READ"],
    ESS: ["READ", "CREATE", "UPDATE"],
    WORKFLOW: ["READ"],
  },
  AUDITOR: {
    EMPLOYEE: ["READ"],
    EMPLOYEE_SENSITIVE: ["READ"], // Masked only
    ORGANIZATION: ["READ"],
    RECRUITMENT: ["READ"],
    LIFECYCLE: ["READ"],
    CONTRACTS: ["READ"],
    ATTENDANCE: ["READ"],
    SHIFTS: ["READ"],
    LEAVE: ["READ"],
    OVERTIME: ["READ"],
    PAYROLL: ["READ"],
    PIT: ["READ"],
    INSURANCE: ["READ"],
    PERFORMANCE: ["READ"],
    LEARNING: ["READ"],
    ASSETS: ["READ"],
    ESS: ["READ"],
    WORKFLOW: ["READ"],
    ADMIN_AUDIT: ["READ"],
  },
};

export interface AuthContext {
  userId: string;
  employeeId: string | null;
  roles: RoleCode[];
  mfaVerified: boolean;
}

export class AuthorizationError extends Error {
  constructor(
    public readonly code: "UNAUTHENTICATED" | "MFA_REQUIRED" | "FORBIDDEN" | "SELF_APPROVAL_FORBIDDEN",
    message: string
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function hasPermission(roles: readonly RoleCode[], module: ModuleCode, action: ActionCode): boolean {
  return roles.some((role) => {
    const actions = ROLE_PERMISSIONS[role]?.[module];
    return actions ? actions.includes(action) : false;
  });
}

export function assertAuthorized(
  ctx: AuthContext | null,
  module: ModuleCode,
  action: ActionCode
): asserts ctx is AuthContext {
  if (!ctx) {
    throw new AuthorizationError("UNAUTHENTICATED", "Yêu cầu đăng nhập để thực hiện thao tác.");
  }
  const enforceMfa = process.env.REQUIRE_MFA === "true";
  const requiresMfa = enforceMfa && ctx.roles.some((r) => MFA_REQUIRED_ROLES.has(r));
  if (requiresMfa && !ctx.mfaVerified) {
    throw new AuthorizationError("MFA_REQUIRED", "Tài khoản đặc quyền bắt buộc xác thực MFA (TOTP).");
  }
  if (!hasPermission(ctx.roles, module, action)) {
    throw new AuthorizationError(
      "FORBIDDEN",
      `Không có quyền ${action} trên phân hệ ${module} (Deny-by-default).`
    );
  }
}

/**
 * Separation of Duties (SoD) Guard:
 * The creator/requester of a transaction cannot approve their own record.
 */
export function assertNotSelfApproval(actorUserId: string, creatorUserId: string): void {
  if (actorUserId === creatorUserId) {
    throw new AuthorizationError(
      "SELF_APPROVAL_FORBIDDEN",
      "Vi phạm Separation of Duties: Người lập giao dịch không được tự phê duyệt."
    );
  }
}

