"use client";

import * as React from "react";
import {
  type ColumnDef,
  type PaginationState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  ActivityIcon,
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  FlaskConicalIcon,
  ShieldCheckIcon,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";

import { TablePagination } from "@/components/regime/table-pagination";
import {
  ChartTooltipRow,
  chartTooltipColor,
} from "@/components/regime/chart-tooltip-row";
import { Badge } from "@/components/ui/badge";
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
import { formatDate, formatNumber } from "@/lib/format";
import {
  MATURITY_RISK_CANDIDATES,
  maturityCandidateLabel,
  OPERATIONAL_MATURITY_HORIZONS,
} from "@/lib/maturity-risk";
import { cn } from "@/lib/utils";
import type {
  MaturityRiskBenchmarkResult,
  MaturityRiskCandidateType,
  MaturityRiskLabResponse,
} from "@/lib/types";

const chartConfig = {
  rule_based: { label: "Rule-based", color: "var(--chart-1)" },
  historical_ml: { label: "Historical ML", color: "var(--chart-2)" },
  news_adjusted: { label: "LLM recommendation", color: "var(--chart-3)" },
  realized_vol: { label: "Realized", color: "var(--chart-4)" },
} satisfies ChartConfig;

function percentage(value: number) {
  return `${formatNumber(value * 100, 2)}%`;
}

function SortHeader({
  label,
  sorted,
  onClick,
}: {
  label: string;
  sorted: false | "asc" | "desc";
  onClick: (event?: unknown) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 whitespace-nowrap text-xs font-medium",
        "text-muted-foreground transition-colors hover:text-foreground",
      )}
    >
      {label}
      {sorted === "asc" ? (
        <ArrowUpIcon className="size-3" />
      ) : sorted === "desc" ? (
        <ArrowDownIcon className="size-3" />
      ) : (
        <ArrowUpDownIcon className="size-3 opacity-40" />
      )}
    </button>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 border-l pl-4 first:border-l-0 first:pl-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="truncate font-mono text-lg font-semibold tabular-nums">{value}</span>
      <span className="truncate text-xs text-muted-foreground">{hint}</span>
    </div>
  );
}

export function MaturityRiskLab({ data }: { data: MaturityRiskLabResponse }) {
  const { forecasts, benchmarks, policies } = data;
  const pairs = React.useMemo(
    () => [...new Set(forecasts.map((row) => row.pair_code))].sort(),
    [forecasts],
  );
  const [pair, setPair] = React.useState(
    pairs.includes("USDGHS") ? "USDGHS" : (pairs[0] ?? "USDGHS"),
  );
  const [horizon, setHorizon] = React.useState("30");
  const [candidate, setCandidate] = React.useState("all");
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "evaluation_market_date", desc: true },
  ]);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const forecastsByPair = React.useMemo(() => {
    const index = new Map<string, typeof forecasts>();
    for (const row of forecasts) {
      const rows = index.get(row.pair_code);
      if (rows) rows.push(row);
      else index.set(row.pair_code, [row]);
    }
    return index;
  }, [forecasts]);
  const benchmarksByPairHorizon = React.useMemo(() => {
    const index = new Map<string, typeof benchmarks>();
    for (const row of benchmarks) {
      const key = `${row.pair_code}:${row.horizon_days}`;
      const rows = index.get(key);
      if (rows) rows.push(row);
      else index.set(key, [row]);
    }
    return index;
  }, [benchmarks]);
  const pairForecasts = React.useMemo(
    () => forecastsByPair.get(pair) ?? [],
    [forecastsByPair, pair],
  );
  const latestDate = React.useMemo(
    () =>
      pairForecasts.reduce(
        (latest, row) => (row.as_of_date > latest ? row.as_of_date : latest),
        "",
      ),
    [pairForecasts],
  );
  const latestSurface = React.useMemo(
    () => pairForecasts.filter((row) => row.as_of_date === latestDate),
    [latestDate, pairForecasts],
  );
  const latestByHorizon = React.useMemo(() => {
    const index = new Map<number, Map<MaturityRiskCandidateType, (typeof latestSurface)[number]>>();
    for (const row of latestSurface) {
      const entries = index.get(row.horizon_days);
      if (entries) entries.set(row.candidate_type, row);
      else index.set(row.horizon_days, new Map([[row.candidate_type, row]]));
    }
    return index;
  }, [latestSurface]);
  const surfaceChart = React.useMemo(
    () =>
      OPERATIONAL_MATURITY_HORIZONS.map((days) => {
        const entries = latestByHorizon.get(days);
        return {
          horizon: `${days}d`,
          days,
          rule_based: entries?.get("rule_based")?.multiplier,
          historical_ml: entries?.get("historical_ml")?.multiplier,
          news_adjusted: entries?.get("news_adjusted")?.multiplier,
        };
      }),
    [latestByHorizon],
  );
  const impliedChart = React.useMemo(
    () =>
      OPERATIONAL_MATURITY_HORIZONS.map((days) => {
        const entries = latestByHorizon.get(days);
        return {
          horizon: `${days}d`,
          rule_based: entries?.get("rule_based")?.implied_vol,
          historical_ml: entries?.get("historical_ml")?.implied_vol,
          news_adjusted: entries?.get("news_adjusted")?.implied_vol,
        };
      }),
    [latestByHorizon],
  );

  const horizonBenchmarkRows = React.useMemo(
    () => benchmarksByPairHorizon.get(`${pair}:${Number(horizon)}`) ?? [],
    [benchmarksByPairHorizon, horizon, pair],
  );
  const benchmarkRows = React.useMemo(
    () =>
      horizonBenchmarkRows.filter(
        (row) => candidate === "all" || row.candidate_type === candidate,
      ),
    [candidate, horizonBenchmarkRows],
  );
  const candidateStats = React.useMemo(
    () =>
      MATURITY_RISK_CANDIDATES.map((candidateItem) => {
        const rows = horizonBenchmarkRows.filter(
          (row) => row.candidate_type === candidateItem.key,
        );
        const mae = rows.length
          ? rows.reduce((sum, row) => sum + row.abs_error, 0) / rows.length
          : null;
        const undercoverage = rows.length
          ? rows.filter((row) => row.undercovered).length / rows.length
          : null;
        return { ...candidateItem, rows: rows.length, mae, undercoverage };
      }),
    [horizonBenchmarkRows],
  );
  const currentPolicy = React.useMemo(
    () => policies.find((policy) => policy.status !== "retired"),
    [policies],
  );

  const columns = React.useMemo<ColumnDef<MaturityRiskBenchmarkResult>[]>(
    () => [
      {
        accessorKey: "evaluation_market_date",
        header: ({ column }) => (
          <SortHeader
            label="Evaluated"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">{formatDate(row.original.evaluation_market_date)}</span>
        ),
      },
      {
        accessorKey: "candidate_type",
        header: ({ column }) => (
          <SortHeader
            label="Candidate"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
        cell: ({ row }) => <Badge variant="outline">{maturityCandidateLabel(row.original.candidate_type)}</Badge>,
      },
      {
        accessorKey: "forecast_implied_vol",
        header: ({ column }) => (
          <SortHeader
            label="Forecast vol"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono">{percentage(row.original.forecast_implied_vol)}</span>
        ),
      },
      {
        accessorKey: "realized_vol",
        header: ({ column }) => (
          <SortHeader
            label="Realized vol"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
        cell: ({ row }) => <span className="font-mono">{percentage(row.original.realized_vol)}</span>,
      },
      {
        accessorKey: "abs_error",
        header: ({ column }) => (
          <SortHeader
            label="Absolute error"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
        cell: ({ row }) => <span className="font-mono">{percentage(row.original.abs_error)}</span>,
      },
      {
        accessorKey: "max_abs_log_return",
        header: ({ column }) => (
          <SortHeader
            label="Peak path move"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono">
            {percentage(row.original.max_abs_log_return)} · d{row.original.max_abs_move_day}
          </span>
        ),
      },
      {
        accessorKey: "undercovered",
        header: ({ column }) => (
          <SortHeader
            label="Coverage"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
        cell: ({ row }) => (
          <Badge variant={row.original.undercovered ? "destructive" : "secondary"}>
            {row.original.undercovered ? "Under" : "Covered"}
          </Badge>
        ),
      },
    ],
    [],
  );
  const table = useReactTable({
    data: benchmarkRows,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  React.useEffect(
    () => setPagination((state) => ({ ...state, pageIndex: 0 })),
    [pair, horizon, candidate],
  );

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <FlaskConicalIcon />
              <CardTitle>Frozen V2 experiment</CardTitle>
              <Badge variant="secondary">Benchmark only</Badge>
            </div>
            <CardDescription>
              Rule-based, historical ML, and LLM recommendation surfaces are scored independently. No
              candidate is promoted automatically.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Select value={pair} onValueChange={setPair}>
              <SelectTrigger className="w-36" aria-label="Currency pair">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {pairs.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value.slice(0, 3)}/{value.slice(3)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Metric
            label="Surface date"
            value={formatDate(latestDate)}
            hint={`${latestByHorizon.size} exact horizons available`}
          />
          <Metric label="Matured rows" value={benchmarks.length.toLocaleString()} hint="All pairs and candidates" />
          <Metric label="Policy" value={currentPolicy?.status ?? "Not loaded"} hint={currentPolicy?.policy_version ?? "Migration required"} />
          <Metric label="External serving" value="Disabled" hint="Manual promotion gate" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Multiplier surface</CardTitle>
            <CardDescription>The concise 14-horizon operating view across all candidates.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[330px] w-full">
              <LineChart data={surfaceChart} accessibilityLayer margin={{ left: 8, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="horizon" tickLine={false} axisLine={false} minTickGap={18} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${Number(value).toFixed(1)}x`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                {MATURITY_RISK_CANDIDATES.map((candidate) => (
                  <Line key={candidate.key} dataKey={candidate.key} name={candidate.label} stroke={`var(--color-${candidate.key})`} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                ))}
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Implied volatility surface</CardTitle>
            <CardDescription>Candidate multipliers translated onto the same base-volatility curve.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[330px] w-full">
              <LineChart data={impliedChart} accessibilityLayer margin={{ left: 8, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="horizon" tickLine={false} axisLine={false} minTickGap={18} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${(Number(value) * 100).toFixed(0)}%`} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name, item) => (
                        <ChartTooltipRow
                          color={chartTooltipColor(item)}
                          label={maturityCandidateLabel(name as MaturityRiskCandidateType)}
                          value={percentage(Number(value))}
                        />
                      )}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                {MATURITY_RISK_CANDIDATES.map((candidate) => (
                  <Line key={candidate.key} dataKey={candidate.key} name={candidate.label} stroke={`var(--color-${candidate.key})`} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                ))}
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <ShieldCheckIcon />
              <CardTitle>Matured candidate scorecard</CardTitle>
            </div>
            <CardDescription>Equal-horizon outcomes; lower MAE is better, while undercoverage reveals forecasts that were too low.</CardDescription>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Horizon
              <Select value={horizon} onValueChange={setHorizon}>
                <SelectTrigger className="w-28" aria-label="Benchmark horizon">
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
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Candidate
              <Select value={candidate} onValueChange={setCandidate}>
                <SelectTrigger className="w-40" aria-label="Benchmark candidate">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All candidates</SelectItem>
                    {MATURITY_RISK_CANDIDATES.map((item) => (
                      <SelectItem key={item.key} value={item.key}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </label>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {candidateStats.map((candidate) => (
            <div key={candidate.key} className="flex flex-col gap-3 rounded-md border p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{candidate.label}</span>
                <Badge variant="outline">{candidate.rows} rows</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Metric label="MAE" value={candidate.mae == null ? "--" : percentage(candidate.mae)} hint="Forecast error" />
                <Metric label="Undercoverage" value={candidate.undercoverage == null ? "--" : percentage(candidate.undercoverage)} hint="Realized above forecast" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ActivityIcon />
            <CardTitle>Matured path diagnostics</CardTitle>
          </div>
          <CardDescription>{pair.slice(0, 3)}/{pair.slice(3)} · {horizon}-day horizon. Terminal outcomes and within-window peak moves are retained separately.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((group) => (
                  <TableRow key={group.id}>
                    {group.headers.map((header) => (
                      <TableHead key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))}
                {!table.getRowModel().rows.length && (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">No matured rows for this pair and horizon yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <TablePagination table={table} itemLabel="benchmark rows" />
        </CardContent>
      </Card>
    </div>
  );
}
