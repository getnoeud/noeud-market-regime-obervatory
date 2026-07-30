import { ActivityIcon, GaugeIcon, LayersIcon, ShieldCheckIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatNumber } from "@/lib/format";
import { REGIME_TONES } from "@/lib/regime";
import { REGIME_LABELS, type RegimeLabel, type RegimeSnapshot } from "@/lib/types";
import { cn } from "@/lib/utils";

function countByRegime(snapshots: RegimeSnapshot[]) {
  const counts = Object.fromEntries(REGIME_LABELS.map((r) => [r, 0])) as Record<
    RegimeLabel,
    number
  >;
  for (const s of snapshots) counts[s.current_volatility_readings.regime] += 1;
  return counts;
}

export function OverviewCards({
  snapshots,
  asOf,
}: {
  snapshots: RegimeSnapshot[];
  asOf: string | null;
}) {
  const counts = countByRegime(snapshots);
  const elevatedPlus = counts.ELEVATED + counts.STRESSED + counts.CRISIS;
  const avgAccel =
    snapshots.reduce((a, s) => a + s.current_volatility_readings.accel_vs_252d, 0) /
    Math.max(snapshots.length, 1);
  const passes = snapshots.filter(
    (s) => s.backtest_validation_results.system_status === "PASS",
  ).length;
  const passRate = snapshots.length ? passes / snapshots.length : 0;
  const providers = Array.from(
    new Set(snapshots.map((snapshot) => snapshot.market_data_provider)),
  ).filter(Boolean);

  return (
    <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <Card>
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5">
            <LayersIcon className="size-3.5" /> Pairs Tracked
          </CardDescription>
          <CardTitle className="text-3xl font-semibold tabular-nums">
            {snapshots.length}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          As of {formatDate(asOf)} · {providers.join(" + ") || "stored provider"}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5">
            <ActivityIcon className="size-3.5" /> Elevated &amp; Above
          </CardDescription>
          <CardTitle className="text-3xl font-semibold tabular-nums">
            {elevatedPlus}
            <span className="ml-1 text-base font-normal text-muted-foreground">
              / {snapshots.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
            {REGIME_LABELS.map((r) =>
              counts[r] ? (
                <div
                  key={r}
                  className={cn("h-full", REGIME_TONES[r].dot)}
                  style={{ width: `${(counts[r] / snapshots.length) * 100}%` }}
                  title={`${r}: ${counts[r]}`}
                />
              ) : null,
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5">
            <GaugeIcon className="size-3.5" /> Avg Acceleration
          </CardDescription>
          <CardTitle className="text-3xl font-semibold tabular-nums">
            {formatNumber(avgAccel, 2)}x
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Mean 30d vs 252d volatility ratio across book
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5">
            <ShieldCheckIcon className="size-3.5" /> VaR Backtest Pass
          </CardDescription>
          <CardTitle className="text-3xl font-semibold tabular-nums">
            {formatNumber(passRate * 100, 0)}%
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          {passes} of {snapshots.length} pairs meet 99% coverage target
        </CardContent>
      </Card>
    </div>
  );
}
