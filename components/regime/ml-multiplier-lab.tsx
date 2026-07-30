"use client";

import Link from "next/link";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  FlaskConicalIcon,
  ShieldAlertIcon,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { EmptyState } from "@/components/regime/primitives";
import { Button } from "@/components/ui/button";
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
import { formatDate, formatMultiplier, formatNumber, formatVol } from "@/lib/format";
import type {
  BenchmarkResult,
  MLMultiplierBenchmarkResult,
  MLMultiplierLabResponse,
  MLMultiplierPrediction,
  TrendAwareMultiplierMap,
  ValidationRun,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const TENORS: { key: keyof TrendAwareMultiplierMap; label: string }[] = [
  { key: "tenor_le_14d", label: "≤14d" },
  { key: "tenor_le_30d", label: "≤30d" },
  { key: "tenor_le_60d", label: "≤60d" },
  { key: "tenor_le_90d", label: "≤90d" },
  { key: "tenor_le_180d", label: "≤180d" },
  { key: "tenor_gt_180d", label: ">180d" },
];

const COLORS = {
  quant: "#60a5fa",
  llm: "#a78bfa",
  ml: "#22c55e",
  realized: "#f59e0b",
};

const AXIS_TICK_STYLE = {
  fill: "var(--muted-foreground)",
  fontSize: 10,
};

const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontSize: 11,
  lineHeight: 1.25,
};

function pct(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

function signedPct(value: number, digits = 1) {
  return `${value > 0 ? "+" : ""}${pct(value, digits)}`;
}

function tenorLabel(key: string) {
  return TENORS.find((tenor) => tenor.key === key)?.label ?? key;
}

function latestByTenor(rows: MLMultiplierPrediction[]) {
  const latest = rows.reduce(
    (value, row) => (row.as_of_date > value ? row.as_of_date : value),
    "",
  );
  return rows
    .filter((row) => row.as_of_date === latest)
    .sort((left, right) => left.horizon_days - right.horizon_days);
}

function canonicalValidationByDate(rows: ValidationRun[], pair: string) {
  const byDate = new Map<string, ValidationRun>();
  const sourcePriority: Record<ValidationRun["run_source"], number> = {
    scheduled: 5,
    manual: 4,
    backfill: 3,
    unknown: 2,
    test: 1,
    experiment: 0,
  };
  for (const run of rows) {
    if (run.pair_code !== pair || run.experiment_variant != null) {
      continue;
    }
    const existing = byDate.get(run.as_of_date);
    const isPreferredSource =
      existing == null ||
      sourcePriority[run.run_source] > sourcePriority[existing.run_source];
    const isNewerSameSource =
      existing != null &&
      sourcePriority[run.run_source] === sourcePriority[existing.run_source] &&
      run.created_at > existing.created_at;
    if (isPreferredSource || isNewerSameSource) {
      byDate.set(run.as_of_date, run);
    }
  }
  return byDate;
}

function benchmarkKey(row: { pair_code: string; as_of_date: string; tenor_key: string }) {
  return `${row.pair_code}:${row.as_of_date}:${row.tenor_key}`;
}

function LabMetric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "good" | "warn";
}) {
  return (
    <div className="min-w-0 border-l pl-4">
      <div className="text-[11px] font-medium uppercase text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 font-mono text-xl font-semibold tabular-nums",
          tone === "good" && "text-emerald-600 dark:text-emerald-400",
          tone === "warn" && "text-amber-600 dark:text-amber-400",
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function LineLegend({ includeRealized = false }: { includeRealized?: boolean }) {
  const items = [
    ["Quant Engine", COLORS.quant],
    ["LLM recommendation", COLORS.llm],
    ["Independent ML", COLORS.ml],
  ];
  if (includeRealized) {
    items.push(["Realized", COLORS.realized]);
  }
  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
      {items.map(([label, color]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ backgroundColor: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}

function PredictionHistory({
  rows,
  tenor,
  validations,
  pair,
}: {
  rows: MLMultiplierPrediction[];
  tenor: keyof TrendAwareMultiplierMap;
  validations: ValidationRun[];
  pair: string;
}) {
  const validationByDate = canonicalValidationByDate(validations, pair);
  const data = rows
    .filter((row) => row.tenor_key === tenor)
    .sort((left, right) => left.as_of_date.localeCompare(right.as_of_date))
    .map((row) => ({
      date: row.as_of_date,
      quant: row.quant_multiplier,
      llm:
        validationByDate.get(row.as_of_date)?.result
          .llm_recommended_trend_aware_multipliers[tenor] ?? null,
      ml: row.ml_multiplier,
    }));
  return (
    <section className="rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Multiplier history · {tenorLabel(tenor)}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Daily Quant Engine, canonical LLM recommendation, and independent ML estimate
          </p>
        </div>
        <LineLegend />
      </div>
      <div className="mt-4 h-[290px] min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={data} margin={{ top: 8, right: 14, left: 2, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => formatDate(String(value))}
              tickLine={false}
              axisLine={false}
              minTickGap={38}
              tick={AXIS_TICK_STYLE}
              tickMargin={7}
            />
            <YAxis
              domain={["auto", "auto"]}
              tickFormatter={(value) => `${Number(value).toFixed(2)}x`}
              tickLine={false}
              axisLine={false}
              width={46}
              tick={AXIS_TICK_STYLE}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelStyle={{ fontSize: 10 }}
              itemStyle={{ fontSize: 11 }}
              labelFormatter={(value) => formatDate(String(value))}
              formatter={(value, name) => [
                formatMultiplier(Number(value)),
                name === "quant"
                  ? "Quant Engine"
                  : name === "llm"
                    ? "LLM recommendation"
                    : "Independent ML",
              ]}
            />
            <Line
              dataKey="quant"
              stroke={COLORS.quant}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
            />
            <Line
              dataKey="llm"
              stroke={COLORS.llm}
              strokeWidth={1.9}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
            />
            <Line
              dataKey="ml"
              stroke={COLORS.ml}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function MaturedHistory({
  rows,
  tenor,
  llmRows,
}: {
  rows: MLMultiplierBenchmarkResult[];
  tenor: keyof TrendAwareMultiplierMap;
  llmRows: BenchmarkResult[];
}) {
  const llmByKey = new Map(llmRows.map((row) => [benchmarkKey(row), row]));
  const data = rows
    .filter((row) => row.tenor_key === tenor)
    .sort((left, right) => left.as_of_date.localeCompare(right.as_of_date))
    .map((row) => ({
      date: row.as_of_date,
      quant: row.quant_implied_vol,
      llm: llmByKey.get(benchmarkKey(row))?.llm_implied_vol ?? null,
      ml: row.ml_implied_vol,
      realized: row.realized_vol,
    }));
  return (
    <section className="rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">
            Matured forecast check · {tenorLabel(tenor)}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Tenor-matched implied volatility compared with what subsequently occurred
          </p>
        </div>
        <LineLegend includeRealized />
      </div>
      {data.length ? (
        <div className="mt-4 h-[290px] min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={data} margin={{ top: 8, right: 14, left: 2, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => formatDate(String(value))}
                tickLine={false}
                axisLine={false}
                minTickGap={38}
                tick={AXIS_TICK_STYLE}
                tickMargin={7}
              />
              <YAxis
                tickFormatter={(value) => pct(Number(value), 0)}
                tickLine={false}
                axisLine={false}
                width={46}
                tick={AXIS_TICK_STYLE}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ fontSize: 10 }}
                itemStyle={{ fontSize: 11 }}
                labelFormatter={(value) => formatDate(String(value))}
                formatter={(value, name) => [
                  formatVol(Number(value)),
                  name === "quant"
                    ? "Quant Engine"
                    : name === "llm"
                      ? "LLM recommendation"
                    : name === "ml"
                      ? "Independent ML"
                      : "Realized",
                ]}
              />
              <Line dataKey="quant" stroke={COLORS.quant} strokeWidth={1.8} dot={false} />
              <Line
                dataKey="llm"
                stroke={COLORS.llm}
                strokeWidth={1.8}
                strokeDasharray="5 4"
                dot={false}
                connectNulls
              />
              <Line dataKey="ml" stroke={COLORS.ml} strokeWidth={1.8} dot={false} />
              <Line
                dataKey="realized"
                stroke={COLORS.realized}
                strokeWidth={2.2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState
          className="mt-4 h-[290px]"
          title="This tenor has not matured yet"
          description="The evaluator will add realized outcomes after the full forward window is observable."
        />
      )}
    </section>
  );
}

function rollingMean(values: number[], window: number) {
  return values.map((_, index) => {
    const start = Math.max(0, index - window + 1);
    const sample = values.slice(start, index + 1);
    return sample.reduce((sum, value) => sum + value, 0) / sample.length;
  });
}

function rollingOptionalMean(values: (number | null)[], window: number) {
  return values.map((_, index) => {
    const start = Math.max(0, index - window + 1);
    const sample = values
      .slice(start, index + 1)
      .filter((value): value is number => value != null);
    return sample.length
      ? sample.reduce((sum, value) => sum + value, 0) / sample.length
      : null;
  });
}

function RollingDiagnostics({
  rows,
  tenor,
  llmRows,
}: {
  rows: MLMultiplierBenchmarkResult[];
  tenor: keyof TrendAwareMultiplierMap;
  llmRows: BenchmarkResult[];
}) {
  const llmByKey = new Map(llmRows.map((row) => [benchmarkKey(row), row]));
  const matured = rows
    .filter((row) => row.tenor_key === tenor)
    .sort((left, right) => left.evaluation_market_date.localeCompare(right.evaluation_market_date));
  const quantMae = rollingMean(
    matured.map((row) => row.quant_abs_error),
    12,
  );
  const mlMae = rollingMean(
    matured.map((row) => row.ml_abs_error),
    12,
  );
  const llmMae = rollingOptionalMean(
    matured.map((row) => llmByKey.get(benchmarkKey(row))?.llm_abs_error ?? null),
    12,
  );
  const quantUndercoverage = rollingMean(
    matured.map((row) => (row.quant_undercovered ? 1 : 0)),
    12,
  );
  const mlUndercoverage = rollingMean(
    matured.map((row) => (row.ml_undercovered ? 1 : 0)),
    12,
  );
  const llmUndercoverage = rollingOptionalMean(
    matured.map((row) => {
      const matched = llmByKey.get(benchmarkKey(row));
      return matched == null ? null : matched.llm_undercovered ? 1 : 0;
    }),
    12,
  );
  const data = matured.map((row, index) => ({
    date: row.evaluation_market_date,
    quantMae: quantMae[index],
    llmMae: llmMae[index],
    mlMae: mlMae[index],
    quantUndercoverage: quantUndercoverage[index],
    llmUndercoverage: llmUndercoverage[index],
    mlUndercoverage: mlUndercoverage[index],
  }));
  const latest = data[data.length - 1];

  if (!data.length) {
    return null;
  }

  return (
    <section className="rounded-lg border">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">
            Rolling forecast diagnostics · {tenorLabel(tenor)}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Twelve matured observations per point; lower is better in both panels
          </p>
        </div>
        <LineLegend />
        <div className="flex flex-wrap gap-5 text-xs">
          <div>
            <div className="uppercase text-muted-foreground">Latest ML MAE</div>
            <div className="mt-0.5 font-mono font-semibold">
              {formatVol(latest.mlMae)}
            </div>
          </div>
          <div>
            <div className="uppercase text-muted-foreground">ML undercoverage</div>
            <div className="mt-0.5 font-mono font-semibold">
              {pct(latest.mlUndercoverage)}
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 divide-y xl:grid-cols-2 xl:divide-x xl:divide-y-0">
        <div className="p-4">
          <div className="mb-3">
            <div className="text-xs font-medium">Rolling absolute forecast error</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              Distance between implied and subsequently realized volatility
            </div>
          </div>
          <div className="h-[250px] min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={data} margin={{ top: 6, right: 12, left: 2, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => formatDate(String(value))}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={36}
                  tick={AXIS_TICK_STYLE}
                  tickMargin={7}
                />
                <YAxis
                  tickFormatter={(value) => pct(Number(value), 0)}
                  tickLine={false}
                  axisLine={false}
                  width={42}
                  tick={AXIS_TICK_STYLE}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ fontSize: 10 }}
                  itemStyle={{ fontSize: 11 }}
                  labelFormatter={(value) => formatDate(String(value))}
                  formatter={(value, name) => [
                    formatVol(Number(value)),
                    name === "quantMae"
                      ? "Quant Engine MAE"
                      : name === "llmMae"
                        ? "LLM recommendation MAE"
                        : "Independent ML MAE",
                  ]}
                />
                <Line
                  dataKey="quantMae"
                  stroke={COLORS.quant}
                  strokeWidth={1.8}
                  dot={false}
                />
                <Line
                  dataKey="llmMae"
                  stroke={COLORS.llm}
                  strokeWidth={1.8}
                  strokeDasharray="5 4"
                  dot={false}
                  connectNulls
                />
                <Line dataKey="mlMae" stroke={COLORS.ml} strokeWidth={2.2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="p-4">
          <div className="mb-3">
            <div className="text-xs font-medium">Rolling undercoverage rate</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              Share of forecasts below realized volatility; zero is ideal
            </div>
          </div>
          <div className="h-[250px] min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={data} margin={{ top: 6, right: 12, left: 2, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => formatDate(String(value))}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={36}
                  tick={AXIS_TICK_STYLE}
                  tickMargin={7}
                />
                <YAxis
                  domain={[0, 1]}
                  tickFormatter={(value) => pct(Number(value), 0)}
                  tickLine={false}
                  axisLine={false}
                  width={42}
                  tick={AXIS_TICK_STYLE}
                />
                <ReferenceLine
                  y={0.5}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="3 3"
                  strokeOpacity={0.35}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ fontSize: 10 }}
                  itemStyle={{ fontSize: 11 }}
                  labelFormatter={(value) => formatDate(String(value))}
                  formatter={(value, name) => [
                    pct(Number(value)),
                    name === "quantUndercoverage"
                      ? "Quant Engine undercoverage"
                      : name === "llmUndercoverage"
                        ? "LLM recommendation undercoverage"
                        : "Independent ML undercoverage",
                  ]}
                />
                <Line
                  dataKey="quantUndercoverage"
                  stroke={COLORS.quant}
                  strokeWidth={1.8}
                  dot={false}
                />
                <Line
                  dataKey="llmUndercoverage"
                  stroke={COLORS.llm}
                  strokeWidth={1.8}
                  strokeDasharray="5 4"
                  dot={false}
                  connectNulls
                />
                <Line
                  dataKey="mlUndercoverage"
                  stroke={COLORS.ml}
                  strokeWidth={2.2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}

export function MLMultiplierLab({
  data,
  validations,
  llmBenchmarks,
}: {
  data: MLMultiplierLabResponse;
  validations: ValidationRun[];
  llmBenchmarks: BenchmarkResult[];
}) {
  const searchParams = useSearchParams();
  const pairs = React.useMemo(
    () => [...new Set(data.predictions.map((row) => row.pair_code))].sort(),
    [data.predictions],
  );
  const requestedPair = searchParams.get("pair")?.toUpperCase() ?? "";
  const [pair, setPair] = React.useState(
    pairs.includes(requestedPair)
      ? requestedPair
      : pairs.includes("USDGHS")
        ? "USDGHS"
        : pairs[0] ?? "",
  );
  const [tenor, setTenor] = React.useState<keyof TrendAwareMultiplierMap>("tenor_le_30d");
  const model = data.models.find((item) => item.status === "shadow_active") ?? data.models[0];
  const predictions = data.predictions.filter(
    (row) => row.pair_code === pair && row.model_version === model?.model_version,
  );
  const benchmarks = data.benchmarks.filter(
    (row) => row.pair_code === pair && row.model_version === model?.model_version,
  );
  const pairLLMBenchmarks = llmBenchmarks.filter((row) => row.pair_code === pair);
  const latest = latestByTenor(predictions);
  const validationByDate = canonicalValidationByDate(validations, pair);
  const latestLLM =
    validationByDate.get(latest[0]?.as_of_date)?.result
      .llm_recommended_trend_aware_multipliers ?? null;
  const quantMae =
    benchmarks.reduce((sum, row) => sum + row.quant_abs_error, 0) /
    Math.max(benchmarks.length, 1);
  const mlMae =
    benchmarks.reduce((sum, row) => sum + row.ml_abs_error, 0) /
    Math.max(benchmarks.length, 1);
  const lift = quantMae > 0 ? (quantMae - mlMae) / quantMae : 0;
  const mlWins = benchmarks.filter((row) => row.ml_abs_error < row.quant_abs_error).length;
  const pending = predictions.filter((row) => row.evaluation_status === "pending").length;
  const maxDivergence = latest.reduce(
    (maximum, row) =>
      Math.max(
        maximum,
        row.difference_vs_quant == null || row.quant_multiplier === 0
          ? 0
          : Math.abs(row.difference_vs_quant / row.quant_multiplier),
      ),
    0,
  );

  if (!model || !predictions.length) {
    return (
      <EmptyState
        title="ML shadow data is not available"
        description="Apply the ML multiplier migration and let the calculation flow publish its first six-tenor shadow ladder."
      />
    );
  }

  const gatePassed = model.gate_report.official_promotion_eligible === true;

  return (
    <div className="space-y-5">
      <section className="border-b pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">{model.display_name}</h2>
              <span className="rounded border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 font-mono text-[11px] uppercase text-amber-700 dark:text-amber-300">
                Shadow only
              </span>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              The official Quant Engine, canonical LLM overlay, and independently learned
              multiplier estimate are monitored together. Neither challenger overwrites
              deterministic output or can self-promote.
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={pair} onValueChange={setPair}>
              <SelectTrigger className="w-36 rounded-md border bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pairs.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value.slice(0, 3)}/{value.slice(3)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={tenor}
              onValueChange={(value) => setTenor(value as keyof TrendAwareMultiplierMap)}
            >
              <SelectTrigger className="w-32 rounded-md border bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TENORS.map((item) => (
                  <SelectItem key={item.key} value={item.key}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <LabMetric
            label="Model status"
            value="Active shadow"
            hint={model.model_version}
            tone="warn"
          />
          <LabMetric
            label="Matured rows"
            value={benchmarks.length.toLocaleString()}
            hint={`${pending.toLocaleString()} pair-tenors pending`}
          />
          <LabMetric
            label="Quant MAE"
            value={formatVol(quantMae)}
            hint="Official forecast error"
          />
          <LabMetric
            label="ML MAE"
            value={formatVol(mlMae)}
            hint="Shadow forecast error"
            tone={mlMae < quantMae ? "good" : "warn"}
          />
          <LabMetric
            label="MAE reduction"
            value={signedPct(lift)}
            hint={`${mlWins}/${benchmarks.length} matured rows won`}
            tone={lift > 0 ? "good" : "warn"}
          />
          <LabMetric
            label="Latest divergence"
            value={pct(maxDivergence)}
            hint="Largest tenor gap today"
            tone={maxDivergence > 0.15 ? "warn" : undefined}
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">Latest six-tenor ladder</h3>
            <p className="text-xs text-muted-foreground">
              {pair.slice(0, 3)}/{pair.slice(3)} · as of {formatDate(latest[0]?.as_of_date)}
            </p>
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            Quant remains official
          </span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenor</TableHead>
              <TableHead className="text-right">Quant Engine</TableHead>
              <TableHead className="text-right">LLM recommendation</TableHead>
              <TableHead className="text-right">Independent ML</TableHead>
              <TableHead className="text-right">ML vs Quant</TableHead>
              <TableHead className="text-right">Evaluation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {latest.map((row) => {
              const relative =
                row.difference_vs_quant == null || row.quant_multiplier === 0
                  ? null
                  : row.difference_vs_quant / row.quant_multiplier;
              return (
                <TableRow key={row.tenor_key}>
                  <TableCell className="font-mono font-medium">
                    {tenorLabel(row.tenor_key)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatMultiplier(row.quant_multiplier)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-violet-600 dark:text-violet-300">
                    {latestLLM == null
                      ? "--"
                      : formatMultiplier(latestLLM[row.tenor_key])}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {row.ml_multiplier == null ? "--" : formatMultiplier(row.ml_multiplier)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-mono",
                      relative != null && Math.abs(relative) > 0.15
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-muted-foreground",
                    )}
                  >
                    {relative == null ? "--" : signedPct(relative)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={cn(
                        "rounded border px-2 py-0.5 text-[11px] capitalize",
                        row.evaluation_status === "scored" &&
                          "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                        row.evaluation_status === "pending" &&
                          "border-border bg-muted/30 text-muted-foreground",
                        row.evaluation_status === "invalid" &&
                          "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300",
                      )}
                    >
                      {row.evaluation_status}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <PredictionHistory
          rows={predictions}
          tenor={tenor}
          validations={validations}
          pair={pair}
        />
        <MaturedHistory
          rows={benchmarks}
          tenor={tenor}
          llmRows={pairLLMBenchmarks}
        />
      </div>

      <RollingDiagnostics
        rows={benchmarks}
        tenor={tenor}
        llmRows={pairLLMBenchmarks}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-lg border p-4">
          <div className="flex items-start gap-3">
            {gatePassed ? (
              <CheckCircle2Icon className="mt-0.5 size-5 text-emerald-500" />
            ) : (
              <ShieldAlertIcon className="mt-0.5 size-5 text-amber-500" />
            )}
            <div>
              <h3 className="text-sm font-semibold">Official promotion gate</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {String(
                  model.gate_report.reason ??
                    "The active challenger remains under controlled shadow observation.",
                )}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
            <LabMetric
              label="Decision"
              value={gatePassed ? "Pass" : "Fail"}
              hint="No automatic promotion"
              tone={gatePassed ? "good" : "warn"}
            />
            <LabMetric
              label="Training rows"
              value={model.training_rows.toLocaleString()}
              hint={`${model.training_first_date} to ${model.training_last_as_of_date}`}
            />
            <LabMetric
              label="Passed segments"
              value={formatNumber(Number(model.gate_report.passed_segments ?? 0), 0)}
              hint="Rolling safety checks"
            />
            <LabMetric
              label="Failed segments"
              value={formatNumber(Number(model.gate_report.failed_segments ?? 0), 0)}
              hint="Require more evidence"
              tone="warn"
            />
          </div>
        </section>

        <section className="rounded-lg border p-4">
          <h3 className="text-sm font-semibold">Operational contract</h3>
          <div className="mt-3 space-y-3 text-sm">
            {[
              ["Daily", "Inference follows deterministic calculation."],
              ["Weekly", "Matured rows are scored after the existing benchmark job."],
              ["August", "Model and prompt are frozen; monthly retraining is disabled."],
              ["Promotion", "Finance and ML review must explicitly approve a candidate."],
            ].map(([label, body]) => (
              <div key={label} className="grid grid-cols-[72px_1fr] gap-3 border-t pt-3 first:border-0 first:pt-0">
                <span className="font-mono text-xs font-medium uppercase">{label}</span>
                <span className="text-muted-foreground">{body}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export function MLShadowOverviewPanel({ data }: { data: MLMultiplierLabResponse }) {
  const model = data.models.find((item) => item.status === "shadow_active") ?? data.models[0];
  const modelPredictions = data.predictions.filter(
    (row) => row.model_version === model?.model_version,
  );
  const latestDate = modelPredictions.reduce(
    (latest, row) => (row.as_of_date > latest ? row.as_of_date : latest),
    "",
  );
  const latest = modelPredictions.filter((row) => row.as_of_date === latestDate);
  const predicted = latest.filter((row) => row.prediction_status === "predicted");
  const largest = predicted.reduce<MLMultiplierPrediction | null>((current, row) => {
    if (!current) return row;
    return Math.abs(row.difference_vs_quant ?? 0) >
      Math.abs(current.difference_vs_quant ?? 0)
      ? row
      : current;
  }, null);
  if (!model || !latest.length) return null;
  const relative =
    largest?.difference_vs_quant != null && largest.quant_multiplier !== 0
      ? largest.difference_vs_quant / largest.quant_multiplier
      : 0;

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 border-b py-4">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-md border bg-muted/20">
          <FlaskConicalIcon className="size-4 text-emerald-500" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Independent ML multiplier shadow</h2>
            <span className="rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[10px] uppercase text-amber-700 dark:text-amber-300">
              Diagnostic
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {model.display_name} · {predicted.length}/{latest.length} latest tenors valid ·
            Quant Engine remains official
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-6">
        <div>
          <div className="text-[11px] uppercase text-muted-foreground">Largest latest gap</div>
          <div className="font-mono text-sm font-semibold">
            {largest?.pair_code ?? "--"} {largest ? tenorLabel(largest.tenor_key) : ""} ·{" "}
            {signedPct(relative)}
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/ml-multiplier">
            Open ML lab <ArrowRightIcon className="size-3.5" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
