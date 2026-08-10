"use client";

import * as React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";

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
import { formatDate, formatMultiplier, formatVol } from "@/lib/format";
import {
  displayPairCode,
  MATURITY_RISK_CANDIDATES,
  maturityCandidateLabel,
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
  return pairs.includes("USDGHS") ? "USDGHS" : pairs[0] ?? "";
}

function shortDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "short",
    day: "numeric",
  });
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

export function OperationalMaturityHistoryChart({
  forecasts,
  fixedPair,
  title = "Operational Multiplier History",
  description = "One selected maturity through time across the three benchmark candidates.",
}: {
  forecasts: MaturityRiskForecast[];
  fixedPair?: string;
  title?: string;
  description?: string;
}) {
  const pairs = React.useMemo(() => availablePairs(forecasts), [forecasts]);
  const [selectedPair, setSelectedPair] = React.useState(() => preferredPair(pairs, fixedPair));
  const [horizon, setHorizon] = React.useState("30");
  const pair = preferredPair(pairs, fixedPair ?? selectedPair);
  const rows = React.useMemo(() => {
    const byDate = new Map<string, Record<string, string | number | null>>();
    const latestByKey = new Map<string, MaturityRiskForecast>();
    for (const row of forecasts) {
      if (row.pair_code !== pair || row.horizon_days !== Number(horizon)) continue;
      const key = `${row.as_of_date}:${row.candidate_type}`;
      const current = latestByKey.get(key);
      if (!current || row.generated_at > current.generated_at) latestByKey.set(key, row);
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
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            {displayPairCode(pair)} · {description}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {!fixedPair && (
            <PairSelect pairs={pairs} value={pair} onValueChange={setSelectedPair} />
          )}
          <HorizonSelect value={horizon} onValueChange={setHorizon} />
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[320px] w-full">
          <LineChart data={rows} accessibilityLayer margin={{ left: 8, right: 12 }}>
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
                      label={maturityCandidateLabel(name as MaturityRiskCandidateType)}
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
                strokeDasharray={candidate.key === "news_adjusted" ? "5 4" : undefined}
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

export function OperationalMaturityLadder({
  forecasts,
  fixedPair,
}: {
  forecasts: MaturityRiskForecast[];
  fixedPair?: string;
}) {
  const pairs = React.useMemo(() => availablePairs(forecasts), [forecasts]);
  const [selectedPair, setSelectedPair] = React.useState(() => preferredPair(pairs, fixedPair));
  const pair = preferredPair(pairs, fixedPair ?? selectedPair);
  const latest = React.useMemo(() => latestForecasts(forecasts, pair), [forecasts, pair]);
  const latestDate = latest[0]?.as_of_date ?? "";
  const byHorizon = React.useMemo(() => {
    const index = new Map<number, Map<MaturityRiskCandidateType, MaturityRiskForecast>>();
    for (const row of latest) {
      const candidates = index.get(row.horizon_days) ?? new Map();
      candidates.set(row.candidate_type, row);
      index.set(row.horizon_days, candidates);
    }
    return index;
  }, [latest]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle>Operational Maturity Ladder</CardTitle>
          <CardDescription>
            {displayPairCode(pair)} · {formatDate(latestDate)} · all 14 serving checkpoints
          </CardDescription>
        </div>
        {!fixedPair && (
          <PairSelect pairs={pairs} value={pair} onValueChange={setSelectedPair} />
        )}
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
                <TableHead>Base vol</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {OPERATIONAL_MATURITY_HORIZONS.map((days) => {
                const candidates = byHorizon.get(days);
                const baseVol = candidates?.get("rule_based")?.base_vol;
                return (
                  <TableRow key={days}>
                    <TableCell className="font-mono font-medium">{days}d</TableCell>
                    {MATURITY_RISK_CANDIDATES.map((candidate) => (
                      <TableCell key={candidate.key} className="font-mono tabular-nums">
                        {formatMultiplier(candidates?.get(candidate.key)?.multiplier)}
                      </TableCell>
                    ))}
                    <TableCell className="font-mono tabular-nums">
                      {formatVol(baseVol)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function OperationalMaturityPerformance({
  data,
}: {
  data: MaturityRiskOperationalResponse;
}) {
  const pairs = React.useMemo(() => availablePairs(data.benchmarks), [data.benchmarks]);
  const [selectedPair, setSelectedPair] = React.useState(() => preferredPair(pairs));
  const [horizon, setHorizon] = React.useState("30");
  const pair = preferredPair(pairs, selectedPair);
  const selectedRows = React.useMemo(
    () =>
      data.benchmarks.filter(
        (row) => row.pair_code === pair && row.horizon_days === Number(horizon),
      ),
    [data.benchmarks, horizon, pair],
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
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle>Operational Maturity Performance</CardTitle>
            <CardDescription>
              Equal-horizon forecasts versus realized volatility for one serving checkpoint.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <PairSelect pairs={pairs} value={pair} onValueChange={setSelectedPair} />
            <HorizonSelect value={horizon} onValueChange={setHorizon} />
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={performanceConfig} className="h-[320px] w-full">
            <LineChart data={history} accessibilityLayer margin={{ left: 8, right: 12 }}>
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
                            : maturityCandidateLabel(name as MaturityRiskCandidateType)
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
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>MAE by Operational Horizon</CardTitle>
          <CardDescription>
            Mean absolute volatility error for {displayPairCode(pair)}; lower is better.
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
                  <TableHead>Matured rows</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {OPERATIONAL_MATURITY_HORIZONS.map((days) => {
                  const rows = data.benchmarks.filter(
                    (row) => row.pair_code === pair && row.horizon_days === days,
                  );
                  return (
                    <TableRow key={days}>
                      <TableCell className="font-mono font-medium">{days}d</TableCell>
                      {MATURITY_RISK_CANDIDATES.map((candidate) => (
                        <TableCell key={candidate.key} className="font-mono tabular-nums">
                          {formatVol(
                            average(
                              rows
                                .filter((row) => row.candidate_type === candidate.key)
                                .map((row) => row.abs_error),
                            ),
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="font-mono tabular-nums">{rows.length}</TableCell>
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
