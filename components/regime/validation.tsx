"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarClockIcon,
  ExternalLinkIcon,
  HistoryIcon,
  SparklesIcon,
} from "lucide-react";

import {
  ActionBadge,
  RegimeBadge,
  ValidationStatusBadge,
} from "@/components/regime/badges";
import { EmptyState, Stat } from "@/components/regime/primitives";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DatePickerNaturalLanguage } from "@/components/ui/date-picker-natural-language";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TimePickerIcon } from "@/components/ui/time-picker-icon";
import {
  formatDate,
  formatDateTime,
  formatMultiplier,
  formatNumber,
  titleCase,
} from "@/lib/format";
import {
  MARKET_SENTIMENT_LABELS,
  MULTIPLIER_BUCKETS,
  TREND_ADJUSTMENT_LABELS,
  VALIDATION_RUN_SOURCE_LABELS,
} from "@/lib/regime";
import { cn } from "@/lib/utils";
import type {
  MLMultiplierPrediction,
  ValidationResult,
  ValidationRun,
} from "@/lib/types";

/** Pretty-print a string if it is valid JSON, otherwise return it unchanged. */
function formatMaybeJson(raw: string): string {
  const trimmed = raw?.trim();
  if (!trimmed || (trimmed[0] !== "{" && trimmed[0] !== "[")) return raw;
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return raw;
  }
}

export function TrendAwareAdjustmentCard({
  run,
  mlPredictions = [],
}: {
  run: ValidationRun;
  mlPredictions?: MLMultiplierPrediction[];
}) {
  const r = run.result;
  const delta =
    r.recommended_primary_trend_multiplier -
    r.deterministic_primary_trend_multiplier;
  const positive = delta > 0;
  const neutral = Math.abs(delta) < 0.0001;
  const exactDatePredictions = mlPredictions.filter(
    (prediction) => prediction.as_of_date === run.as_of_date,
  );
  const storedMLContext = run.independent_ml_shadow_context;
  const mlByTenor = new Map<
    keyof typeof r.deterministic_trend_aware_multipliers,
    number | null
  >();
  for (const bucket of MULTIPLIER_BUCKETS) {
    const stored =
      storedMLContext?.tenors[bucket.key]?.independent_ml_shadow_multiplier;
    const exact = exactDatePredictions.find(
      (prediction) => prediction.tenor_key === bucket.key,
    )?.ml_multiplier;
    mlByTenor.set(bucket.key, stored ?? exact ?? null);
  }
  const mlContextSource = storedMLContext
    ? `Seen by this LLM run · ${storedMLContext.model_version}`
    : exactDatePredictions.length
      ? "Same-date ML exists · not stored in this LLM input"
      : "Not supplied to this run";
  const primaryML = mlByTenor.get(r.primary_trend_aware_tenor) ?? null;
  const ladder = MULTIPLIER_BUCKETS.map((bucket) => {
    const deterministic = r.deterministic_trend_aware_multipliers[bucket.key];
    const recommended = r.llm_recommended_trend_aware_multipliers[bucket.key];
    const pct = deterministic === 0 ? 0 : recommended / deterministic - 1;
    const ml = mlByTenor.get(bucket.key) ?? null;
    const mlPct =
      ml == null || deterministic === 0 ? null : ml / deterministic - 1;
    return { ...bucket, deterministic, recommended, pct, ml, mlPct };
  });

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="text-sm">Trend-Aware Multiplier Decision Stack</CardTitle>
          <CardDescription>
            Official Quant Engine with LLM and independent ML challengers across all tenors
          </CardDescription>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            ML audit source: {mlContextSource}
          </p>
        </div>
        <Link
          href={`/ml-multiplier?pair=${run.pair_code}`}
          className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Inspect ML history
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <Stat
            label="Quant Engine"
            value={`${formatNumber(r.deterministic_primary_trend_multiplier, 2)}x`}
          />
          <Stat
            label="LLM overlay"
            value={`${formatNumber(r.recommended_primary_trend_multiplier, 2)}x`}
          />
          <Stat
            label="Independent ML"
            value={primaryML == null ? "--" : formatMultiplier(primaryML)}
          />
          <Stat
            label="LLM adjustment"
            value={`${positive ? "+" : ""}${formatNumber(r.trend_adjustment_pct * 100, 1)}%`}
          />
          <Stat
            label="Sentiment"
            value={MARKET_SENTIMENT_LABELS[r.market_sentiment]}
            mono={false}
          />
        </div>
        <div className="rounded-lg border bg-muted/25 p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={cn(
                "rounded-md border px-2 py-0.5 font-medium",
                positive
                  ? "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300"
                  : neutral
                    ? "border-border bg-background text-muted-foreground"
                    : "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
              )}
            >
              {TREND_ADJUSTMENT_LABELS[r.trend_adjustment_direction]}
            </span>
            <span className="text-muted-foreground">
              {formatNumber(r.trend_adjustment_confidence * 100, 0)}% adjustment
              confidence
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {r.trend_adjustment_rationale}
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <Table className="min-w-[520px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-3 font-mono text-[11px] uppercase tracking-wide">
                  Tenor
                </TableHead>
                <TableHead className="px-3 text-right font-mono text-[11px] uppercase tracking-wide">
                  Quant
                </TableHead>
                <TableHead className="px-3 text-right font-mono text-[11px] uppercase tracking-wide">
                  LLM
                </TableHead>
                <TableHead className="px-3 text-right font-mono text-[11px] uppercase tracking-wide">
                  ML
                </TableHead>
                <TableHead className="px-3 text-right font-mono text-[11px] uppercase tracking-wide">
                  Δ vs Quant
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ladder.map((row) => {
                const rowPositive = row.pct > 0;
                const rowNeutral = Math.abs(row.pct) < 0.0001;
                return (
                  <TableRow
                    key={row.key}
                    className={cn(
                      row.key === r.primary_trend_aware_tenor && "bg-muted/35",
                    )}
                  >
                    <TableCell className="px-3 py-2 font-mono text-xs">
                      {row.label}
                      {row.key === r.primary_trend_aware_tenor && (
                        <span className="ml-2 rounded border bg-background px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground">
                          primary
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                      {formatMultiplier(row.deterministic)}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                      {formatMultiplier(row.recommended)}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                      {row.ml == null ? "--" : formatMultiplier(row.ml)}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right font-mono text-[11px] tabular-nums">
                      <div
                        className={cn(
                          rowPositive && "text-red-600 dark:text-red-400",
                          !rowPositive &&
                            !rowNeutral &&
                            "text-emerald-600 dark:text-emerald-400",
                          rowNeutral && "text-muted-foreground",
                        )}
                      >
                        L {rowPositive ? "+" : ""}
                        {formatNumber(row.pct * 100, 1)}%
                      </div>
                      <div
                        className={cn(
                          "mt-0.5",
                          row.mlPct != null &&
                            Math.abs(row.mlPct) > 0.15 &&
                            "text-amber-600 dark:text-amber-400",
                          row.mlPct == null && "text-muted-foreground",
                        )}
                      >
                        M{" "}
                        {row.mlPct == null
                          ? "--"
                          : `${row.mlPct > 0 ? "+" : ""}${formatNumber(row.mlPct * 100, 1)}%`}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {r.trend_driver_evidence.length > 0 && (
          <PointList
            title="Trend drivers"
            points={r.trend_driver_evidence}
            tone="bg-sky-500"
          />
        )}
      </CardContent>
    </Card>
  );
}

export function SignalHorizonCard({ run }: { run: ValidationRun }) {
  const r = run.result;
  const memory = run.prior_validation_context;
  const memoryItems = memory.items ?? [];
  const latestMemory = memoryItems[0];

  return (
    <Card className="border-foreground/10 bg-card/95">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CalendarClockIcon className="size-4 text-muted-foreground" />
              Signal Horizon
            </CardTitle>
            <CardDescription>
              How long the current LLM overlay expects its market read to remain useful
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border bg-muted/40 px-2 py-0.5 text-xs">
              Canonical memory
            </span>
            <span className="rounded-md border bg-muted/40 px-2 py-0.5 font-mono text-xs">
              {memory.item_count} prior reads
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat
            label="Expected life"
            value={`${formatNumber(r.expected_signal_horizon_days, 0)} days`}
          />
          <Stat
            label="Valid until"
            value={formatDate(r.expected_signal_valid_until)}
          />
          <Stat
            label="Memory mode"
            value={memory.memory_mode === "none" ? "No memory" : "Rolling 7d"}
            mono={false}
            hint={`${memory.lookback_days}d lookback`}
          />
        </div>
        <div className="rounded-lg border bg-muted/20 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Horizon rationale
          </div>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {r.signal_horizon_rationale}
          </p>
        </div>
        {latestMemory && (
          <div className="rounded-lg border border-dashed p-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <HistoryIcon className="size-3.5" />
              Latest prior read used
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono">{formatDate(latestMemory.as_of_date)}</span>
              {latestMemory.trend_adjustment_direction && (
                <span className="rounded border bg-muted/40 px-1.5 py-0.5">
                  {TREND_ADJUSTMENT_LABELS[latestMemory.trend_adjustment_direction]}
                </span>
              )}
              {latestMemory.trend_adjustment_pct != null && (
                <span className="font-mono text-muted-foreground">
                  {latestMemory.trend_adjustment_pct > 0 ? "+" : ""}
                  {formatNumber(latestMemory.trend_adjustment_pct * 100, 1)}%
                </span>
              )}
              {latestMemory.prior_market_state?.observed_spot_rate != null && (
                <span className="text-muted-foreground">
                  Observed{" "}
                  <span className="font-mono text-foreground">
                    {formatNumber(
                      latestMemory.prior_market_state.observed_spot_rate,
                      4,
                    )}
                  </span>
                  {latestMemory.prior_market_state.regime
                    ? ` · ${titleCase(latestMemory.prior_market_state.regime)}`
                    : ""}
                </span>
              )}
              {memory.continuity_summary?.latest_prior_read && (
                <span
                  className={cn(
                    "rounded border px-1.5 py-0.5",
                    memory.continuity_summary.active_prior_signal
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "bg-muted/40 text-muted-foreground",
                  )}
                >
                  {memory.continuity_summary.active_prior_signal
                    ? "Prior horizon active"
                    : "Prior horizon expired"}
                </span>
              )}
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
              {latestMemory.trend_adjustment_rationale ||
                latestMemory.trend_aware_validation_summary}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PriorValidationMemoryCard({ run }: { run: ValidationRun }) {
  const memory = run.prior_validation_context;
  if (memory.item_count === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Rolling Memory Context</CardTitle>
          <CardDescription>No prior validation context was used for this run</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Rolling Memory Context</CardTitle>
        <CardDescription>
          {memory.item_count} canonical same-pair validation reads from the last{" "}
          {memory.lookback_days} days. Observed rates are historical context, not price
          forecasts.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[1040px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-4">As of</TableHead>
                <TableHead>Observed state</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead className="text-right">Overlay</TableHead>
                <TableHead className="text-right">Horizon</TableHead>
                <TableHead>Prior rationale</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memory.items.map((item) => (
                <TableRow key={item.validation_run_id || item.as_of_date}>
                  <TableCell className="px-4 font-mono text-xs">
                    {formatDate(item.as_of_date)}
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-xs">
                      {item.prior_market_state?.observed_spot_rate == null
                        ? "--"
                        : formatNumber(
                            item.prior_market_state.observed_spot_rate,
                            4,
                          )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {item.prior_market_state?.regime
                        ? titleCase(item.prior_market_state.regime)
                        : "Historical provider read"}
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.trend_adjustment_direction ? (
                      TREND_ADJUSTMENT_LABELS[item.trend_adjustment_direction]
                    ) : (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {item.trend_adjustment_pct == null
                      ? "--"
                      : `${item.trend_adjustment_pct > 0 ? "+" : ""}${formatNumber(
                          item.trend_adjustment_pct * 100,
                          1,
                        )}%`}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {item.expected_signal_horizon_days == null
                      ? "--"
                      : `${item.expected_signal_horizon_days}d`}
                  </TableCell>
                  <TableCell className="max-w-[420px]">
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {item.trend_adjustment_rationale ||
                        item.trend_aware_validation_summary ||
                        item.validation_summary}
                    </p>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <Progress value={value * 100} className="h-2 w-24" />
      <span className="font-mono text-xs tabular-nums">
        {formatNumber(value * 100, 0)}%
      </span>
    </div>
  );
}

/** Compact validation card — shows the latest run, used on the snapshot tab. */
export function ValidationSummaryCard({
  run,
  href,
  runCount = 1,
}: {
  run: ValidationRun;
  href?: string;
  runCount?: number;
}) {
  const r = run.result;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <SparklesIcon className="size-4 text-muted-foreground" />
              LLM Validation
              <span className="font-normal text-muted-foreground">
                · latest
              </span>
            </CardTitle>
            <CardDescription className="mt-1">
              {VALIDATION_RUN_SOURCE_LABELS[run.run_source]} · {run.model_name}{" "}
              · {formatDateTime(run.created_at)}
            </CardDescription>
          </div>
          <ValidationStatusBadge status={r.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed">{r.validation_summary}</p>
        <div className="grid grid-cols-2 gap-4">
          <Stat
            label="Deterministic regime"
            value={<RegimeBadge regime={r.deterministic_regime} />}
            mono={false}
          />
          <Stat
            label="External context read"
            value={r.external_context_regime_read}
            mono={false}
          />
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Confidence</span>
            <ConfidenceBar value={r.confidence} />
          </div>
          <Stat
            label="Recommended action"
            value={<ActionBadge action={r.recommended_action} />}
            mono={false}
          />
          <Stat
            label="Signal horizon"
            value={`${formatNumber(r.expected_signal_horizon_days, 0)} days`}
            hint={`Valid until ${formatDate(r.expected_signal_valid_until)}`}
          />
          <Stat
            label="Memory used"
            value={`${run.prior_validation_context.item_count} prior reads`}
            mono={false}
            hint={run.prior_validation_context.memory_mode}
          />
        </div>
        {href && (
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {runCount > 1
              ? `View all ${runCount} validation runs`
              : "View full validation trace"}
            <ExternalLinkIcon className="size-3.5" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

function PointList({
  title,
  points,
  tone,
}: {
  title: string;
  points: string[];
  tone: string;
}) {
  if (points.length === 0) return null;
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      <ul className="space-y-1.5">
        {points.map((p, i) => (
          <li key={i} className="flex gap-2 text-sm">
            <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${tone}`} />
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScorerRow({ result }: { result: ValidationResult }) {
  return (
    <TableRow>
      <TableCell className="px-6 font-mono text-xs">
        {result.scorer_model}
      </TableCell>
      <TableCell>
        <ValidationStatusBadge status={result.status} />
      </TableCell>
      <TableCell className="px-6 text-right">
        <ConfidenceBar value={result.confidence} />
      </TableCell>
    </TableRow>
  );
}

function validationRunLabel(run: ValidationRun) {
  return `${formatDateTime(run.created_at)} · ${VALIDATION_RUN_SOURCE_LABELS[run.run_source]}`;
}

function validationRunDate(run: ValidationRun) {
  return new Date(run.created_at).toISOString().slice(0, 10);
}

function validationRunTime(run: ValidationRun) {
  const date = new Date(run.created_at);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function dateKeyToDate(value: string) {
  return value ? new Date(`${value}T00:00:00`) : undefined;
}

function dateToKey(value?: Date) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function minutesFromTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return undefined;
  return hours * 60 + minutes;
}

const VALIDATION_HISTORY_START_DATE = "2026-06-04";

function ValidationOutputLedger({ run }: { run: ValidationRun }) {
  const r = run.result;
  const rows = [
    ["Run source", VALIDATION_RUN_SOURCE_LABELS[run.run_source]],
    ["Status", titleCase(r.status)],
    ["Confidence", `${formatNumber(r.confidence * 100, 0)}%`],
    ["Deterministic regime", r.deterministic_regime],
    ["External context read", r.external_context_regime_read],
    ["Market sentiment", MARKET_SENTIMENT_LABELS[r.market_sentiment]],
    ["Trend adjustment", TREND_ADJUSTMENT_LABELS[r.trend_adjustment_direction]],
    ["Expected signal horizon", `${formatNumber(r.expected_signal_horizon_days, 0)} days`],
    ["Signal valid until", formatDate(r.expected_signal_valid_until)],
    [
      "Adjustment confidence",
      `${formatNumber(r.trend_adjustment_confidence * 100, 0)}%`,
    ],
    ["Recommended action", titleCase(r.recommended_action)],
    ["Scorer model", r.scorer_model],
    ["Prompt version", r.prompt_version],
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">LLM Output Ledger</CardTitle>
        <CardDescription>
          Every first-class validation field captured from the JSON result
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(([label, value]) => (
            <div key={label} className="border-l pl-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {label}
              </div>
              <div className="mt-0.5 break-words font-mono text-xs font-medium">
                {value}
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Validation summary
            </div>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {r.validation_summary}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Trend-aware summary
            </div>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {r.trend_aware_validation_summary}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Adjustment rationale
            </div>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {r.trend_adjustment_rationale}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ValidationDetail({ run }: { run: ValidationRun }) {
  const r = run.result;
  const brief = r.research_brief;

  return (
    <div className="space-y-4">
      <ValidationSummaryCard run={run} />
      <SignalHorizonCard run={run} />
      <PriorValidationMemoryCard run={run} />
      <TrendAwareAdjustmentCard run={run} />
      <ValidationOutputLedger run={run} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Analyst Rationale</CardTitle>
            <CardDescription>Aggregated verdict reasoning</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {r.rationale}
            </p>
            <PointList
              title="Supporting points"
              points={r.supporting_points}
              tone="bg-emerald-500"
            />
            <PointList
              title="Contradicting points"
              points={r.contradicting_points}
              tone="bg-red-500"
            />
            <PointList
              title="Watch items"
              points={r.watch_items}
              tone="bg-amber-500"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Research Brief</CardTitle>
            <CardDescription>
              Grounded context · {brief.retrieval_model}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Macro
              </span>
              <p className="mt-1 leading-relaxed text-muted-foreground">
                {brief.macro_context}
              </p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Central bank
              </span>
              <p className="mt-1 leading-relaxed text-muted-foreground">
                {brief.central_bank_context}
              </p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Currency-specific
              </span>
              <p className="mt-1 leading-relaxed text-muted-foreground">
                {brief.currency_specific_context}
              </p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Market sentiment
              </span>
              <p className="mt-1 leading-relaxed text-muted-foreground">
                {brief.market_sentiment_summary}
              </p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Policy/liquidity
              </span>
              <p className="mt-1 leading-relaxed text-muted-foreground">
                {brief.policy_liquidity_context}
              </p>
            </div>
            {brief.risk_events.length > 0 && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Risk events
                </span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {brief.risk_events.map((e, i) => (
                    <span
                      key={i}
                      className="rounded-md border bg-muted/50 px-2 py-0.5 text-xs"
                    >
                      {e}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {run.independent_scorer_results.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ensemble Scorers</CardTitle>
            <CardDescription>
              Independent views aggregated into the final verdict
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-6">Model</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="px-6 text-right">Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {run.independent_scorer_results.map((res, i) => (
                  <ScorerRow key={i} result={res} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ensemble Scorers</CardTitle>
            <CardDescription>
              Independent views aggregated into the final verdict
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No ensemble run for this validation — a single scorer model
              produced the verdict shown above.
            </p>
          </CardContent>
        </Card>
      )}

      {brief.evidence.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Evidence</CardTitle>
            <CardDescription>
              Cited sources behind the research brief
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {brief.evidence.map((e, i) => (
              <div
                key={i}
                className="flex items-start justify-between gap-4 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-sm font-medium hover:underline"
                  >
                    <span className="truncate">{e.title}</span>
                    <ExternalLinkIcon className="size-3 shrink-0 text-muted-foreground" />
                  </a>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {e.excerpt}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{e.source}</span>
                    {e.published_at && (
                      <span>· {formatDate(e.published_at)}</span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 rounded-md border bg-muted/50 px-2 py-0.5 font-mono text-xs">
                  {formatNumber(e.relevance_score, 2)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Raw Model Responses</CardTitle>
          <CardDescription>
            Full audit trace for every model call
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {run.raw_model_responses.map((call, i) => (
              <AccordionItem key={i} value={`call-${i}`}>
                <AccordionTrigger>
                  <span className="flex items-center gap-2 text-sm">
                    <span className="rounded border bg-muted/50 px-1.5 py-0.5 text-xs">
                      {titleCase(call.call_role)}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {call.model}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  {call.reasoning_content && (
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Reasoning
                      </span>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {call.reasoning_content}
                      </p>
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Raw content
                    </span>
                    <pre className="mt-1 max-h-96 overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                      {formatMaybeJson(call.raw_content)}
                    </pre>
                  </div>
                  {call.citations.length > 0 && (
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Citations ({call.citations.length})
                      </span>
                      <ul className="mt-1 space-y-1">
                        {call.citations.map((c, ci) => (
                          <li key={ci}>
                            <a
                              href={c.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary hover:underline"
                            >
                              {c.title || c.url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Renders every validation run recorded for a pair. A pair can be validated
 * many times (re-runs, different models, different days), so this shows a run
 * selector when there is more than one, with the full trace for the selected run.
 */
export function PairValidations({
  runs,
  initialRunId,
}: {
  runs: ValidationRun[];
  initialRunId?: string | null;
}) {
  const ordered = React.useMemo(
    () =>
      [...runs].sort((a, b) =>
        (b.created_at ?? "").localeCompare(a.created_at ?? ""),
      ),
    [runs],
  );
  const defaultRun =
    ordered.find(
      (run) => run.run_source !== "experiment" && !run.experiment_id,
    ) ?? ordered[0];
  const initialSelected =
    (initialRunId
      ? ordered.find((run) => run.id === initialRunId)
      : undefined) ?? defaultRun;
  const [selectedId, setSelectedId] = React.useState<string | undefined>(
    initialSelected?.id,
  );
  const [selectedDate, setSelectedDate] = React.useState(
    initialSelected ? validationRunDate(initialSelected) : "",
  );
  const [selectedTime, setSelectedTime] = React.useState(
    initialSelected ? validationRunTime(initialSelected) : "",
  );

  if (ordered.length === 0) {
    return (
      <EmptyState
        title="No validation run yet"
        description="No LLM validation has been recorded for this pair. Runs will appear here once the intelligence layer scores a snapshot."
      />
    );
  }

  const selected = ordered.find((r) => r.id === selectedId) ?? ordered[0];
  const selectedDateRuns = selectedDate
    ? ordered.filter((run) => validationRunDate(run) === selectedDate)
    : [];
  const dropdownRuns = Array.from(
    new Map(
      [...ordered.slice(0, 10), ...selectedDateRuns, selected].map((run) => [
        run.id,
        run,
      ]),
    ).values(),
  ).sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  const firstDate = ordered[ordered.length - 1]
    ? validationRunDate(ordered[ordered.length - 1])
    : undefined;
  const earliestSelectableDate =
    firstDate && firstDate > VALIDATION_HISTORY_START_DATE
      ? firstDate
      : VALIDATION_HISTORY_START_DATE;
  const lastDate = ordered[0] ? validationRunDate(ordered[0]) : undefined;
  const selectedDateHasRuns = selectedDateRuns.length > 0;
  const bestRunForDateTime = (date: string, time: string) => {
    const runsOnDate = ordered.filter(
      (item) => validationRunDate(item) === date,
    );
    if (!runsOnDate.length) return undefined;
    const targetMinutes = minutesFromTime(time);
    if (targetMinutes == null) return runsOnDate[0];
    return runsOnDate.reduce((best, run) => {
      const bestDistance = Math.abs(
        minutesFromTime(validationRunTime(best))! - targetMinutes,
      );
      const runDistance = Math.abs(
        minutesFromTime(validationRunTime(run))! - targetMinutes,
      );
      return runDistance < bestDistance ? run : best;
    }, runsOnDate[0]);
  };

  const selectRun = (runId: string) => {
    const run = ordered.find((item) => item.id === runId);
    setSelectedId(runId);
    if (run) {
      setSelectedDate(validationRunDate(run));
      setSelectedTime(validationRunTime(run));
    }
  };

  const selectDate = (date?: Date) => {
    const dateKey = dateToKey(date);
    setSelectedDate(dateKey);
    const run = bestRunForDateTime(dateKey, selectedTime);
    if (run) setSelectedId(run.id);
  };

  const selectTime = (time: string) => {
    setSelectedTime(time);
    const run = bestRunForDateTime(selectedDate, time);
    if (run) setSelectedId(run.id);
  };

  return (
    <div className="space-y-4">
      {ordered.length > 1 && (
        <Card className="border-foreground/10 bg-card/95">
          <CardContent className="space-y-5 p-4">
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {ordered.length} validation runs · newest first
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-medium">
                    {formatDateTime(selected.created_at)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {VALIDATION_RUN_SOURCE_LABELS[selected.run_source]} ·{" "}
                    {selected.model_name}
                  </span>
                  <ValidationStatusBadge status={selected.status} />
                </div>
              </div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                selected validation
              </p>
            </div>
            <div className="grid w-full gap-4 lg:grid-cols-[minmax(240px,0.9fr)_minmax(340px,1.15fr)_150px]">
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Review run
                </span>
                <Select value={selected.id} onValueChange={selectRun}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue placeholder="Select validation run" />
                  </SelectTrigger>
                  <SelectContent align="end" className="max-h-80">
                    {dropdownRuns.map((run) => (
                      <SelectItem key={run.id} value={run.id}>
                        {validationRunLabel(run)} · {titleCase(run.status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-[11px] text-muted-foreground">
                  Showing latest 10 plus selected-date runs
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Jump to date
                </span>
                <DatePickerNaturalLanguage
                  value={dateKeyToDate(selectedDate)}
                  min={dateKeyToDate(earliestSelectableDate)}
                  max={dateKeyToDate(lastDate ?? "")}
                  disableWeekends
                  onChange={selectDate}
                  placeholder="e.g. last Friday"
                />
                <span className="text-[11px] text-muted-foreground">
                  {selectedDateHasRuns
                    ? `${selectedDateRuns.length} run${selectedDateRuns.length === 1 ? "" : "s"} on date`
                    : "No run on selected date"}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Time
                </span>
                <TimePickerIcon value={selectedTime} onChange={selectTime} />
                <span className="text-[11px] text-muted-foreground">
                  Nearest run
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      <ValidationDetail run={selected} />
    </div>
  );
}
