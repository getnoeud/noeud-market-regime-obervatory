"use client";

import { MLMultiplierLab } from "@/components/regime/ml-multiplier-lab";
import { EmptyState, SectionTitle } from "@/components/regime/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useBenchmarkResults,
  useMLMultiplierLab,
  useValidationRuns,
} from "@/hooks/use-regime";

export default function MLMultiplierPage() {
  const query = useMLMultiplierLab();
  const validationsQuery = useValidationRuns();
  const benchmarkQuery = useBenchmarkResults();
  return (
    <>
      <SectionTitle description="Independent six-tenor ML multiplier estimates, matured outcome scoring, artifact provenance, and promotion gates.">
        ML Multiplier Lab
      </SectionTitle>
      {query.isLoading ? (
        <>
          <Skeleton className="h-[150px] rounded-lg" />
          <Skeleton className="h-[360px] rounded-lg" />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Skeleton className="h-[360px] rounded-lg" />
            <Skeleton className="h-[360px] rounded-lg" />
          </div>
        </>
      ) : query.isError || !query.data ? (
        <EmptyState
          title="ML multiplier data is unavailable"
          description="Apply the migration, deploy the calculation flow, and inspect its first shadow inference."
        />
      ) : (
        <MLMultiplierLab
          data={query.data}
          validations={validationsQuery.data ?? []}
          llmBenchmarks={benchmarkQuery.data ?? []}
        />
      )}
    </>
  );
}
