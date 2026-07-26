"use client";

import { EmptyState } from "@/components/regime/primitives";
import {
  MLShadowOverviewPanel,
} from "@/components/regime/ml-multiplier-lab";
import {
  AccelerationLeaderboard,
  RegimeDistributionChart,
  TrendAwareOverviewHistoryChart,
} from "@/components/regime/overview-charts";
import {
  OperationsMetricStrip,
  OperationsSupportPanels,
  SignalHorizonOverviewPanel,
  TrendOverlayMatrix,
} from "@/components/regime/operations-overview";
import { PairsTable } from "@/components/regime/pairs-table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useProviderRuns,
  useMLMultiplierLab,
  useRegimeHistories,
  useRegimeOverview,
  useValidationRuns,
  useValidations,
} from "@/hooks/use-regime";

export default function OverviewPage() {
  const query = useRegimeOverview();
  const validationsQuery = useValidations();
  const validationRunsQuery = useValidationRuns();
  const providerRunsQuery = useProviderRuns();
  const mlMultiplierQuery = useMLMultiplierLab();
  const pairs = query.data?.snapshots.map((snapshot) => snapshot.pair) ?? [];
  const historiesQuery = useRegimeHistories(pairs);

  if (query.isLoading) return <LoadingSkeleton />;
  if (query.isError)
    return (
      <EmptyState
        title="Regime data is unavailable"
        description="Could not reach the regime API. The deterministic snapshots will appear here once the service responds."
      />
    );

  return (
    <>
      <OperationsMetricStrip
        snapshots={query.data!.snapshots}
        validations={validationsQuery.data ?? []}
        providerRuns={providerRunsQuery.data ?? []}
        asOf={query.data!.as_of_date}
      />
      {mlMultiplierQuery.data && <MLShadowOverviewPanel data={mlMultiplierQuery.data} />}
      <SignalHorizonOverviewPanel validations={validationsQuery.data ?? []} />
      <TrendAwareOverviewHistoryChart
        histories={historiesQuery.data ?? {}}
        validations={validationRunsQuery.data ?? []}
      />
      <TrendOverlayMatrix
        snapshots={query.data!.snapshots}
        validations={validationsQuery.data ?? []}
      />
      <PairsTable snapshots={query.data!.snapshots} />
      <OperationsSupportPanels
        snapshots={query.data!.snapshots}
        validations={validationsQuery.data ?? []}
        providerRuns={providerRunsQuery.data ?? []}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RegimeDistributionChart snapshots={query.data!.snapshots} />
        <AccelerationLeaderboard snapshots={query.data!.snapshots} />
      </div>
    </>
  );
}

function LoadingSkeleton() {
  return (
    <>
      <Skeleton className="h-[430px] rounded-lg" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-[330px] rounded-xl" />
        <Skeleton className="h-[330px] rounded-xl" />
      </div>
      <Skeleton className="h-[480px] rounded-xl" />
    </>
  );
}
