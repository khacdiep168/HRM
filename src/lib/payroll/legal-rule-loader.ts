import Decimal from "decimal.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { VN_2026_H2_RULES, type LegalRuleConfig, type RegionCode } from "./decimal-engine";

export interface LegalRuleRow {
  rule_code: string;
  effective_from: string;
  effective_to: string | null;
  status: string;
  parameters: Record<string, unknown>;
}

/**
 * Pure builder: converts approved `legal_rule_registry` rows into `LegalRuleConfig`
 * without hardcoding statutory constants in caller logic.
 */
export function buildLegalRuleConfigFromRows(
  rows: LegalRuleRow[],
  effectiveDate: string
): LegalRuleConfig {
  const activeRows = rows.filter(
    (r) =>
      r.status === "APPROVED" &&
      r.effective_from <= effectiveDate &&
      (!r.effective_to || r.effective_to >= effectiveDate)
  );

  if (activeRows.length === 0) {
    return VN_2026_H2_RULES;
  }

  let config: LegalRuleConfig = {
    ...VN_2026_H2_RULES,
    regionalMinWage: { ...VN_2026_H2_RULES.regionalMinWage },
    pitBrackets: [...VN_2026_H2_RULES.pitBrackets],
  };

  for (const row of activeRows) {
    const p = row.parameters ?? {};
    if (p.ruleVersion && typeof p.ruleVersion === "string") {
      config.ruleVersion = p.ruleVersion;
    }
    if (p.bhxhReferenceLevel !== undefined) {
      config.bhxhReferenceLevel = new Decimal(String(p.bhxhReferenceLevel));
    }
    if (p.selfDeduction !== undefined) {
      config.selfDeduction = new Decimal(String(p.selfDeduction));
    }
    if (p.dependentDeduction !== undefined) {
      config.dependentDeduction = new Decimal(String(p.dependentDeduction));
    }
    if (p.lunchCashExemptCap !== undefined) {
      config.lunchCashExemptCap = new Decimal(String(p.lunchCashExemptCap));
    }
    if (p.regionalMinWage && typeof p.regionalMinWage === "object") {
      const rmw = p.regionalMinWage as Partial<Record<RegionCode, string | number>>;
      config = {
        ...config,
        regionalMinWage: {
          I: rmw.I !== undefined ? new Decimal(rmw.I) : config.regionalMinWage.I,
          II: rmw.II !== undefined ? new Decimal(rmw.II) : config.regionalMinWage.II,
          III: rmw.III !== undefined ? new Decimal(rmw.III) : config.regionalMinWage.III,
          IV: rmw.IV !== undefined ? new Decimal(rmw.IV) : config.regionalMinWage.IV,
        },
      };
    }
  }

  return config;
}

export async function loadLegalRulesForDate(
  admin: SupabaseClient,
  companyId: string,
  effectiveDate: string
): Promise<LegalRuleConfig> {
  const { data } = await admin
    .from("legal_rule_registry")
    .select("rule_code, effective_from, effective_to, status, parameters")
    .eq("company_id", companyId)
    .eq("status", "APPROVED")
    .lte("effective_from", effectiveDate)
    .order("effective_from", { ascending: true });

  return buildLegalRuleConfigFromRows((data ?? []) as LegalRuleRow[], effectiveDate);
}

