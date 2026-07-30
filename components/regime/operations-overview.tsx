"use client";

import Link from "next/link";
import {
  AlertTriangleIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  DatabaseIcon,
  ExternalLinkIcon,
  GaugeIcon,
  HistoryIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react";

import { RegimeBadge, ValidationStatusBadge } from "@/components/regime/badges";
import { Button } from "@/components/ui/button";
import {
  formatDate,
  formatDateTime,
  formatMultiplier,
  formatNumber,
  formatPercent,
  formatRate,
} from "@/lib/format";
import {
  MARKET_SENTIMENT_LABELS,
  MULTIPLIER_BUCKETS,
  TREND_ADJUSTMENT_LABELS,
  regimeTone,
} from "@/lib/regime";
import type { ProviderRun, RegimeSnapshot, ValidationRun } from "@/lib/types";
import { cn } from "@/lib/utils";

function Metric({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="min-w-0 border-l pl-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        <span>{label}</span>
      </div>
      <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
        {value}
      </div>
      <div className="mt-0.5 truncate text-xs text-muted-foreground">
        {hint}
      </div>
    </div>
  );
}

function latestRun(runs: ProviderRun[]) {
  return [...runs].sort((a, b) => {
    const left = a.completed_at ?? a.requested_at ?? "";
    const right = b.completed_at ?? b.requested_at ?? "";
    return right.localeCompare(left);
  })[0];
}

export function TrendOverlayMatrix({
  snapshots,
  validations,
}: {
  snapshots: RegimeSnapshot[];
  validations: ValidationRun[];
}) {
  const validationByPair = new Map(
    validations.map((run) => [run.pair_code, run]),
  );
  const rows = snapshots
    .map((snapshot) => {
      const validation = validationByPair.get(snapshot.pair);
      return { snapshot, validation };
    })
    .sort((a, b) => {
      const left = Math.abs(a.validation?.result.trend_adjustment_pct ?? 0);
      const right = Math.abs(b.validation?.result.trend_adjustment_pct ?? 0);
      return right - left;
    });

  return (
    <div className="overflow-hidden rounded-lg border bg-card/95">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3">
        <div>
          <h3 className="font-mono text-sm font-semibold uppercase tracking-wide">
            Trend-Aware Quant / LLM Strip
          </h3>
          <p className="text-xs text-muted-foreground">
            Deterministic multiplier ladder beside the latest LLM sentiment
            overlay
          </p>
        </div>
        <span className="rounded border bg-background px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
          {validations.length} latest validations
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] text-xs">
          <thead>
            <tr className="border-b bg-muted/10 text-left font-mono uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2">Pair</th>
              <th className="px-3 py-2">Sentiment</th>
              <th className="px-3 py-2">Direction</th>
              {MULTIPLIER_BUCKETS.map((bucket) => (
                <th key={bucket.key} className="px-3 py-2 text-right">
                  {bucket.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ snapshot, validation }) => {
              const quant =
                validation?.result.deterministic_trend_aware_multipliers ??
                snapshot.dynamic_trend_aware_regime_multiplier;
              const llm =
                validation?.result.llm_recommended_trend_aware_multipliers;
              return (
                <tr
                  key={snapshot.pair}
                  className="border-b last:border-b-0 hover:bg-muted/25"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/pairs/${snapshot.pair}`}
                      className="font-mono font-semibold hover:underline"
                    >
                      {snapshot.display_pair}
                    </Link>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {snapshot.current_volatility_readings.regime}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {validation
                      ? MARKET_SENTIMENT_LABELS[
                          validation.result.market_sentiment
                        ]
                      : "Awaiting LLM"}
                  </td>
                  <td className="px-3 py-2">
                    {validation ? (
                      <span className="font-mono">
                        {
                          TREND_ADJUSTMENT_LABELS[
                            validation.result.trend_adjustment_direction
                          ]
                        }
                        <span
                          className={cn(
                            "ml-2 tabular-nums",
                            validation.result.trend_adjustment_pct > 0 &&
                              "text-red-600 dark:text-red-400",
                            validation.result.trend_adjustment_pct < 0 &&
                              "text-emerald-600 dark:text-emerald-400",
                            validation.result.trend_adjustment_pct === 0 &&
                              "text-muted-foreground",
                          )}
                        >
                          {validation.result.trend_adjustment_pct > 0
                            ? "+"
                            : ""}
                          {formatPercent(
                            validation.result.trend_adjustment_pct,
                            1,
                          )}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </td>
                  {MULTIPLIER_BUCKETS.map((bucket) => {
                    const q = quant[bucket.key as keyof typeof quant] as number;
                    const l = llm?.[bucket.key];
                    const diff = l == null || q === 0 ? 0 : l / q - 1;
                    return (
                      <td
                        key={bucket.key}
                        className="px-3 py-2 text-right font-mono tabular-nums"
                      >
                        <div>{formatMultiplier(q)}</div>
                        <div
                          className={cn(
                            "text-[11px]",
                            l == null && "text-muted-foreground",
                            l != null &&
                              diff > 0 &&
                              "text-red-600 dark:text-red-400",
                            l != null &&
                              diff < 0 &&
                              "text-emerald-600 dark:text-emerald-400",
                            l != null && diff === 0 && "text-muted-foreground",
                          )}
                        >
                          LLM {l == null ? "--" : formatMultiplier(l)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function OperationsMetricStrip({
  snapshots,
  validations,
  providerRuns,
  asOf,
}: {
  snapshots: RegimeSnapshot[];
  validations: ValidationRun[];
  providerRuns: ProviderRun[];
  asOf: string | null;
}) {
  const latestAsOf =
    asOf ??
    snapshots.reduce<string | null>(
      (latest, snapshot) =>
        !latest || snapshot.as_of_date > latest ? snapshot.as_of_date : latest,
      null,
    );
  const elevated = snapshots.filter((snapshot) =>
    ["ELEVATED", "STRESSED", "CRISIS"].includes(
      snapshot.current_volatility_readings.regime,
    ),
  );
  const backtestPasses = snapshots.filter(
    (snapshot) => snapshot.backtest_validation_results.system_status === "PASS",
  ).length;
  const validationAligned = validations.filter((run) =>
    ["supports", "partially_supports"].includes(run.status),
  ).length;
  const validationEscalations = validations.filter(
    (run) =>
      run.status === "contradicts" ||
      run.result.recommended_action === "escalate_for_human_review",
  );
  const trendAdjustments = validations
    .map((run) => run.result.trend_adjustment_pct)
    .filter((value) => Number.isFinite(value));
  const avgTrendAdjustment =
    trendAdjustments.reduce((sum, value) => sum + value, 0) /
    Math.max(trendAdjustments.length, 1);
  const horizonDays = validations
    .map((run) => run.result.expected_signal_horizon_days)
    .filter((value) => Number.isFinite(value));
  const avgHorizon =
    horizonDays.reduce((sum, value) => sum + value, 0) /
    Math.max(horizonDays.length, 1);
  const failedRuns = providerRuns.filter(
    (run) => !["success", "succeeded", "skipped"].includes(run.status),
  );
  const lastRun = latestRun(providerRuns);
  const snapshotProviders = Array.from(
    new Set(snapshots.map((snapshot) => snapshot.market_data_provider)),
  ).filter(Boolean);
  const providerLabel =
    snapshotProviders.length === 0
      ? "stored provider"
      : snapshotProviders.join(" + ");

  return (
    <section className="space-y-5 border-b pb-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Regime Engine Observatory</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Deterministic FX regime snapshots, {providerLabel} provenance, and
            LLM validation are monitored here as separate audit layers.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/data-health">
              <DatabaseIcon className="size-3.5" />
              Provider runs
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-7">
        <Metric
          icon={GaugeIcon}
          label="Latest Snapshot"
          value={formatDate(latestAsOf)}
          hint={`${snapshots.length} active pairs`}
        />
        <Metric
          icon={AlertTriangleIcon}
          label="Elevated+"
          value={`${elevated.length}/${snapshots.length}`}
          hint="Pairs above normal regime"
        />
        <Metric
          icon={ShieldCheckIcon}
          label="VaR Pass Rate"
          value={formatPercent(
            backtestPasses / Math.max(snapshots.length, 1),
            0,
          )}
          hint="99% historical coverage"
        />
        <Metric
          icon={SparklesIcon}
          label="LLM Alignment"
          value={formatPercent(
            validationAligned / Math.max(validations.length, 1),
            0,
          )}
          hint={`${validationEscalations.length} escalation flags`}
        />
        <Metric
          icon={SparklesIcon}
          label="Trend Overlay"
          value={formatPercent(avgTrendAdjustment, 1)}
          hint="Avg LLM multiplier adjustment"
        />
        <Metric
          icon={CalendarClockIcon}
          label="Signal Horizon"
          value={`${formatNumber(avgHorizon, 1)}d`}
          hint="Avg LLM overlay life"
        />
        <Metric
          icon={CheckCircle2Icon}
          label="Last Provider Run"
          value={lastRun?.status ?? "--"}
          hint={
            lastRun
              ? `${lastRun.provider_name} · ${lastRun.pair_code} · ${formatDateTime(lastRun.completed_at)}`
              : "--"
          }
        />
      </div>

      {failedRuns.length > 0 && (
        <div className="rounded-md border border-red-600/25 bg-red-600/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {failedRuns.length} provider run{failedRuns.length === 1 ? "" : "s"}{" "}
          need review.
        </div>
      )}
    </section>
  );
}

export function SignalHorizonOverviewPanel({
  validations,
}: {
  validations: ValidationRun[];
}) {
  const rows = [...validations].sort((a, b) => {
    const left = a.result.expected_signal_horizon_days;
    const right = b.result.expected_signal_horizon_days;
    return right - left;
  });
  const avgMemory =
    rows.reduce((sum, run) => sum + run.prior_validation_context.item_count, 0) /
    Math.max(rows.length, 1);
  const memoryBacked = rows.filter(
    (run) => run.prior_validation_context.item_count > 0,
  ).length;

  return (
    <section className="rounded-lg border bg-card/95">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/20 px-4 py-3">
        <div>
          <h3 className="font-mono text-sm font-semibold uppercase tracking-wide">
            LLM Signal Horizon & Rolling Memory
          </h3>
          <p className="text-xs text-muted-foreground">
            Latest expected overlay life and prior validation context used before today&apos;s verdict
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded border bg-background px-2 py-0.5 font-mono">
            {memoryBacked}/{rows.length} memory-backed
          </span>
          <span className="rounded border bg-background px-2 py-0.5 font-mono">
            avg {formatNumber(avgMemory, 1)} prior reads
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 divide-y lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        {rows.map((run) => (
          <Link
            key={run.id}
            href={`/pairs/${run.pair_code}?tab=validation&run=${run.id}`}
            className="block p-4 transition-colors hover:bg-muted/30"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-sm font-semibold">
                  {run.result.display_pair}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {MARKET_SENTIMENT_LABELS[run.result.market_sentiment]}
                </div>
              </div>
              <ValidationStatusBadge status={run.status} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-md border bg-muted/20 p-3">
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <CalendarClockIcon className="size-3.5" />
                  Horizon
                </div>
                <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
                  {formatNumber(run.result.expected_signal_horizon_days, 0)}d
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  until {formatDate(run.result.expected_signal_valid_until)}
                </div>
              </div>
              <div className="rounded-md border bg-muted/20 p-3">
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <HistoryIcon className="size-3.5" />
                  Memory
                </div>
                <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
                  {run.prior_validation_context.item_count}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  prior reads used
                </div>
              </div>
            </div>
            <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {run.result.signal_horizon_rationale}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function OperationsSupportPanels({
  snapshots,
  validations,
  providerRuns,
}: {
  snapshots: RegimeSnapshot[];
  validations: ValidationRun[];
  providerRuns: ProviderRun[];
}) {
  const failedRuns = providerRuns.filter(
    (run) => !["success", "succeeded", "skipped"].includes(run.status),
  );
  const focusPairs = [...snapshots]
    .sort((a, b) => {
      const bScore =
        b.current_volatility_readings.regime_score * 10 +
        b.current_volatility_readings.accel_vs_252d;
      const aScore =
        a.current_volatility_readings.regime_score * 10 +
        a.current_volatility_readings.accel_vs_252d;
      return bScore - aScore;
    })
    .slice(0, 5);
  const validationByPair = new Map(
    validations.map((run) => [run.pair_code, run]),
  );

  return (
    <section className="border-b pb-5">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_1fr]">
        <div className="rounded-lg border">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h3 className="text-sm font-medium">Risk Focus</h3>
              <p className="text-xs text-muted-foreground">
                Highest regime-score and acceleration pairs to review first
              </p>
            </div>
            {failedRuns.length > 0 && (
              <span className="rounded-md border border-red-600/25 bg-red-600/10 px-2 py-0.5 text-xs text-red-700 dark:text-red-300">
                {failedRuns.length} failed runs
              </span>
            )}
          </div>
          <div className="divide-y">
            {focusPairs.map((snapshot) => {
              const vol = snapshot.current_volatility_readings;
              const validation = validationByPair.get(snapshot.pair);
              return (
                <Link
                  key={snapshot.pair}
                  href={`/pairs/${snapshot.pair}`}
                  className="grid gap-3 px-4 py-3 transition-colors hover:bg-muted/40 md:grid-cols-[120px_1fr_150px]"
                >
                  <div>
                    <div className="font-mono text-sm font-semibold">
                      {snapshot.display_pair}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {formatRate(snapshot.live_spot_rates.spot_rate)}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <RegimeBadge
                        regime={vol.regime}
                        score={vol.regime_score}
                      />
                      {validation && (
                        <ValidationStatusBadge status={validation.status} />
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
                      <span>
                        <span className="text-muted-foreground">Accel </span>
                        <span className="font-mono">
                          {formatNumber(vol.accel_vs_252d, 2)}x
                        </span>
                      </span>
                      <span>
                        <span className="text-muted-foreground">30d </span>
                        <span className="font-mono">
                          {formatPercent(vol.vol_30d, 1)}
                        </span>
                      </span>
                      <span>
                        <span className="text-muted-foreground">252d </span>
                        <span className="font-mono">
                          {formatPercent(vol.vol_252d, 1)}
                        </span>
                      </span>
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-2 md:justify-end"
                    title="Acceleration toward the crisis threshold (2.5×)"
                  >
                    <div className="hidden flex-col items-end gap-1 sm:flex">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Crisis proximity
                      </span>
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(vol.accel_vs_252d / 2.5, 1) * 100}%`,
                            backgroundColor: regimeTone(vol.regime).hex,
                          }}
                        />
                      </div>
                    </div>
                    <ExternalLinkIcon className="size-3.5 text-muted-foreground" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-medium">
              Trend-Aware Validation State
            </h3>
            <p className="text-xs text-muted-foreground">
              Latest multiplier overlay verdicts and market sentiment
            </p>
          </div>
          <div className="divide-y">
            {validations.slice(0, 5).map((run) => (
              <Link
                key={run.id}
                href={`/pairs/${run.pair_code}?tab=validation`}
                className="block px-4 py-3 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-sm font-semibold">
                    {run.result.display_pair}
                  </span>
                  <ValidationStatusBadge status={run.status} />
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {run.result.trend_aware_validation_summary}
                </p>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{run.result.trend_adjustment_direction}</span>
                  <span
                    className={cn("size-1 rounded-full bg-muted-foreground/40")}
                  />
                  <span>
                    {formatPercent(run.result.trend_adjustment_pct, 1)} overlay
                  </span>
                  <span
                    className={cn("size-1 rounded-full bg-muted-foreground/40")}
                  />
                  <span>
                    {formatNumber(
                      run.result.trend_adjustment_confidence * 100,
                      0,
                    )}
                    % confidence
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function OperationsOverview({
  snapshots,
  validations,
  providerRuns,
  asOf,
}: {
  snapshots: RegimeSnapshot[];
  validations: ValidationRun[];
  providerRuns: ProviderRun[];
  asOf: string | null;
}) {
  return (
    <>
      <OperationsMetricStrip
        snapshots={snapshots}
        validations={validations}
        providerRuns={providerRuns}
        asOf={asOf}
      />
      <OperationsSupportPanels
        snapshots={snapshots}
        validations={validations}
        providerRuns={providerRuns}
      />
    </>
  );
}
