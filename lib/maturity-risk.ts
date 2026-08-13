import type {
  MaturityRiskBenchmarkResult,
  MaturityRiskCandidateType,
  MaturityRiskForecast,
} from "@/lib/types";

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
  {
    key: "news_adjusted",
    label: "LLM recommendation",
    color: "var(--chart-3)",
  },
];

export function maturityCandidateLabel(value: MaturityRiskCandidateType) {
  return (
    MATURITY_RISK_CANDIDATES.find((candidate) => candidate.key === value)
      ?.label ?? value
  );
}

export function displayPairCode(pair: string) {
  return `${pair.slice(0, 3)}/${pair.slice(3)}`;
}

export function maturityForecastProvider(
  row: MaturityRiskForecast | undefined,
) {
  const value =
    row?.source_payload?.market_data_provider ??
    row?.source_payload?.provider_name ??
    row?.source_payload?.data_source;
  return typeof value === "string" && value.trim() ? value : "unknown";
}

function benchmarkOutcomeKey(row: MaturityRiskBenchmarkResult) {
  return `${row.pair_code}:${row.as_of_date}:${row.horizon_days}:${row.surface_version}`;
}

/** Keep matured evidence visible when serving candidate versions change. */
export function latestMatchedMaturityBenchmarks<
  T extends MaturityRiskBenchmarkResult,
>(rows: T[]): T[] {
  const outcomes = new Map<string, Map<MaturityRiskCandidateType, T>>();

  for (const row of rows) {
    const key = benchmarkOutcomeKey(row);
    const candidates = outcomes.get(key) ?? new Map();
    const current = candidates.get(row.candidate_type);
    if (!current || row.evaluated_at > current.evaluated_at) {
      candidates.set(row.candidate_type, row);
    }
    outcomes.set(key, candidates);
  }

  return [...outcomes.values()].flatMap((candidates) =>
    MATURITY_RISK_CANDIDATES.every((candidate) => candidates.has(candidate.key))
      ? MATURITY_RISK_CANDIDATES.map((candidate) =>
          candidates.get(candidate.key)!,
        )
      : [],
  );
}
