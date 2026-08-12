"use client";

import { EmptyState, SectionTitle } from "@/components/regime/primitives";
import { PerformanceLabV2 } from "@/components/regime/performance-lab-v2";
import { OperationalPerformanceLab } from "@/components/regime/operational-performance-lab";
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
  const isLoading =
    query.isLoading ||
    signalHorizonQuery.isLoading ||
    validationsQuery.isLoading ||
    statusesQuery.isLoading;
  const isError =
    query.isError ||
    signalHorizonQuery.isError ||
    validationsQuery.isError ||
    statusesQuery.isError;

  return (
    <>
      <SectionTitle description="One benchmark vocabulary across exact-maturity candidates, the historical six-bucket overlay, and controlled LLM experiments.">
        Performance Lab
      </SectionTitle>
      <Tabs defaultValue="operational" className="flex flex-col gap-5">
        <div className="max-w-full overflow-x-auto pb-1">
          <TabsList className="w-max">
            <TabsTrigger value="operational">
              Exact maturity · 14 horizons
            </TabsTrigger>
            <TabsTrigger value="historical">
              Historical overlay · 6 buckets
            </TabsTrigger>
            <TabsTrigger value="experiments">LLM experiments</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="operational">
          {maturityRiskQuery.isLoading ? (
            <Skeleton className="h-[520px] rounded-xl" />
          ) : maturityRiskQuery.isError || !maturityRiskQuery.data ? (
            <EmptyState
              title="Operational maturity benchmarks are unavailable"
              description="The exact-maturity evaluator has not returned its canonical forecast and benchmark rows."
            />
          ) : (
            <OperationalPerformanceLab data={maturityRiskQuery.data} />
          )}
        </TabsContent>

        <TabsContent value="historical">
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
              title="Historical overlay benchmark is unavailable"
              description="Supabase did not satisfy the original six-bucket benchmark contract."
            />
          ) : (
            <PerformanceLabV2
              results={query.data ?? []}
              signalHorizonResults={signalHorizonQuery.data ?? []}
              statuses={statusesQuery.data ?? []}
              validations={validationsQuery.data ?? []}
              view="overlay"
            />
          )}
        </TabsContent>

        <TabsContent value="experiments">
          {isLoading ? (
            <Skeleton className="h-[520px] rounded-xl" />
          ) : isError ? (
            <EmptyState
              title="LLM experiment data is unavailable"
              description="The memory and signal-life experiment records could not be loaded."
            />
          ) : (
            <PerformanceLabV2
              results={query.data ?? []}
              signalHorizonResults={signalHorizonQuery.data ?? []}
              statuses={statusesQuery.data ?? []}
              validations={validationsQuery.data ?? []}
              view="experiments"
            />
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
