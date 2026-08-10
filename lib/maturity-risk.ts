import type { MaturityRiskCandidateType } from "@/lib/types";

export const OPERATIONAL_MATURITY_HORIZONS = [
  1, 3, 5, 7, 10, 14, 21, 30, 45, 60, 90, 120, 180, 252,
] as const;

export const MATURITY_RISK_CANDIDATES: ReadonlyArray<{
  key: MaturityRiskCandidateType;
  label: string;
  color: string;
}> = [
  { key: "rule_based", label: "Rule-based", color: "var(--chart-1)" },
  { key: "historical_ml", label: "Historical ML", color: "var(--chart-2)" },
  { key: "news_adjusted", label: "LLM recommendation", color: "var(--chart-3)" },
];

export function maturityCandidateLabel(value: MaturityRiskCandidateType) {
  return MATURITY_RISK_CANDIDATES.find((candidate) => candidate.key === value)?.label ?? value;
}

export function displayPairCode(pair: string) {
  return `${pair.slice(0, 3)}/${pair.slice(3)}`;
}
