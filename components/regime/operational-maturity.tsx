"use client";

import * as React from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  ChartTooltipRow,
  chartTooltipColor,
} from "@/components/regime/chart-tooltip-row";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectGroup,
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatDate, formatMultiplier, formatVol } from "@/lib/format";
import {
  displayPairCode,
  latestMatchedMaturityBenchmarks,
  MATURITY_RISK_CANDIDATES,
  maturityCandidateLabel,
  maturityForecastProvider,
  OPERATIONAL_MATURITY_HORIZONS,
} from "@/lib/maturity-risk";
import type {
  MaturityRiskCandidateType,
  MaturityRiskForecast,
  MaturityRiskOperationalResponse,
} from "@/lib/types";

const chartConfig = Object.fromEntries(
  MATURITY_RISK_CANDIDATES.map((candidate) => [
    candidate.key,
    { label: candidate.label, color: candidate.color },
  ]),
) as ChartConfig;

function availablePairs(rows: Array<{ pair_code: string }>) {
  return [...new Set(rows.map((row) => row.pair_code))].sort();
}

function preferredPair(pairs: string[], fixedPair?: string) {
  if (fixedPair && pairs.includes(fixedPair)) return fixedPair;
  return pairs.includes("USDGHS") ? "USDGHS" : (pairs[0] ?? "");
}

function shortDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString(
    "en-GB",
    {
      month: "short",
      day: "numeric",
    },
  );
}

function latestForecasts(
  rows: MaturityRiskForecast[],
  pair: string,
): MaturityRiskForecast[] {
  const pairRows = rows.filter((row) => row.pair_code === pair);
  const latestDate = pairRows.reduce(
    (latest, row) => (row.as_of_date > latest ? row.as_of_date : latest),
    "",
  );
  return pairRows.filter((row) => row.as_of_date === latestDate);
}

function PairSelect({
  pairs,
  value,
  onValueChange,
}: {
  pairs: string[];
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      Pair
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-36" aria-label="Currency pair">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {pairs.map((pair) => (
              <SelectItem key={pair} value={pair}>
                {displayPairCode(pair)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </label>
  );
}

function HorizonSelect({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      Horizon
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-28" aria-label="Operational horizon">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {OPERATIONAL_MATURITY_HORIZONS.map((days) => (
              <SelectItem key={days} value={String(days)}>
                {days} days
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </label>
  );
}

function HorizonStrip({
  value,
  onValueChange,
  availableHorizons,
}: {
  value: string;
  onValueChange: (value: string) => void;
  availableHorizons?: number[];
}) {
  return (
    <div className="overflow-x-auto pb-1" aria-label="Operational horizons">
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(next) => next && onValueChange(next)}
        variant="outline"
        size="sm"
        className="w-max justify-start"
      >
        {OPERATIONAL_MATURITY_HORIZONS.map((days) => (
          <ToggleGroupItem
            key={days}
            value={String(days)}
            disabled={
              availableHorizons ? !availableHorizons.includes(days) : false
            }
            className="min-w-12 font-mono"
          >
            {days}d
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

export function OperationalMaturityHistoryChart({
  forecasts,
  fixedPair,
  horizonControl = "select",
  defaultHorizon = 30,
  title = "Operational Multiplier History",
  description = "One selected maturity through time across the three benchmark candidates.",
}: {
  forecasts: MaturityRiskForecast[];
  fixedPair?: string;
  horizonControl?: "select" | "strip";
  defaultHorizon?: (typeof OPERATIONAL_MATURITY_HORIZONS)[number];
  title?: string;
  description?: string;
}) {
  const pairs = React.useMemo(() => availablePairs(forecasts), [forecasts]);
  const [selectedPair, setSelectedPair] = React.useState(() =>
    preferredPair(pairs, fixedPair),
  );
  const [horizon, setHorizon] = React.useState(String(defaultHorizon));
  const pair = preferredPair(pairs, fixedPair ?? selectedPair);
  const rows = React.useMemo(() => {
    const byDate = new Map<string, Record<string, string | number | null>>();
    const latestByKey = new Map<string, MaturityRiskForecast>();
    for (const row of forecasts) {
      if (row.pair_code !== pair || row.horizon_days !== Number(horizon))
        continue;
      const key = `${row.as_of_date}:${row.candidate_type}`;
      const current = latestByKey.get(key);
      if (!current || row.generated_at > current.generated_at)
        latestByKey.set(key, row);
    }
    for (const row of latestByKey.values()) {
      const entry = byDate.get(row.as_of_date) ?? { date: row.as_of_date };
      entry[row.candidate_type] = row.multiplier;
      byDate.set(row.as_of_date, entry);
    }
    return [...byDate.values()].sort((left, right) =>
      String(left.date).localeCompare(String(right.date)),
    );
  }, [forecasts, horizon, pair]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>
              {displayPairCode(pair)} · {description}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {!fixedPair && (
              <PairSelect
                pairs={pairs}
                value={pair}
                onValueChange={setSelectedPair}
              />
            )}
            {horizonControl === "select" && (
              <HorizonSelect value={horizon} onValueChange={setHorizon} />
            )}
          </div>
        </div>
        {horizonControl === "strip" && (
          <HorizonStrip value={horizon} onValueChange={setHorizon} />
        )}
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[320px] w-full">
          <LineChart
            data={rows}
            accessibilityLayer
            margin={{ left: 8, right: 12 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              minTickGap={36}
              tickFormatter={(value) => shortDate(String(value))}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={42}
              domain={["auto", "auto"]}
              tickFormatter={(value) => `${Number(value).toFixed(1)}x`}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => formatDate(String(value))}
                  formatter={(value, name, item) => (
                    <ChartTooltipRow
                      color={chartTooltipColor(item)}
                      label={maturityCandidateLabel(
                        name as MaturityRiskCandidateType,
                      )}
                      value={formatMultiplier(Number(value))}
                    />
                  )}
                />
              }
            />
            {MATURITY_RISK_CANDIDATES.map((candidate) => (
              <Line
                key={candidate.key}
                dataKey={candidate.key}
                name={candidate.label}
                stroke={`var(--color-${candidate.key})`}
                strokeWidth={candidate.key === "news_adjusted" ? 2.4 : 2}
                strokeDasharray={
                  candidate.key === "news_adjusted" ? "5 4" : undefined
                }
                dot={rows.length < 3 ? { r: 3 } : false}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function OperationalMaturityDecisionTable({
  forecasts,
  pair,
  preferredDate,
  showHeading = true,
}: {
  forecasts: MaturityRiskForecast[];
  pair: string;
  preferredDate?: string;
  showHeading?: boolean;
}) {
  const pairRows = forecasts.filter((row) => row.pair_code === pair);
  const latestDate = pairRows.reduce(
    (latest, row) => (row.as_of_date > latest ? row.as_of_date : latest),
    "",
  );
  const selectedDate =
    preferredDate && pairRows.some((row) => row.as_of_date === preferredDate)
      ? preferredDate
      : latestDate;
  const selectedRows = pairRows.filter(
    (row) => row.as_of_date === selectedDate,
  );
  const byHorizon = new Map<
    number,
    Map<MaturityRiskCandidateType, MaturityRiskForecast>
  >();
  for (const row of selectedRows) {
    const candidates = byHorizon.get(row.horizon_days) ?? new Map();
    candidates.set(row.candidate_type, row);
    byHorizon.set(row.horizon_days, candidates);
  }

  return (
    <section className="flex flex-col gap-3">
      {showHeading && (
        <div>
          <h3 className="text-sm font-semibold">
            Operational exact-maturity checkpoints
          </h3>
          <p className="text-xs text-muted-foreground">
            {displayPairCode(pair)} · {formatDate(selectedDate)} · all 14
            serving horizons
          </p>
        </div>
      )}
      <div className="overflow-x-auto rounded-md border">
        <Table className="min-w-[680px]">
          <TableHeader>
            <TableRow>
              <TableHead>Horizon</TableHead>
              {MATURITY_RISK_CANDIDATES.map((candidate) => (
                <TableHead key={candidate.key} className="text-right">
                  {candidate.label}
                </TableHead>
              ))}
              <TableHead className="text-right">Base vol</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {OPERATIONAL_MATURITY_HORIZONS.map((days) => {
              const candidates = byHorizon.get(days);
              const baseVol = candidates?.get("rule_based")?.base_vol;
              return (
                <TableRow key={days}>
                  <TableCell className="font-mono font-medium">
                    {days}d
                  </TableCell>
                  {MATURITY_RISK_CANDIDATES.map((candidate) => (
                    <TableCell
                      key={candidate.key}
                      className="text-right font-mono tabular-nums"
                    >
                      {formatMultiplier(
                        candidates?.get(candidate.key)?.multiplier,
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatVol(baseVol)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

export function OperationalMaturityLadder({
  forecasts,
  fixedPair,
}: {
  forecasts: MaturityRiskForecast[];
  fixedPair?: string;
}) {
  const pairs = React.useMemo(() => availablePairs(forecasts), [forecasts]);
  const [selectedPair, setSelectedPair] = React.useState(() =>
    preferredPair(pairs, fixedPair),
  );
  const pair = preferredPair(pairs, fixedPair ?? selectedPair);
  const latest = React.useMemo(
    () => latestForecasts(forecasts, pair),
    [forecasts, pair],
  );
  const latestDate = latest[0]?.as_of_date ?? "";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle>Operational Maturity Ladder</CardTitle>
          <CardDescription>
            {displayPairCode(pair)} · {formatDate(latestDate)} · all 14 serving
            checkpoints
          </CardDescription>
        </div>
        {!fixedPair && (
          <PairSelect
            pairs={pairs}
            value={pair}
            onValueChange={setSelectedPair}
          />
        )}
      </CardHeader>
      <CardContent>
        <OperationalMaturityDecisionTable
          forecasts={forecasts}
          pair={pair}
          preferredDate={latestDate}
          showHeading={false}
        />
      </CardContent>
    </Card>
  );
}

function average(values: number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

export function OperationalMaturityPerformance({
  data,
}: {
  data: MaturityRiskOperationalResponse;
}) {
  const pairs = React.useMemo(
    () => availablePairs(data.benchmarks),
    [data.benchmarks],
  );
  const [selectedPair, setSelectedPair] = React.useState(() =>
    preferredPair(pairs),
  );
  const [selectedHorizon, setSelectedHorizon] = React.useState(
    String(OPERATIONAL_MATURITY_HORIZONS[0]),
  );
  const pair = preferredPair(pairs, selectedPair);
  const forecastById = React.useMemo(
    () => new Map(data.forecasts.map((row) => [row.id, row])),
    [data.forecasts],
  );
  const cohortRows = React.useMemo(() => {
    const pairRows = data.benchmarks.filter((row) => row.pair_code === pair);
    const latest = [...pairRows].sort((left, right) =>
      right.evaluated_at.localeCompare(left.evaluated_at),
    )[0];
    const provider = maturityForecastProvider(
      latest ? forecastById.get(latest.forecast_id) : undefined,
    );
    const providerRows = pairRows.filter(
      (row) =>
        maturityForecastProvider(forecastById.get(row.forecast_id)) ===
        provider,
    );
    const surface = [...providerRows].sort((left, right) =>
      right.evaluated_at.localeCompare(left.evaluated_at),
    )[0]?.surface_version;
    return latestMatchedMaturityBenchmarks(
      providerRows.filter((row) => row.surface_version === surface),
    );
  }, [data.benchmarks, forecastById, pair]);
  const availableHorizons = React.useMemo(
    () =>
      OPERATIONAL_MATURITY_HORIZONS.filter((days) =>
        cohortRows.some((row) => row.horizon_days === days),
      ),
    [cohortRows],
  );
  const horizon = availableHorizons.some(
    (days) => days === Number(selectedHorizon),
  )
    ? Number(selectedHorizon)
    : (availableHorizons[0] ?? OPERATIONAL_MATURITY_HORIZONS[0]);
  const selectedRows = React.useMemo(
    () => cohortRows.filter((row) => row.horizon_days === horizon),
    [cohortRows, horizon],
  );
  const history = React.useMemo(() => {
    const byDate = new Map<string, Record<string, string | number | null>>();
    for (const row of selectedRows) {
      const entry = byDate.get(row.evaluation_market_date) ?? {
        date: row.evaluation_market_date,
        realized_vol: row.realized_vol,
      };
      entry[row.candidate_type] = row.forecast_implied_vol;
      byDate.set(row.evaluation_market_date, entry);
    }
    return [...byDate.values()].sort((left, right) =>
      String(left.date).localeCompare(String(right.date)),
    );
  }, [selectedRows]);
  const performanceConfig = {
    ...chartConfig,
    realized_vol: { label: "Realized volatility", color: "var(--chart-4)" },
  } satisfies ChartConfig;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-1">
              <CardTitle>Operational Maturity Performance</CardTitle>
              <CardDescription>
                Complete matched pair/date/horizon outcomes across
                serving-version changes. Disabled horizons have not reached a
                comparable calendar maturity yet.
              </CardDescription>
            </div>
            <PairSelect
              pairs={pairs}
              value={pair}
              onValueChange={setSelectedPair}
            />
          </div>
          <HorizonStrip
            value={String(horizon)}
            onValueChange={setSelectedHorizon}
            availableHorizons={availableHorizons}
          />
        </CardHeader>
        <CardContent>
          {history.length ? (
            <ChartContainer
              config={performanceConfig}
              className="h-[320px] w-full"
            >
              <LineChart
                data={history}
                accessibilityLayer
                margin={{ left: 8, right: 12 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={36}
                  tickFormatter={(value) => shortDate(String(value))}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tickFormatter={(value) => formatVol(Number(value), 0)}
                />
                <ChartLegend content={<ChartLegendContent />} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) => formatDate(String(value))}
                      formatter={(value, name, item) => (
                        <ChartTooltipRow
                          color={chartTooltipColor(item)}
                          label={
                            name === "realized_vol"
                              ? "Realized volatility"
                              : maturityCandidateLabel(
                                  name as MaturityRiskCandidateType,
                                )
                          }
                          value={formatVol(Number(value))}
                        />
                      )}
                    />
                  }
                />
                {MATURITY_RISK_CANDIDATES.map((candidate) => (
                  <Line
                    key={candidate.key}
                    dataKey={candidate.key}
                    name={candidate.label}
                    stroke={`var(--color-${candidate.key})`}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
                <Line
                  dataKey="realized_vol"
                  name="Realized volatility"
                  stroke="var(--color-realized_vol)"
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              </LineChart>
            </ChartContainer>
          ) : (
            <div className="flex h-[220px] items-center justify-center border-y px-4 text-center text-sm text-muted-foreground">
              This horizon has not produced a complete matched maturity yet.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>MAE by Operational Horizon</CardTitle>
          <CardDescription>
            Mean absolute volatility error for {displayPairCode(pair)} on
            complete matched outcomes; candidate versions remain attached to
            each scored observation.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Horizon</TableHead>
                  {MATURITY_RISK_CANDIDATES.map((candidate) => (
                    <TableHead key={candidate.key}>{candidate.label}</TableHead>
                  ))}
                  <TableHead>Scored forecasts</TableHead>
                  <TableHead>Matured dates</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {OPERATIONAL_MATURITY_HORIZONS.map((days) => {
                  const rows = cohortRows.filter(
                    (row) => row.horizon_days === days,
                  );
                  const maturedDates = new Set(
                    rows.map((row) => row.as_of_date),
                  ).size;
                  return (
                    <TableRow key={days}>
                      <TableCell className="font-mono font-medium">
                        {days}d
                      </TableCell>
                      {MATURITY_RISK_CANDIDATES.map((candidate) => (
                        <TableCell
                          key={candidate.key}
                          className="font-mono tabular-nums"
                        >
                          {formatVol(
                            average(
                              rows
                                .filter(
                                  (row) => row.candidate_type === candidate.key,
                                )
                                .map((row) => row.abs_error),
                            ),
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="font-mono tabular-nums">
                        {rows.length}
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {maturedDates || "--"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
