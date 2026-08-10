"use client";

import { MaturitySurfaceExplorer } from "@/components/regime/maturity-surface-explorer";
import { MaturityRiskViewSwitcher } from "@/components/regime/maturity-risk-view-switcher";
import { EmptyState, SectionTitle } from "@/components/regime/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { useMaturityRiskSurface } from "@/hooks/use-regime";

export default function MaturitySurfacePage() {
  const query = useMaturityRiskSurface();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle description="Deep inspection of supervised horizon labels and every exact maturity served by the frozen V2 surface.">
          Maturity Surface Explorer
        </SectionTitle>
        <MaturityRiskViewSwitcher active="surface" />
      </div>
      {query.isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-[180px] rounded-lg" />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Skeleton className="h-[440px] rounded-lg" />
            <Skeleton className="h-[440px] rounded-lg" />
          </div>
          <Skeleton className="h-[480px] rounded-lg" />
        </div>
      ) : query.isError || !query.data ? (
        <EmptyState
          title="Maturity surface is unavailable"
          description="Run the calculation flow once to publish the latest exact-maturity surface."
        />
      ) : !query.data.forecasts.length ? (
        <EmptyState
          title="Waiting for the first exact-maturity surface"
          description="The calculation flow publishes the rule-based and historical-ML candidates; validation adds LLM recommendation values."
        />
      ) : (
        <MaturitySurfaceExplorer data={query.data} />
      )}
    </div>
  );
}
