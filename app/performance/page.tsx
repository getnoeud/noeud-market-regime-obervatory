"use client";

import { EmptyState, SectionTitle } from "@/components/regime/primitives";
import { PerformanceLabV2 } from "@/components/regime/performance-lab-v2";
import { OperationalMaturityPerformance } from "@/components/regime/operational-maturity";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
      <SectionTitle description="Operational exact-maturity scoring is the primary view. The original six-tenor LLM-validation cohort remains available for historical comparison.">
        Performance Lab
      </SectionTitle>
      <Tabs defaultValue="operational" className="flex flex-col gap-5">
        <TabsList className="w-fit">
          <TabsTrigger value="operational">Operational · 14 horizons</TabsTrigger>
          <TabsTrigger value="legacy">Legacy · 6 tenors</TabsTrigger>
        </TabsList>

        <TabsContent value="operational">
          {maturityRiskQuery.isLoading ? (
            <Skeleton className="h-[520px] rounded-xl" />
          ) : maturityRiskQuery.isError || !maturityRiskQuery.data ? (
            <EmptyState
              title="Operational maturity benchmarks are unavailable"
              description="The exact-maturity evaluator has not returned its canonical forecast and benchmark rows."
            />
          ) : (
            <OperationalMaturityPerformance data={maturityRiskQuery.data} />
          )}
        </TabsContent>

        <TabsContent value="legacy">
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
              title="Legacy benchmark data is unavailable"
              description="Supabase did not satisfy the original six-tenor benchmark contract."
            />
          ) : (
            <PerformanceLabV2
              results={query.data ?? []}
              signalHorizonResults={signalHorizonQuery.data ?? []}
              statuses={statusesQuery.data ?? []}
              validations={validationsQuery.data ?? []}
            />
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
