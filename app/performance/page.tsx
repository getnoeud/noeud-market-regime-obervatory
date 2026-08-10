"use client";

import { EmptyState, SectionTitle } from "@/components/regime/primitives";
import { PerformanceLabV2 } from "@/components/regime/performance-lab-v2";
import { OperationalMaturityPerformance } from "@/components/regime/operational-maturity";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useBenchmarkResults,
  useBenchmarkEvaluationStatuses,
  useSignalHorizonBenchmarkResults,
  useValidationRuns,
  useMaturityRiskOperational,
} from "@/hooks/use-regime";

export default function PerformancePage() {
  const query = useBenchmarkResults();
  const signalHorizonQuery = useSignalHorizonBenchmarkResults();
  const validationsQuery = useValidationRuns();
  const statusesQuery = useBenchmarkEvaluationStatuses();
  const maturityRiskQuery = useMaturityRiskOperational();
  const isLoading = query.isLoading || signalHorizonQuery.isLoading || validationsQuery.isLoading || statusesQuery.isLoading;
  const isError = query.isError || signalHorizonQuery.isError || validationsQuery.isError || statusesQuery.isError;

  return (
    <>
      <SectionTitle description="Matured outcome scoring for rule-based, Historical ML, and LLM recommendation candidates. The scheduled evaluator publishes rows as maturity windows close.">
        Performance Lab
      </SectionTitle>
      {isLoading ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-[116px] rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-[360px] rounded-xl" />
          <Skeleton className="h-[460px] rounded-xl" />
        </>
      ) : isError ? (
        <EmptyState
          title="Benchmark data is unavailable"
          description="Supabase did not satisfy the benchmark contract. Apply the performance-stabilization migration or inspect the API error before reviewing results."
        />
      ) : (
        <PerformanceLabV2
          results={query.data ?? []}
          signalHorizonResults={signalHorizonQuery.data ?? []}
          statuses={statusesQuery.data ?? []}
          validations={validationsQuery.data ?? []}
        />
      )}
      {maturityRiskQuery.isLoading ? (
        <Skeleton className="h-[420px] rounded-xl" />
      ) : maturityRiskQuery.data ? (
        <OperationalMaturityPerformance data={maturityRiskQuery.data} />
      ) : null}
    </>
  );
}
