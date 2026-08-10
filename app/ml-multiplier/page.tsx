"use client";

import { MLMultiplierLab } from "@/components/regime/ml-multiplier-lab";
import {
  OperationalMaturityHistoryChart,
  OperationalMaturityLadder,
  OperationalMaturityPerformance,
} from "@/components/regime/operational-maturity";
import { EmptyState, SectionTitle } from "@/components/regime/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
      <SectionTitle description="The exact-maturity operating surface is primary. The original six-tenor shadow model remains available as frozen historical evidence.">
        ML Multiplier Lab
      </SectionTitle>
      <Tabs defaultValue="operational" className="flex flex-col gap-5">
        <TabsList className="w-fit">
          <TabsTrigger value="operational">Operational · 14 horizons</TabsTrigger>
          <TabsTrigger value="legacy">Legacy · 6 tenors</TabsTrigger>
        </TabsList>

        <TabsContent value="operational">
          {maturityRiskQuery.isLoading ? (
            <>
              <Skeleton className="h-[420px] rounded-lg" />
              <Skeleton className="h-[520px] rounded-lg" />
            </>
          ) : maturityRiskQuery.isError || !maturityRiskQuery.data ? (
            <EmptyState
              title="Operational multiplier data is unavailable"
              description="The exact-maturity forecast and benchmark rows are not available from Supabase."
            />
          ) : (
            <div className="flex flex-col gap-5">
              <OperationalMaturityHistoryChart
                forecasts={maturityRiskQuery.data.forecasts}
                horizonControl="strip"
                defaultHorizon={1}
                title="Operational Exact-Maturity History"
                description="Select any production checkpoint to compare Rule-based, Historical ML, and LLM recommendation through time."
              />
              <OperationalMaturityLadder forecasts={maturityRiskQuery.data.forecasts} />
              <OperationalMaturityPerformance data={maturityRiskQuery.data} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="legacy">
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
              title="Legacy ML multiplier data is unavailable"
              description="The frozen six-tenor shadow experiment has not returned its historical rows."
            />
          ) : (
            <MLMultiplierLab
              data={query.data}
              validations={validationsQuery.data ?? []}
              llmBenchmarks={benchmarkQuery.data ?? []}
            />
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
