import Decimal from "decimal.js";
import { roundVnd } from "./decimal-engine";

export type AllowanceCalcMode = "FIXED_MONTHLY" | "PER_WORKDAY" | "VARIABLE_INPUT";
export type AllowanceTierSource =
  | "DEPARTMENT_POLICY"
  | "EMPLOYEE_OVERRIDE"
  | "PERIOD_VARIABLE";

export interface SalaryComponentDef {
  id: string;
  code: string;
  name: string;
  category: string;
  calcMode: string;
  isTaxable: boolean;
  taxExemptRuleCode: string | null;
  taxExemptCap: number;
}

export interface DeptAllowanceRule {
  departmentId: string;
  positionId: string | null;
  salaryComponentId: string;
  defaultAmount: number;
  calcMode: AllowanceCalcMode;
}

export interface EmpAllowanceOverride {
  employeeId: string;
  salaryComponentId: string;
  overrideAmount: number;
  calcMode: AllowanceCalcMode;
}

export interface PeriodAllowanceVariable {
  employeeId: string;
  salaryComponentId: string;
  amount: number;
  quantity: number;
}

export interface ResolvedAllowanceLine {
  salaryComponentId: string;
  componentCode: string;
  componentName: string;
  category: string;
  tierSource: AllowanceTierSource;
  calcMode: string;
  rate: number;
  quantity: number;
  totalAmount: number;
  taxExemptAmount: number;
  taxableAmount: number;
}

export interface AllowanceResolutionSummary {
  lines: ResolvedAllowanceLine[];
  lunchCashAllowance: number;
  taxableAllowancesAndBonuses: number;
  otherNonTaxableAllowances: number;
}

function computeComponentTotal(
  calcMode: string,
  unitAmount: number,
  quantityOverride: number | null,
  paidWorkDays: number
): { quantity: number; totalAmount: number } {
  if (calcMode === "PER_WORKDAY") {
    const qty = quantityOverride ?? paidWorkDays;
    return {
      quantity: qty,
      totalAmount: roundVnd(new Decimal(unitAmount).times(qty)).toNumber(),
    };
  }
  const qty = quantityOverride ?? 1;
  return {
    quantity: qty,
    totalAmount: roundVnd(new Decimal(unitAmount).times(qty)).toNumber(),
  };
}

/**
 * Resolves flexible allowances (including non-uniform lunch & bonuses) across 3 tiers:
 * Tier 3 (Period Variable) > Tier 2 (Employee Override) > Tier 1 (Department / Position Policy).
 */
export function resolveEmployeeAllowances(params: {
  employeeId: string;
  departmentId: string | null;
  positionId: string | null;
  paidWorkDays: number;
  components: SalaryComponentDef[];
  deptPolicies: DeptAllowanceRule[];
  empOverrides: EmpAllowanceOverride[];
  periodVariables: PeriodAllowanceVariable[];
}): AllowanceResolutionSummary {
  const lines: ResolvedAllowanceLine[] = [];
  let lunchCashAllowance = new Decimal(0);
  let taxableAllowancesAndBonuses = new Decimal(0);
  let otherNonTaxableAllowances = new Decimal(0);

  for (const comp of params.components) {
    const t3 = params.periodVariables.find(
      (v) => v.employeeId === params.employeeId && v.salaryComponentId === comp.id
    );
    const t2 = params.empOverrides.find(
      (o) => o.employeeId === params.employeeId && o.salaryComponentId === comp.id
    );

    // Prefer position-specific Tier 1 policy before department-wide fallback
    const t1ExactPos = params.departmentId
      ? params.deptPolicies.find(
          (p) =>
            p.departmentId === params.departmentId &&
            p.positionId !== null &&
            p.positionId === params.positionId &&
            p.salaryComponentId === comp.id
        )
      : undefined;
    const t1Dept = params.departmentId
      ? params.deptPolicies.find(
          (p) =>
            p.departmentId === params.departmentId &&
            p.positionId === null &&
            p.salaryComponentId === comp.id
        )
      : undefined;
    const t1 = t1ExactPos ?? t1Dept;

    let tierSource: AllowanceTierSource | null = null;
    let calcMode: string = comp.calcMode;
    let rate = 0;
    let quantity = 1;
    let totalAmount = 0;

    if (t3) {
      tierSource = "PERIOD_VARIABLE";
      calcMode = "VARIABLE_INPUT";
      rate = t3.amount;
      quantity = t3.quantity;
      totalAmount = roundVnd(new Decimal(t3.amount).times(t3.quantity)).toNumber();
    } else if (t2) {
      tierSource = "EMPLOYEE_OVERRIDE";
      calcMode = t2.calcMode;
      rate = t2.overrideAmount;
      const computed = computeComponentTotal(t2.calcMode, t2.overrideAmount, null, params.paidWorkDays);
      quantity = computed.quantity;
      totalAmount = computed.totalAmount;
    } else if (t1) {
      tierSource = "DEPARTMENT_POLICY";
      calcMode = t1.calcMode;
      rate = t1.defaultAmount;
      const computed = computeComponentTotal(t1.calcMode, t1.defaultAmount, null, params.paidWorkDays);
      quantity = computed.quantity;
      totalAmount = computed.totalAmount;
    }

    if (!tierSource || totalAmount <= 0) continue;

    let taxExemptAmount = 0;
    let taxableAmount = totalAmount;

    if (comp.code === "LUNCH_ALLOWANCE" || comp.taxExemptRuleCode === "DECREE_253_2026_LUNCH") {
      const cap = comp.taxExemptCap > 0 ? comp.taxExemptCap : 1200000;
      taxExemptAmount = Math.min(totalAmount, cap);
      taxableAmount = Math.max(0, totalAmount - taxExemptAmount);
      lunchCashAllowance = lunchCashAllowance.plus(totalAmount);
    } else if (!comp.isTaxable) {
      taxExemptAmount = totalAmount;
      taxableAmount = 0;
      otherNonTaxableAllowances = otherNonTaxableAllowances.plus(totalAmount);
    } else {
      taxableAllowancesAndBonuses = taxableAllowancesAndBonuses.plus(totalAmount);
    }

    lines.push({
      salaryComponentId: comp.id,
      componentCode: comp.code,
      componentName: comp.name,
      category: comp.category,
      tierSource,
      calcMode,
      rate,
      quantity,
      totalAmount,
      taxExemptAmount,
      taxableAmount,
    });
  }

  return {
    lines,
    lunchCashAllowance: lunchCashAllowance.toNumber(),
    taxableAllowancesAndBonuses: taxableAllowancesAndBonuses.toNumber(),
    otherNonTaxableAllowances: otherNonTaxableAllowances.toNumber(),
  };
}

