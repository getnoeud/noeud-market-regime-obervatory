"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { EmptyState } from "@/components/regime/primitives";
import {
  AccelerationHistoryChart,
  MultiplierChart,
  SpotHistoryChart,
  TailRiskHistoryChart,
  TermStructureChart,
  TermStructureHistoryChart,
  SignalHorizonHistoryChart,
  TrendAwareMultiplierHistoryChart,
  VolatilityHistoryChart,
  VolWindowsChart,
} from "@/components/regime/pair-charts";
import {
  PairAuditSummary,
  PairHeaderCard,
  PairSnapshotGrid,
} from "@/components/regime/pair-snapshot";
import {
  PairValidations,
  SignalHorizonCard,
  TrendAwareAdjustmentCard,
  ValidationSummaryCard,
} from "@/components/regime/validation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useRegimeHistory,
  useRegimeSnapshot,
  usePriceObservations,
  usePairValidations,
  useMLMultiplierLab,
} from "@/hooks/use-regime";

const TABS = ["snapshot", "charts", "validation"] as const;
type Tab = (typeof TABS)[number];

function PairDetail({ code }: { code: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: Tab = (TABS as readonly string[]).includes(tabParam ?? "")
    ? (tabParam as Tab)
    : "snapshot";

  const snapshotQuery = useRegimeSnapshot(code);
  const historyQuery = useRegimeHistory(code);
  const priceQuery = usePriceObservations(code);
  const validationsQuery = usePairValidations(code);
  const mlMultiplierQuery = useMLMultiplierLab();
  const validations = validationsQuery.data ?? [];
  const latestValidation = validations[0];
  const mlPredictions =
    mlMultiplierQuery.data?.predictions.filter(
      (prediction) => prediction.pair_code === code,
    ) ?? [];
  const initialRunId = searchParams.get("run");

  const onTabChange = (value: string) => {
    router.replace(`/pairs/${code}?tab=${value}`, { scroll: false });
  };

  return (
    <>
      <Button variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground" asChild>
        <Link href="/pairs">
          <ArrowLeftIcon className="size-3.5" /> All pairs
        </Link>
      </Button>

      {snapshotQuery.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-16 rounded-lg" />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Skeleton className="h-[420px] rounded-xl" />
            <Skeleton className="h-[420px] rounded-xl" />
          </div>
        </div>
      ) : snapshotQuery.isError || !snapshotQuery.data ? (
        <EmptyState
          title={`No snapshot for ${code}`}
          description="This pair may not be in the supported registry, or the regime API is unavailable."
        />
      ) : (
        <div className="space-y-6">
          <PairHeaderCard snapshot={snapshotQuery.data} />

          <Tabs value={tab} onValueChange={onTabChange} className="space-y-5">
            <TabsList>
              <TabsTrigger value="snapshot">Snapshot</TabsTrigger>
              <TabsTrigger value="charts">Charts</TabsTrigger>
              <TabsTrigger value="validation">LLM Validation</TabsTrigger>
            </TabsList>

            <TabsContent value="snapshot" className="space-y-4">
              <PairAuditSummary snapshot={snapshotQuery.data} />
              {latestValidation && (
                <TrendAwareAdjustmentCard
                  run={latestValidation}
                  mlPredictions={mlPredictions}
                />
              )}
              {latestValidation && <SignalHorizonCard run={latestValidation} />}
              <PairSnapshotGrid snapshot={snapshotQuery.data} />
              {latestValidation && (
                <ValidationSummaryCard
                  run={latestValidation}
                  runCount={validations.length}
                  href={`/pairs/${code}?tab=validation`}
                />
              )}
            </TabsContent>

            <TabsContent value="charts" className="space-y-4">
              {historyQuery.data && historyQuery.data.length > 0 ? (
                <>
                  <TrendAwareMultiplierHistoryChart
                    history={historyQuery.data}
                    validations={validations}
                    mlPredictions={mlPredictions}
                    pair={snapshotQuery.data.display_pair}
                  />
                  {validations.length > 0 && (
                    <SignalHorizonHistoryChart
                      validations={validations}
                      pair={snapshotQuery.data.display_pair}
                    />
                  )}
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <SpotHistoryChart
                      observations={priceQuery.data ?? []}
                      pair={snapshotQuery.data.display_pair}
                    />
                    <AccelerationHistoryChart history={historyQuery.data} />
                  </div>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <VolatilityHistoryChart history={historyQuery.data} />
                    <VolWindowsChart snapshot={snapshotQuery.data} />
                  </div>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <TermStructureHistoryChart history={historyQuery.data} />
                    <TermStructureChart snapshot={snapshotQuery.data} />
                  </div>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <TailRiskHistoryChart history={historyQuery.data} />
                    <MultiplierChart snapshot={snapshotQuery.data} />
                  </div>
                </>
              ) : (
                <Skeleton className="h-[260px] rounded-xl" />
              )}
            </TabsContent>

            <TabsContent value="validation">
              {validationsQuery.isLoading ? (
                <Skeleton className="h-[320px] rounded-xl" />
              ) : (
                <PairValidations runs={validations} initialRunId={initialRunId} />
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </>
  );
}

export default function PairDetailPage({
  params,
}: {
  params: Promise<{ pair: string }>;
}) {
  const { pair } = React.use(params);
  return (
    <React.Suspense fallback={null}>
      <PairDetail code={pair.toUpperCase()} />
    </React.Suspense>
  );
}
