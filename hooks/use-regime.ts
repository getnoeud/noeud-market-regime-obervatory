"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type {
  ProviderRun,
  RawPriceObservation,
  RegimeHistoryPoint,
  RegimeOverviewResponse,
  RegimeSnapshot,
  BenchmarkResult,
  BenchmarkEvaluationStatus,
  ObservatoryDataSourceStatus,
  SignalHorizonBenchmarkResult,
  MLMultiplierLabResponse,
  MaturityRiskLabResponse,
  MaturityRiskOperationalResponse,
  MaturityRiskSurfaceResponse,
  ValidationRun,
} from "@/lib/types";

export function useRegimeOverview() {
  return useQuery({
    queryKey: ["regime-overview"],
    queryFn: async () => {
      const { data } = await api.get<RegimeOverviewResponse>("/regimes/latest");
      return data;
    },
  });
}

export function usePairsList() {
  return useQuery({
    queryKey: ["pairs"],
    queryFn: async () => {
      const { data } = await api.get<{ as_of_date: string; pairs: string[] }>("/pairs");
      return data;
    },
  });
}

export function useRegimeSnapshot(pair: string) {
  return useQuery({
    queryKey: ["regime-snapshot", pair],
    queryFn: async () => {
      const { data } = await api.get<RegimeSnapshot>(`/regimes/${pair}`);
      return data;
    },
    enabled: Boolean(pair),
  });
}

export function useRegimeHistory(pair: string) {
  return useQuery({
    queryKey: ["regime-history", pair],
    queryFn: async () => {
      const { data } = await api.get<{ pair: string; points: RegimeHistoryPoint[] }>(
        `/regimes/${pair}/history`,
      );
      return data.points;
    },
    enabled: Boolean(pair),
  });
}

export function useRegimeHistories(pairs: string[]) {
  const key = pairs.join(",");
  return useQuery({
    queryKey: ["regime-histories", key],
    queryFn: async () => {
      const entries = await Promise.all(
        pairs.map(async (pair) => {
          const { data } = await api.get<{
            pair: string;
            points: RegimeHistoryPoint[];
          }>(`/regimes/${pair}/history`);
          return [pair, data.points] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<string, RegimeHistoryPoint[]>;
    },
    enabled: pairs.length > 0,
  });
}

export function usePriceObservations(pair: string) {
  return useQuery({
    queryKey: ["price-observations", pair],
    queryFn: async () => {
      const { data } = await api.get<{
        pair: string;
        observations: RawPriceObservation[];
      }>(`/regimes/${pair}/prices`);
      return data.observations;
    },
    enabled: Boolean(pair),
  });
}

/** Latest validation per pair (used by the overview audit panel). */
export function useValidations() {
  return useQuery({
    queryKey: ["validations"],
    queryFn: async () => {
      const { data } = await api.get<{ as_of_date: string; runs: ValidationRun[] }>(
        "/validations",
      );
      return data.runs;
    },
  });
}

/** Every validation run across all pairs (the validation log page). */
export function useValidationRuns() {
  return useQuery({
    queryKey: ["validation-runs"],
    queryFn: async () => {
      const { data } = await api.get<{ as_of_date: string; runs: ValidationRun[] }>(
        "/validations",
        { params: { scope: "all" } },
      );
      return data.runs;
    },
  });
}

/** All validation runs for a single pair, newest first. */
export function usePairValidations(pair: string) {
  return useQuery({
    queryKey: ["pair-validations", pair],
    queryFn: async () => {
      const { data } = await api.get<{ pair: string; runs: ValidationRun[] }>(
        `/validations/${pair}`,
      );
      return data.runs;
    },
    enabled: Boolean(pair),
  });
}

export function useProviderRuns(pair?: string) {
  return useQuery({
    queryKey: ["provider-runs", pair ?? "all"],
    queryFn: async () => {
      const { data } = await api.get<{ runs: ProviderRun[] }>("/provider-runs", {
        params: pair ? { pair } : undefined,
      });
      return data.runs;
    },
  });
}

export function useBenchmarkResults() {
  return useQuery({
    queryKey: ["benchmark-results"],
    queryFn: async () => {
      const { data } = await api.get<{ as_of_date: string | null; results: BenchmarkResult[] }>(
        "/benchmarks",
      );
      return data.results;
    },
  });
}

export function useSignalHorizonBenchmarkResults() {
  return useQuery({
    queryKey: ["signal-horizon-benchmark-results"],
    queryFn: async () => {
      const { data } = await api.get<{
        as_of_date: string | null;
        results: SignalHorizonBenchmarkResult[];
      }>("/benchmarks/signal-horizon");
      return data.results;
    },
  });
}

export function useBenchmarkEvaluationStatuses() {
  return useQuery({
    queryKey: ["benchmark-evaluation-statuses"],
    queryFn: async () => {
      const { data } = await api.get<{
        as_of_date: string | null;
        statuses: BenchmarkEvaluationStatus[];
      }>("/benchmarks/status");
      return data.statuses;
    },
  });
}

export function useDataSourceStatus() {
  return useQuery({
    queryKey: ["observatory-data-source"],
    queryFn: async () => {
      const { data } = await api.get<ObservatoryDataSourceStatus>("/system/status");
      return data;
    },
    staleTime: 60_000,
  });
}

export function useMLMultiplierLab() {
  return useQuery({
    queryKey: ["ml-multiplier-lab"],
    queryFn: async () => {
      const { data } = await api.get<MLMultiplierLabResponse>("/ml-multiplier");
      return data;
    },
  });
}

export function useMaturityRiskLab() {
  return useQuery({
    queryKey: ["maturity-risk-lab"],
    queryFn: async () => {
      const { data } = await api.get<MaturityRiskLabResponse>("/maturity-risk");
      return data;
    },
  });
}

export function useMaturityRiskSurface() {
  return useQuery({
    queryKey: ["maturity-risk-surface"],
    queryFn: async () => {
      const { data } = await api.get<MaturityRiskSurfaceResponse>("/maturity-risk/surface");
      return data;
    },
  });
}

export function useMaturityRiskOperational() {
  return useQuery({
    queryKey: ["maturity-risk-operational"],
    queryFn: async () => {
      const { data } = await api.get<MaturityRiskOperationalResponse>(
        "/maturity-risk/operational",
      );
      return data;
    },
  });
}
