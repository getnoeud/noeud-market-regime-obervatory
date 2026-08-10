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
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  CircleHelpIcon,
  ScanSearchIcon,
} from "lucide-react";
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  Scatter,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDate, formatNumber } from "@/lib/format";
import {
  MATURITY_RISK_CANDIDATES,
} from "@/lib/maturity-risk";
import { cn } from "@/lib/utils";
import type {
  MaturityRiskForecast,
  MaturityRiskSurfaceResponse,
} from "@/lib/types";

const TRAINING_HORIZONS = new Set([
  ...Array.from({ length: 30 }, (_, index) => index + 1),
  45,
  60,
  75,
  90,
  120,
  150,
  180,
  210,
  252,
]);
const RANGE_OPTIONS = [
  { value: "all", label: "All maturities", minimum: 1, maximum: 252 },
  { value: "front", label: "Front · 1–30d", minimum: 1, maximum: 30 },
  { value: "medium", label: "Medium · 31–90d", minimum: 31, maximum: 90 },
  { value: "long", label: "Long · 91–180d", minimum: 91, maximum: 180 },
  { value: "anchor", label: "Anchor · 181–252d", minimum: 181, maximum: 252 },
] as const;

type HorizonScope = "exact" | "training";
type SurfaceRow = {
  horizon_days: number;
  horizon_band: string;
  is_training_horizon: boolean;
  rule_based?: MaturityRiskForecast;
  historical_ml?: MaturityRiskForecast;
  news_adjusted?: MaturityRiskForecast;
};

const chartConfig = {
  rule_based: { label: "Rule-based", color: "var(--chart-1)" },
  historical_ml: { label: "Historical ML", color: "var(--chart-2)" },
  news_adjusted: { label: "LLM recommendation", color: "var(--chart-3)" },
  training_label: { label: "ML training horizon", color: "var(--chart-2)" },
  ml_vs_rule: { label: "ML vs rule-based", color: "var(--chart-4)" },
  news_vs_ml: { label: "LLM recommendation vs Historical ML", color: "var(--chart-5)" },
} satisfies ChartConfig;

function percentage(value: number | null | undefined, digits = 1) {
  return value == null || !Number.isFinite(value)
    ? "--"
    : `${formatNumber(value * 100, digits)}%`;
}

function multiplier(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? "--" : `${formatNumber(value, 3)}x`;
}

function relativeDelta(left?: number, right?: number) {
  if (left == null || right == null || right === 0) return null;
  return left / right - 1;
}

function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <CircleHelpIcon className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{children}</TooltipContent>
    </Tooltip>
  );
}

function Metric({
  label,
  value,
  hint,
  explanation,
}: {
  label: string;
  value: string;
  hint: string;
  explanation?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 border-l pl-4 first:border-l-0 first:pl-0">
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {explanation && <InfoTip label={`Explain ${label}`}>{explanation}</InfoTip>}
      </span>
      <span className="truncate font-mono text-lg font-semibold tabular-nums">{value}</span>
      <span className="truncate text-xs text-muted-foreground">{hint}</span>
    </div>
  );
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

export function MaturitySurfaceExplorer({ data }: { data: MaturityRiskSurfaceResponse }) {
  const pairs = React.useMemo(
    () => [...new Set(data.forecasts.map((row) => row.pair_code))].sort(),
    [data.forecasts],
  );
  const [pair, setPair] = React.useState(
    pairs.includes("USDGHS") ? "USDGHS" : (pairs[0] ?? "USDGHS"),
  );
  const [scope, setScope] = React.useState<HorizonScope>("exact");
  const [range, setRange] = React.useState("all");
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "horizon_days", desc: false },
  ]);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  const latestRows = React.useMemo(() => {
    const pairRows = data.forecasts.filter((row) => row.pair_code === pair);
    const latestDate = pairRows.reduce(
      (latest, row) => (row.as_of_date > latest ? row.as_of_date : latest),
      "",
    );
    return {
      asOfDate: latestDate,
      rows: pairRows.filter((row) => row.as_of_date === latestDate),
    };
  }, [data.forecasts, pair]);
  const completeSurface = React.useMemo(() => {
    const index = new Map<number, SurfaceRow>();
    for (const forecast of latestRows.rows) {
      const row = index.get(forecast.horizon_days) ?? {
        horizon_days: forecast.horizon_days,
        horizon_band: forecast.horizon_band,
        is_training_horizon: TRAINING_HORIZONS.has(forecast.horizon_days),
      };
      row[forecast.candidate_type] = forecast;
      index.set(forecast.horizon_days, row);
    }
    return [...index.values()].sort((left, right) => left.horizon_days - right.horizon_days);
  }, [latestRows.rows]);
  const selectedRange =
    RANGE_OPTIONS.find((option) => option.value === range) ?? RANGE_OPTIONS[0];
  const visibleRows = React.useMemo(
    () =>
      completeSurface.filter(
        (row) =>
          row.horizon_days >= selectedRange.minimum &&
          row.horizon_days <= selectedRange.maximum &&
          (scope === "exact" || row.is_training_horizon),
      ),
    [completeSurface, scope, selectedRange.maximum, selectedRange.minimum],
  );
  const chartData = React.useMemo(
    () =>
      visibleRows.map((row) => ({
        days: row.horizon_days,
        rule_based: row.rule_based?.multiplier,
        historical_ml: row.historical_ml?.multiplier,
        news_adjusted: row.news_adjusted?.multiplier,
        ml_vs_rule: relativeDelta(row.historical_ml?.multiplier, row.rule_based?.multiplier),
        news_vs_ml: relativeDelta(row.news_adjusted?.multiplier, row.historical_ml?.multiplier),
      })),
    [visibleRows],
  );
  const trainingMarkers = React.useMemo(
    () => chartData.filter((row) => TRAINING_HORIZONS.has(row.days)),
    [chartData],
  );

  const columns = React.useMemo<ColumnDef<SurfaceRow>[]>(
    () => [
      {
        accessorKey: "horizon_days",
        header: ({ column }) => (
          <SortHeader
            label="Horizon"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono font-medium">{row.original.horizon_days}d</span>
        ),
      },
      {
        accessorKey: "is_training_horizon",
        header: "Model exposure",
        cell: ({ row }) =>
          row.original.is_training_horizon ? (
            <Badge variant="secondary">Training label</Badge>
          ) : (
            <Badge variant="outline">Generalized</Badge>
          ),
      },
      ...MATURITY_RISK_CANDIDATES.map<ColumnDef<SurfaceRow>>((candidate) => ({
        id: candidate.key,
        accessorFn: (row) => row[candidate.key]?.multiplier,
        header: ({ column }) => (
          <SortHeader
            label={candidate.label}
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono tabular-nums">
            {multiplier(row.original[candidate.key]?.multiplier)}
          </span>
        ),
      })),
      {
        id: "ml_vs_rule",
        accessorFn: (row) =>
          relativeDelta(row.historical_ml?.multiplier, row.rule_based?.multiplier),
        header: ({ column }) => (
          <SortHeader
            label="Historical ML vs Rule-based"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono tabular-nums">
            {percentage(
              relativeDelta(
                row.original.historical_ml?.multiplier,
                row.original.rule_based?.multiplier,
              ),
            )}
          </span>
        ),
      },
      {
        id: "news_vs_ml",
        accessorFn: (row) =>
          relativeDelta(row.news_adjusted?.multiplier, row.historical_ml?.multiplier),
        header: ({ column }) => (
          <SortHeader
            label="LLM recommendation vs Historical ML"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono tabular-nums">
            {percentage(
              relativeDelta(
                row.original.news_adjusted?.multiplier,
                row.original.historical_ml?.multiplier,
              ),
            )}
          </span>
        ),
      },
      {
        id: "base_vol",
        accessorFn: (row) => row.historical_ml?.base_vol,
        header: ({ column }) => (
          <SortHeader
            label="Base vol"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono tabular-nums">
            {percentage(row.original.historical_ml?.base_vol)}
          </span>
        ),
      },
    ],
    [],
  );
  const table = useReactTable({
    data: visibleRows,
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
    [pair, range, scope],
  );

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex items-center gap-2">
                <ScanSearchIcon />
                <CardTitle>Exact-maturity model surface</CardTitle>
                <Badge variant="secondary">Research view</Badge>
              </div>
              <CardDescription>
                One pooled model evaluated across the full calendar-maturity domain.
              </CardDescription>
            </div>
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
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Metric label="Surface date" value={formatDate(latestRows.asOfDate)} hint={`${pair.slice(0, 3)}/${pair.slice(3)}`} />
            <Metric
              label="Training labels"
              value="39"
              hint="1–30d plus 9 anchors"
              explanation="These horizons had direct realized-forward-volatility labels during supervised training."
            />
            <Metric
              label="Served maturities"
              value={completeSurface.length.toLocaleString()}
              hint="Exact calendar days"
              explanation="The fitted model is evaluated once for each requested horizon from 1 through 252 days."
            />
            <Metric
              label="Model structure"
              value="1 pooled"
              hint="Pair and horizon aware"
              explanation="USD/GHS, EUR/GHS, and GBP/GHS share one model; pair code and horizon are model inputs."
            />
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1 text-sm font-medium">
              Horizon coverage
              <InfoTip label="Explain horizon coverage">
                Exact shows every served maturity. Training labels shows only horizons used to form supervised targets.
              </InfoTip>
            </span>
            <ToggleGroup
              type="single"
              value={scope}
              onValueChange={(value) => value && setScope(value as HorizonScope)}
              variant="outline"
              size="sm"
              spacing={0}
              aria-label="Horizon coverage"
            >
              <ToggleGroupItem value="exact">Exact · 252</ToggleGroupItem>
              <ToggleGroupItem value="training">Training labels · 39</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Maturity range
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-44" aria-label="Maturity range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {RANGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Multiplier surface</CardTitle>
              <CardDescription>
                Dots mark horizons used as direct ML training labels; lines include generalized maturities.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[360px] w-full">
                <ComposedChart data={chartData} accessibilityLayer margin={{ left: 8, right: 12 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="days" type="number" domain={[selectedRange.minimum, selectedRange.maximum]} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}d`} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${Number(value).toFixed(1)}x`} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_value, payload) =>
                          `${String(payload?.[0]?.payload?.days ?? "--")} days`
                        }
                      />
                    }
                  />
                  <Legend />
                  {MATURITY_RISK_CANDIDATES.map((candidate) => (
                    <Line key={candidate.key} dataKey={candidate.key} name={candidate.label} stroke={`var(--color-${candidate.key})`} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                  ))}
                  <Scatter name="ML training horizon" data={trainingMarkers} dataKey="historical_ml" fill="var(--color-training_label)" isAnimationActive={false} />
                </ComposedChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Candidate divergence</CardTitle>
              <CardDescription>
                Relative multiplier differences isolate where Historical ML or the LLM recommendation changes the rule surface.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[360px] w-full">
                <LineChart data={chartData} accessibilityLayer margin={{ left: 8, right: 12 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="days" type="number" domain={[selectedRange.minimum, selectedRange.maximum]} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}d`} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${(Number(value) * 100).toFixed(0)}%`} />
                  <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="4 4" />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_value, payload) =>
                          `${String(payload?.[0]?.payload?.days ?? "--")} days`
                        }
                        formatter={(value, name, item) => (
                          <ChartTooltipRow
                            color={chartTooltipColor(item)}
                            label={
                              String(name).includes("rule-based") ||
                              String(name).includes("Rule-based")
                                ? "Historical ML vs Rule-based"
                                : "LLM recommendation vs Historical ML"
                            }
                            value={percentage(Number(value))}
                          />
                        )}
                      />
                    }
                  />
                  <Legend />
                  <Line dataKey="ml_vs_rule" name="Historical ML vs Rule-based" stroke="var(--color-ml_vs_rule)" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                  <Line dataKey="news_vs_ml" name="LLM recommendation vs Historical ML" stroke="var(--color-news_vs_ml)" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Horizon-by-horizon audit</CardTitle>
            <CardDescription>
              {visibleRows.length} selected maturities. A generalized row is served by the fitted function but was not a direct training-label horizon.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((group) => (
                    <TableRow key={group.id}>
                      {group.headers.map((header) => (
                        <TableHead key={header.id}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {!table.getRowModel().rows.length && (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                        No surface rows match this horizon selection.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <TablePagination table={table} itemLabel="horizons" pageSizeOptions={[20, 50, 100]} />
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
