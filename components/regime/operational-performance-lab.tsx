"use client";

import * as React from "react";
import {
  type ColumnDef,
  type HeaderContext,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  XIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
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
import { TablePagination } from "@/components/regime/table-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { DatePickerNaturalLanguage } from "@/components/ui/date-picker-natural-language";
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
  formatDate,
  formatNumber,
  formatPercent,
  formatSignedPercent,
  formatVol,
  titleCase,
} from "@/lib/format";
import {
  displayPairCode,
  latestMatchedMaturityBenchmarks,
  MATURITY_RISK_CANDIDATES,
  maturityCandidateLabel,
  maturityForecastProvider,
  OPERATIONAL_MATURITY_HORIZONS,
} from "@/lib/maturity-risk";
import type {
  MaturityRiskBenchmarkResult,
  MaturityRiskCandidateType,
  MaturityRiskForecast,
  MaturityRiskOperationalResponse,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type EnrichedBenchmark = MaturityRiskBenchmarkResult & { provider: string };

type HorizonMetricRow = {
  id: string;
  horizon_days: number;
  candidate_type: MaturityRiskCandidateType;
  mae: number | null;
  qlike: number | null;
  bias: number | null;
  undercoverage: number | null;
  balanced_direction: number | null;
  forecasts: number;
  market_dates: number;
};

const candidateChartConfig = Object.fromEntries(
  MATURITY_RISK_CANDIDATES.map((candidate) => [
    candidate.key,
    { label: candidate.label, color: candidate.color },
  ]),
) as ChartConfig;

const performanceChartConfig = {
  ...candidateChartConfig,
  realized_vol: { label: "Realized volatility", color: "var(--chart-4)" },
} satisfies ChartConfig;

function average(values: number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

function preferredPair(pairs: string[], selected?: string) {
  if (selected && pairs.includes(selected)) return selected;
  return pairs.includes("USDGHS") ? "USDGHS" : (pairs[0] ?? "");
}

function providerLabel(value: string) {
  if (value === "exchangerate_api") return "ExchangeRate-API";
  if (value === "yfinance") return "Yahoo Finance";
  return titleCase(value);
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

function outcomeKey(row: MaturityRiskBenchmarkResult) {
  return `${row.pair_code}:${row.as_of_date}:${row.horizon_days}:${row.surface_version}`;
}

function direction(delta: number, tolerance: number) {
  if (delta > tolerance) return "increase";
  if (delta < -tolerance) return "decrease";
  return "hold";
}

function balancedDirectionAccuracy(
  rows: EnrichedBenchmark[],
  candidate: MaturityRiskCandidateType,
) {
  if (candidate === "rule_based") return null;
  const groups = new Map<
    string,
    Map<MaturityRiskCandidateType, EnrichedBenchmark>
  >();
  for (const row of rows) {
    const candidates = groups.get(outcomeKey(row)) ?? new Map();
    candidates.set(row.candidate_type, row);
    groups.set(outcomeKey(row), candidates);
  }
  const observations = [...groups.values()].flatMap((candidates) => {
    const reference = candidates.get("rule_based");
    const forecast = candidates.get(candidate);
    if (!reference || !forecast) return [];
    const tolerance = Math.abs(reference.forecast_implied_vol) * 0.05;
    const forecastDirection = direction(
      forecast.forecast_implied_vol - reference.forecast_implied_vol,
      tolerance,
    );
    const realizedDirection = direction(
      forecast.realized_vol - reference.forecast_implied_vol,
      tolerance,
    );
    return [
      { forecastDirection, hit: forecastDirection === realizedDirection },
    ];
  });
  const classRates = ["increase", "decrease", "hold"]
    .map((value) =>
      observations.filter((row) => row.forecastDirection === value),
    )
    .filter((group) => group.length > 0)
    .map((group) => group.filter((row) => row.hit).length / group.length);
  return classRates.length ? average(classRates) : null;
}

function candidateMetrics(
  rows: EnrichedBenchmark[],
  candidate: MaturityRiskCandidateType,
) {
  const selected = rows.filter((row) => row.candidate_type === candidate);
  return {
    mae: average(selected.map((row) => row.abs_error)),
    qlike: average(selected.map((row) => row.qlike)),
    bias: average(
      selected.map((row) => row.forecast_implied_vol - row.realized_vol),
    ),
    undercoverage: average(selected.map((row) => (row.undercovered ? 1 : 0))),
    balancedDirection: balancedDirectionAccuracy(rows, candidate),
    forecasts: selected.length,
  };
}

function SortHeader({
  label,
  sorted,
  onClick,
  align = "left",
}: {
  label: string;
  sorted: false | "asc" | "desc";
  onClick: (event?: unknown) => void;
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 text-xs font-medium hover:text-foreground",
        align === "right" && "ml-auto",
      )}
      aria-label={`Sort by ${label}`}
    >
      {label}
      {sorted === "asc" ? (
        <ArrowUpIcon className="size-3.5 shrink-0" />
      ) : sorted === "desc" ? (
        <ArrowDownIcon className="size-3.5 shrink-0" />
      ) : (
        <ArrowUpDownIcon className="size-3.5 shrink-0 opacity-40" />
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
    <div className="min-w-0 border-r border-border/70 px-4 py-3 last:border-r-0">
      <p className="text-[11px] font-medium uppercase text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-mono text-xl font-semibold">{value}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground" title={hint}>
        {hint}
      </p>
    </div>
  );
}

export function OperationalPerformanceLab({
  data,
}: {
  data: MaturityRiskOperationalResponse;
}) {
  const forecastById = React.useMemo(
    () => new Map(data.forecasts.map((row) => [row.id, row])),
    [data.forecasts],
  );
  const enriched = React.useMemo<EnrichedBenchmark[]>(
    () =>
      data.benchmarks.map((row) => ({
        ...row,
        provider: maturityForecastProvider(forecastById.get(row.forecast_id)),
      })),
    [data.benchmarks, forecastById],
  );
  const pairs = React.useMemo(
    () => [...new Set(enriched.map((row) => row.pair_code))].sort(),
    [enriched],
  );
  const [selectedPair, setSelectedPair] = React.useState(() =>
    preferredPair(pairs),
  );
  const pair = preferredPair(pairs, selectedPair);
  const pairRows = React.useMemo(
    () => enriched.filter((row) => row.pair_code === pair),
    [enriched, pair],
  );
  const providers = React.useMemo(
    () => [...new Set(pairRows.map((row) => row.provider))].sort(),
    [pairRows],
  );
  const latestProvider = React.useMemo(() => {
    const latest = [...pairRows].sort((left, right) =>
      right.evaluated_at.localeCompare(left.evaluated_at),
    )[0];
    return latest?.provider ?? providers[0] ?? "unknown";
  }, [pairRows, providers]);
  const [selectedProvider, setSelectedProvider] =
    React.useState(latestProvider);
  const provider = providers.includes(selectedProvider)
    ? selectedProvider
    : latestProvider;
  const providerRows = React.useMemo(
    () => pairRows.filter((row) => row.provider === provider),
    [pairRows, provider],
  );
  const surfaceVersions = React.useMemo(
    () => [...new Set(providerRows.map((row) => row.surface_version))].sort(),
    [providerRows],
  );
  const latestSurface = React.useMemo(() => {
    const latest = [...providerRows].sort((left, right) =>
      right.evaluated_at.localeCompare(left.evaluated_at),
    )[0];
    return latest?.surface_version ?? surfaceVersions[0] ?? "unknown";
  }, [providerRows, surfaceVersions]);
  const [selectedSurface, setSelectedSurface] = React.useState(latestSurface);
  const surface = surfaceVersions.includes(selectedSurface)
    ? selectedSurface
    : latestSurface;

  const servingCandidateVersions = React.useMemo(() => {
    const latest = new Map<MaturityRiskCandidateType, MaturityRiskForecast>();
    for (const row of data.forecasts) {
      if (
        row.pair_code !== pair ||
        row.surface_version !== surface ||
        maturityForecastProvider(row) !== provider
      ) {
        continue;
      }
      const current = latest.get(row.candidate_type);
      if (
        !current ||
        row.as_of_date > current.as_of_date ||
        (row.as_of_date === current.as_of_date &&
          row.generated_at > current.generated_at)
      ) {
        latest.set(row.candidate_type, row);
      }
    }
    return new Map(
      [...latest].map(([candidate, row]) => [candidate, row.candidate_version]),
    );
  }, [data.forecasts, pair, provider, surface]);

  const cohortRows = React.useMemo(
    () =>
      latestMatchedMaturityBenchmarks(
        providerRows.filter((row) => row.surface_version === surface),
      ),
    [providerRows, surface],
  );

  const availableHorizons = OPERATIONAL_MATURITY_HORIZONS.filter((days) =>
    cohortRows.some((row) => row.horizon_days === days),
  );
  const [selectedHorizon, setSelectedHorizon] = React.useState(
    String(availableHorizons[0] ?? OPERATIONAL_MATURITY_HORIZONS[0]),
  );
  const horizon = availableHorizons.some(
    (days) => days === Number(selectedHorizon),
  )
    ? Number(selectedHorizon)
    : (availableHorizons[0] ?? OPERATIONAL_MATURITY_HORIZONS[0]);

  const selectedHistory = React.useMemo(() => {
    const byDate = new Map<string, Record<string, string | number>>();
    for (const row of cohortRows) {
      if (row.horizon_days !== horizon) continue;
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
  }, [cohortRows, horizon]);

  const metricRows = React.useMemo<HorizonMetricRow[]>(
    () =>
      OPERATIONAL_MATURITY_HORIZONS.flatMap((days) => {
        const horizonRows = cohortRows.filter(
          (row) => row.horizon_days === days,
        );
        return MATURITY_RISK_CANDIDATES.map((candidate) => {
          const metrics = candidateMetrics(horizonRows, candidate.key);
          const candidateRows = horizonRows.filter(
            (row) => row.candidate_type === candidate.key,
          );
          return {
            id: `${days}:${candidate.key}`,
            horizon_days: days,
            candidate_type: candidate.key,
            mae: metrics.mae,
            qlike: metrics.qlike,
            bias: metrics.bias,
            undercoverage: metrics.undercoverage,
            balanced_direction: metrics.balancedDirection,
            forecasts: metrics.forecasts,
            market_dates: new Set(
              candidateRows.map((row) => row.evaluation_market_date),
            ).size,
          };
        });
      }),
    [cohortRows],
  );

  const horizonChartRows = React.useMemo(
    () =>
      OPERATIONAL_MATURITY_HORIZONS.map((days) => {
        const rows = metricRows.filter((row) => row.horizon_days === days);
        return Object.fromEntries([
          ["horizon", `${days}d`],
          ...rows.map((row) => [row.candidate_type, row.mae]),
        ]);
      }),
    [metricRows],
  );
  const undercoverageChartRows = React.useMemo(
    () =>
      OPERATIONAL_MATURITY_HORIZONS.map((days) => {
        const rows = metricRows.filter((row) => row.horizon_days === days);
        return Object.fromEntries([
          ["horizon", `${days}d`],
          ...rows.map((row) => [row.candidate_type, row.undercoverage]),
        ]);
      }),
    [metricRows],
  );

  const summaryMetrics = React.useMemo(
    () =>
      MATURITY_RISK_CANDIDATES.map((candidate) => ({
        candidate,
        metrics: candidateMetrics(cohortRows, candidate.key),
      })),
    [cohortRows],
  );
  const outcomeCount = new Set(cohortRows.map(outcomeKey)).size;
  const marketDates = new Set(
    cohortRows.map((row) => row.evaluation_market_date),
  ).size;
  const maturedHorizons = new Set(cohortRows.map((row) => row.horizon_days))
    .size;
  const rolledOutcomes = new Set(
    cohortRows.filter((row) => row.maturity_rolled).map(outcomeKey),
  ).size;

  const [metricCandidate, setMetricCandidate] = React.useState("all");
  const [metricHorizon, setMetricHorizon] = React.useState("all");
  const [metricSorting, setMetricSorting] = React.useState<SortingState>([
    { id: "horizon_days", desc: false },
  ]);
  const filteredMetricRows = React.useMemo(
    () =>
      metricRows.filter(
        (row) =>
          (metricCandidate === "all" ||
            row.candidate_type === metricCandidate) &&
          (metricHorizon === "all" ||
            row.horizon_days === Number(metricHorizon)),
      ),
    [metricCandidate, metricHorizon, metricRows],
  );
  const metricColumns = React.useMemo<ColumnDef<HorizonMetricRow>[]>(
    () => [
      {
        accessorKey: "horizon_days",
        header: ({ column }: HeaderContext<HorizonMetricRow, unknown>) => (
          <SortHeader
            label="Horizon"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono font-medium">
            {row.original.horizon_days}d
          </span>
        ),
      },
      {
        accessorKey: "candidate_type",
        header: ({ column }: HeaderContext<HorizonMetricRow, unknown>) => (
          <SortHeader
            label="Candidate"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
        cell: ({ row }) => maturityCandidateLabel(row.original.candidate_type),
      },
      ...(
        [
          ["mae", "MAE", (value: number | null) => formatVol(value, 2)],
          ["qlike", "QLIKE", (value: number | null) => formatNumber(value, 3)],
          [
            "bias",
            "Bias",
            (value: number | null) => formatSignedPercent(value, 2),
          ],
          [
            "undercoverage",
            "Undercoverage",
            (value: number | null) => formatPercent(value, 1),
          ],
        ] as const
      ).map(([key, label, formatter]) => ({
        accessorKey: key,
        header: ({ column }: HeaderContext<HorizonMetricRow, unknown>) => (
          <SortHeader
            label={label}
            align="right"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
        cell: ({ row }: { row: { original: HorizonMetricRow } }) => (
          <div className="text-right font-mono tabular-nums">
            {formatter(row.original[key])}
          </div>
        ),
      })),
      {
        accessorKey: "balanced_direction",
        header: ({ column }) => (
          <SortHeader
            label="Balanced direction"
            align="right"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono tabular-nums">
            {row.original.candidate_type === "rule_based"
              ? "Reference"
              : row.original.forecasts === 0
                ? "--"
                : formatPercent(row.original.balanced_direction, 1)}
          </div>
        ),
      },
      {
        accessorKey: "forecasts",
        header: ({ column }: HeaderContext<HorizonMetricRow, unknown>) => (
          <SortHeader
            label="Forecasts"
            align="right"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono">
            {row.original.forecasts || "--"}
          </div>
        ),
      },
      {
        accessorKey: "market_dates",
        header: ({ column }: HeaderContext<HorizonMetricRow, unknown>) => (
          <SortHeader
            label="Market dates"
            align="right"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono">
            {row.original.market_dates || "--"}
          </div>
        ),
      },
    ],
    [],
  );
  // eslint-disable-next-line react-hooks/incompatible-library
  const metricTable = useReactTable({
    data: filteredMetricRows,
    columns: metricColumns,
    state: { sorting: metricSorting },
    onSortingChange: setMetricSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 14 } },
  });

  const [outcomeCandidate, setOutcomeCandidate] = React.useState("all");
  const [outcomeHorizon, setOutcomeHorizon] = React.useState("all");
  const [outcomeFromDate, setOutcomeFromDate] = React.useState<Date>();
  const [outcomeToDate, setOutcomeToDate] = React.useState<Date>();
  const [outcomeSorting, setOutcomeSorting] = React.useState<SortingState>([
    { id: "evaluation_market_date", desc: true },
  ]);
  const outcomeDateBounds = React.useMemo(() => {
    const values = cohortRows.map(
      (row) => new Date(`${row.evaluation_market_date}T00:00:00`),
    );
    if (!values.length) return {};
    return {
      min: new Date(Math.min(...values.map((value) => value.getTime()))),
      max: new Date(Math.max(...values.map((value) => value.getTime()))),
    };
  }, [cohortRows]);
  const filteredOutcomes = React.useMemo(() => {
    const from = outcomeFromDate
      ? new Date(
          outcomeFromDate.getFullYear(),
          outcomeFromDate.getMonth(),
          outcomeFromDate.getDate(),
        )
      : null;
    const to = outcomeToDate
      ? new Date(
          outcomeToDate.getFullYear(),
          outcomeToDate.getMonth(),
          outcomeToDate.getDate(),
          23,
          59,
          59,
          999,
        )
      : null;
    return cohortRows.filter((row) => {
      const evaluated = new Date(`${row.evaluation_market_date}T00:00:00`);
      return (
        (outcomeCandidate === "all" ||
          row.candidate_type === outcomeCandidate) &&
        (outcomeHorizon === "all" ||
          row.horizon_days === Number(outcomeHorizon)) &&
        (!from || evaluated >= from) &&
        (!to || evaluated <= to)
      );
    });
  }, [
    cohortRows,
    outcomeCandidate,
    outcomeFromDate,
    outcomeHorizon,
    outcomeToDate,
  ]);
  const hasOutcomeFilters =
    outcomeCandidate !== "all" ||
    outcomeHorizon !== "all" ||
    Boolean(outcomeFromDate) ||
    Boolean(outcomeToDate);
  const outcomeColumns = React.useMemo<ColumnDef<EnrichedBenchmark>[]>(
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
          <span className="font-mono text-xs">
            {formatDate(row.original.evaluation_market_date)}
            {row.original.maturity_rolled ? " · rolled" : ""}
          </span>
        ),
      },
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
          <span className="font-mono">{row.original.horizon_days}d</span>
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
        cell: ({ row }) => maturityCandidateLabel(row.original.candidate_type),
      },
      {
        accessorKey: "candidate_version",
        header: "Version",
        cell: ({ row }) => (
          <span
            className="block max-w-48 truncate font-mono text-xs"
            title={row.original.candidate_version}
          >
            {row.original.candidate_version}
          </span>
        ),
      },
      ...(
        [
          [
            "forecast_implied_vol",
            "Forecast",
            (value: number) => formatVol(value, 2),
          ],
          ["realized_vol", "Realized", (value: number) => formatVol(value, 2)],
          [
            "abs_error",
            "Absolute error",
            (value: number) => formatVol(value, 2),
          ],
          ["qlike", "QLIKE", (value: number) => formatNumber(value, 3)],
        ] as const
      ).map(([key, label, formatter]) => ({
        accessorKey: key,
        header: ({ column }: HeaderContext<EnrichedBenchmark, unknown>) => (
          <SortHeader
            label={label}
            align="right"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
        cell: ({ row }: { row: { original: EnrichedBenchmark } }) => (
          <div className="text-right font-mono tabular-nums">
            {formatter(row.original[key])}
          </div>
        ),
      })),
      {
        id: "bias",
        accessorFn: (row) => row.forecast_implied_vol - row.realized_vol,
        header: ({ column }) => (
          <SortHeader
            label="Bias"
            align="right"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono tabular-nums">
            {formatSignedPercent(
              row.original.forecast_implied_vol - row.original.realized_vol,
              2,
            )}
          </div>
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
          <Badge
            variant={row.original.undercovered ? "destructive" : "secondary"}
          >
            {row.original.undercovered ? "Undercovered" : "Covered"}
          </Badge>
        ),
      },
      {
        accessorKey: "max_abs_move_day",
        header: ({ column }) => (
          <SortHeader
            label="Peak day"
            align="right"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono">
            D+{row.original.max_abs_move_day}
          </div>
        ),
      },
    ],
    [],
  );
  const outcomeTable = useReactTable({
    data: filteredOutcomes,
    columns: outcomeColumns,
    state: { sorting: outcomeSorting },
    onSortingChange: setOutcomeSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  return (
    <div className="flex flex-col gap-5">
      <section className="border-y bg-card/30">
        <div className="flex flex-wrap items-end gap-3 px-4 py-3">
          <div className="mr-auto min-w-[220px]">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Evaluation cohort
            </p>
            <p className="mt-1 text-sm">
              Exact calendar maturity · complete matched outcomes across version
              changes
            </p>
          </div>
          <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
            Pair
            <Select value={pair} onValueChange={setSelectedPair}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {pairs.map((value) => (
                    <SelectItem key={value} value={value}>
                      {displayPairCode(value)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
            Market data provider
            <Select value={provider} onValueChange={setSelectedProvider}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {providers.map((value) => (
                    <SelectItem key={value} value={value}>
                      {providerLabel(value)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
            Surface version
            <Select value={surface} onValueChange={setSelectedSurface}>
              <SelectTrigger className="w-[220px]" title={surface}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {surfaceVersions.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </label>
        </div>
        <div className="grid gap-2 border-t px-4 py-3 sm:grid-cols-3">
          {MATURITY_RISK_CANDIDATES.map((candidate) => (
            <div
              key={candidate.key}
              className="flex min-w-0 items-center gap-2 text-xs"
              title={servingCandidateVersions.get(candidate.key)}
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: candidate.color }}
              />
              <span className="shrink-0 font-medium">{candidate.label}</span>
              <span className="min-w-0 truncate font-mono text-muted-foreground">
                Serving now ·{" "}
                {servingCandidateVersions.get(candidate.key) ?? "unavailable"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 border-y bg-card/20 md:grid-cols-4">
        <Metric
          label="Matched outcomes"
          value={outcomeCount.toLocaleString()}
          hint="Pair/date/horizon observations with all candidates"
        />
        <Metric
          label="Market dates"
          value={marketDates.toLocaleString()}
          hint="Independent evaluation dates"
        />
        <Metric
          label="Matured horizons"
          value={`${maturedHorizons} / ${OPERATIONAL_MATURITY_HORIZONS.length}`}
          hint="Reporting horizons with comparable outcomes"
        />
        <Metric
          label="Rolled maturities"
          value={rolledOutcomes.toLocaleString()}
          hint="Declared dates moved to the next market observation"
        />
      </section>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Candidate Scorecard</CardTitle>
          <CardDescription>
            One metric contract across rule-based, historical ML, and
            LLM-adjusted forecasts.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead className="text-right">MAE</TableHead>
                  <TableHead className="text-right">QLIKE</TableHead>
                  <TableHead className="text-right">Bias</TableHead>
                  <TableHead className="text-right">Undercoverage</TableHead>
                  <TableHead className="text-right">
                    Balanced direction
                  </TableHead>
                  <TableHead className="text-right">Forecasts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryMetrics.map(({ candidate, metrics }) => (
                  <TableRow key={candidate.key}>
                    <TableCell className="font-medium">
                      {candidate.label}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatVol(metrics.mae, 2)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(metrics.qlike, 3)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatSignedPercent(metrics.bias, 2)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatPercent(metrics.undercoverage, 1)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {metrics.balancedDirection == null
                        ? "Reference"
                        : formatPercent(metrics.balancedDirection, 1)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {metrics.forecasts}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle>Forecast Versus Realized Volatility</CardTitle>
            <CardDescription>
              {displayPairCode(pair)} · {horizon}d exact-maturity cohort
            </CardDescription>
          </div>
          <div
            className="overflow-x-auto pb-1"
            aria-label="Operational horizons"
          >
            <ToggleGroup
              type="single"
              value={String(horizon)}
              onValueChange={(value) => value && setSelectedHorizon(value)}
              variant="outline"
              size="sm"
              className="w-max justify-start"
            >
              {OPERATIONAL_MATURITY_HORIZONS.map((days) => (
                <ToggleGroupItem
                  key={days}
                  value={String(days)}
                  disabled={!availableHorizons.includes(days)}
                  className="min-w-12 font-mono"
                >
                  {days}d
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </CardHeader>
        <CardContent>
          {selectedHistory.length ? (
            <ChartContainer
              config={performanceChartConfig}
              className="h-[320px] w-full"
            >
              <LineChart
                data={selectedHistory}
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
                          value={formatVol(Number(value), 2)}
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

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>MAE Across Operational Horizons</CardTitle>
            <CardDescription>
              Absolute volatility error in percentage points; lower is better.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={candidateChartConfig}
              className="h-[300px] w-full"
            >
              <LineChart
                data={horizonChartRows}
                accessibilityLayer
                margin={{ left: 8, right: 12 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="horizon"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
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
                      formatter={(value, name, item) => (
                        <ChartTooltipRow
                          color={chartTooltipColor(item)}
                          label={maturityCandidateLabel(
                            name as MaturityRiskCandidateType,
                          )}
                          value={formatVol(Number(value), 2)}
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
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Undercoverage Across Operational Horizons</CardTitle>
            <CardDescription>
              Share of matured forecasts below realized volatility; lower is
              safer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={candidateChartConfig}
              className="h-[300px] w-full"
            >
              <BarChart data={undercoverageChartRows} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="horizon"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  domain={[0, 1]}
                  tickFormatter={(value) => formatPercent(Number(value), 0)}
                />
                <ChartLegend content={<ChartLegendContent />} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name, item) => (
                        <ChartTooltipRow
                          color={chartTooltipColor(item)}
                          label={maturityCandidateLabel(
                            name as MaturityRiskCandidateType,
                          )}
                          value={formatPercent(Number(value), 1)}
                        />
                      )}
                    />
                  }
                />
                {MATURITY_RISK_CANDIDATES.map((candidate) => (
                  <Bar
                    key={candidate.key}
                    dataKey={candidate.key}
                    name={candidate.label}
                    fill={`var(--color-${candidate.key})`}
                    radius={2}
                  />
                ))}
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </section>

      <section className="border">
        <div className="flex flex-wrap items-end gap-3 border-b px-4 py-3">
          <div className="mr-auto">
            <h2 className="text-base font-semibold">
              Metrics by Operational Horizon
            </h2>
            <p className="text-sm text-muted-foreground">
              All shared benchmark measures, including horizons still waiting to
              mature.
            </p>
          </div>
          <Select
            value={metricCandidate}
            onValueChange={(value) => {
              setMetricCandidate(value);
              metricTable.setPageIndex(0);
            }}
          >
            <SelectTrigger className="w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">All candidates</SelectItem>
                {MATURITY_RISK_CANDIDATES.map((candidate) => (
                  <SelectItem key={candidate.key} value={candidate.key}>
                    {candidate.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select
            value={metricHorizon}
            onValueChange={(value) => {
              setMetricHorizon(value);
              metricTable.setPageIndex(0);
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">All horizons</SelectItem>
                {OPERATIONAL_MATURITY_HORIZONS.map((days) => (
                  <SelectItem key={days} value={String(days)}>
                    {days} days
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[1000px]">
            <TableHeader>
              {metricTable.getHeaderGroups().map((group) => (
                <TableRow key={group.id}>
                  {group.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {metricTable.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <TablePagination
          table={metricTable}
          itemLabel="horizon metrics"
          pageSizeOptions={[14, 28, 42]}
        />
      </section>

      <section className="border">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">
              Operational Matured Outcome Tape
            </h2>
            <p className="text-sm text-muted-foreground">
              Row-level evidence behind every aggregate metric above.
            </p>
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {filteredOutcomes.length} outcomes
          </span>
        </div>
        <div className="border-b bg-muted/15 px-4 py-3">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Outcome filters
              </p>
              <p className="text-xs text-muted-foreground">
                Provider, surface, and pair are inherited from the cohort above.
              </p>
            </div>
            {hasOutcomeFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setOutcomeCandidate("all");
                  setOutcomeHorizon("all");
                  setOutcomeFromDate(undefined);
                  setOutcomeToDate(undefined);
                  outcomeTable.setPageIndex(0);
                }}
              >
                <XIcon data-icon="inline-start" />
                Clear filters
              </Button>
            )}
          </div>
          <div className="grid items-end gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex min-w-0 flex-col gap-1.5 text-[11px] font-medium uppercase text-muted-foreground">
              Candidate
              <Select
                value={outcomeCandidate}
                onValueChange={(value) => {
                  setOutcomeCandidate(value);
                  outcomeTable.setPageIndex(0);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All candidates</SelectItem>
                    {MATURITY_RISK_CANDIDATES.map((candidate) => (
                      <SelectItem key={candidate.key} value={candidate.key}>
                        {candidate.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 text-[11px] font-medium uppercase text-muted-foreground">
              Horizon
              <Select
                value={outcomeHorizon}
                onValueChange={(value) => {
                  setOutcomeHorizon(value);
                  outcomeTable.setPageIndex(0);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All horizons</SelectItem>
                    {OPERATIONAL_MATURITY_HORIZONS.map((days) => (
                      <SelectItem key={days} value={String(days)}>
                        {days} days
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 text-[11px] font-medium uppercase text-muted-foreground">
              Evaluated from
              <DatePickerNaturalLanguage
                value={outcomeFromDate}
                min={outcomeDateBounds.min}
                max={outcomeToDate ?? outcomeDateBounds.max}
                onChange={(value) => {
                  setOutcomeFromDate(value);
                  outcomeTable.setPageIndex(0);
                }}
                placeholder="e.g. two weeks ago"
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 text-[11px] font-medium uppercase text-muted-foreground">
              Evaluated to
              <DatePickerNaturalLanguage
                value={outcomeToDate}
                min={outcomeFromDate ?? outcomeDateBounds.min}
                max={outcomeDateBounds.max}
                onChange={(value) => {
                  setOutcomeToDate(value);
                  outcomeTable.setPageIndex(0);
                }}
                placeholder="e.g. today"
              />
            </label>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[1320px]">
            <TableHeader>
              {outcomeTable.getHeaderGroups().map((group) => (
                <TableRow key={group.id}>
                  {group.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {outcomeTable.getRowModel().rows.length ? (
                outcomeTable.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={outcomeColumns.length}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    No matured operational outcomes match this cohort.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <TablePagination
          table={outcomeTable}
          itemLabel="matured forecasts"
          pageSizeOptions={[10, 20, 50]}
        />
      </section>
    </div>
  );
}
