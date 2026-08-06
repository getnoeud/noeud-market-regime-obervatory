"use client";

import { MaturityRiskLab } from "@/components/regime/maturity-risk-lab";
import { EmptyState, SectionTitle } from "@/components/regime/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { useMaturityRiskLab } from "@/hooks/use-regime";

export default function MaturityRiskPage() {
  const query = useMaturityRiskLab();
  return (
    <div className="flex flex-col gap-5">
      <SectionTitle description="Arbitrary calendar-maturity forecasts, path-aware outcomes, and manual promotion governance across the frozen candidate cohort.">
        Maturity Risk Lab
      </SectionTitle>
      {query.isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-[180px] rounded-lg" />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Skeleton className="h-[400px] rounded-lg" />
            <Skeleton className="h-[400px] rounded-lg" />
          </div>
        </div>
      ) : query.isError || !query.data ? (
        <EmptyState
          title="Maturity-risk data is unavailable"
          description="Apply the V2 Supabase migration and run the calculation flow once."
        />
      ) : !query.data.forecasts.length ? (
        <EmptyState
          title="Waiting for the first maturity surface"
          description="The calculation flow will publish rule-based and historical-ML surfaces; validation adds the news-adjusted candidate."
        />
      ) : (
        <MaturityRiskLab data={query.data} />
      )}
    </div>
  );
}
