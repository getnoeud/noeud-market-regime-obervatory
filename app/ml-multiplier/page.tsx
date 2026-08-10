"use client";

import { MLMultiplierLab } from "@/components/regime/ml-multiplier-lab";
import {
  OperationalMaturityHistoryChart,
  OperationalMaturityLadder,
} from "@/components/regime/operational-maturity";
import { EmptyState, SectionTitle } from "@/components/regime/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useBenchmarkResults,
  useMLMultiplierLab,
  useMaturityRiskOperational,
  useValidationRuns,
} from "@/hooks/use-regime";

export default function MLMultiplierPage() {
  const query = useMLMultiplierLab();
  const validationsQuery = useValidationRuns();
  const benchmarkQuery = useBenchmarkResults();
  const maturityRiskQuery = useMaturityRiskOperational();
  return (
    <>
      <SectionTitle description="Legacy six-tenor model evidence plus the exact-maturity operating view used for current benchmark decisions.">
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
        <div className="flex flex-col gap-5">
          <MLMultiplierLab
            data={query.data}
            validations={validationsQuery.data ?? []}
            llmBenchmarks={benchmarkQuery.data ?? []}
          />
          {maturityRiskQuery.data?.forecasts.length ? (
            <>
              <OperationalMaturityHistoryChart
                forecasts={maturityRiskQuery.data.forecasts}
                title="Operational Exact-Maturity History"
                description="The 14 production checkpoints from the maturity surface; this is separate from the legacy six-tenor training evidence."
              />
              <OperationalMaturityLadder forecasts={maturityRiskQuery.data.forecasts} />
            </>
          ) : null}
        </div>
      )}
    </>
  );
}
