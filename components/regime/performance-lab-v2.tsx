"use client";

import * as React from "react";
import {
  type ColumnDef,
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
  CartesianGrid,
  Bar,
  BarChart,
  XAxis,
  YAxis,
} from "recharts";

import { TablePagination } from "@/components/regime/table-pagination";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { DatePickerNaturalLanguage } from "@/components/ui/date-picker-natural-language";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TimePickerIcon } from "@/components/ui/time-picker-icon";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type {
  BenchmarkEvaluationStatus,
  BenchmarkResult,
  SignalHorizonBenchmarkResult,
  TrendAwareMultiplierMap,
  ValidationRun,
} from "@/lib/types";

const TENORS: (keyof TrendAwareMultiplierMap)[] = [
  "tenor_le_14d",
  "tenor_le_30d",
  "tenor_le_60d",
  "tenor_le_90d",
  "tenor_le_180d",
  "tenor_gt_180d",
];

const TENOR_LABELS: Record<keyof TrendAwareMultiplierMap, string> = {
  tenor_le_14d: "≤14d",
  tenor_le_30d: "≤30d",
  tenor_le_60d: "≤60d",
  tenor_le_90d: "≤90d",
  tenor_le_180d: "≤180d",
  tenor_gt_180d: ">180d",
};

type Scope = "canonical" | "all";
type MemoryScope = "all" | "with_memory" | "without_memory";

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function formatVol(value: number, digits = 2) {
  return `${(value * 100).toFixed(digits)}pp`;
}

function formatPercent(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

function applyTime(value: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const next = new Date(value);
  next.setHours(hours || 0, minutes || 0, 0, 0);
  return next;
}

function benchmarkEvaluationTime(row: BenchmarkResult) {
  const parsed = new Date(
    row.evaluated_at ||
      row.evaluation_market_date ||
      row.maturity_date,
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function validationAsOfTime(run: ValidationRun) {
  const parsed = new Date(`${run.as_of_date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function methodLabel(method: string) {
  if (method === "tenor_matched_v2") return "Tenor matched · primary";
  if (method === "legacy_vol252d_v1") return "252d anchor · diagnostic";
  return method;
}

function qlikeLoss(forecastVol: number, realizedVol: number) {
  const forecastVariance = Math.max(forecastVol ** 2, 1e-12);
  const realizedVariance = Math.max(realizedVol ** 2, 1e-12);
  return Math.log(forecastVariance) + realizedVariance / forecastVariance;
}

function uniqueCount<T>(rows: T[], key: (row: T) => string) {
  return new Set(rows.map(key)).size;
}

function clusterInterval(rows: BenchmarkResult[]) {
  const groups = new Map<string, number[]>();
  for (const row of rows) {
    const values = groups.get(row.as_of_date) ?? [];
    values.push(row.llm_lift);
    groups.set(row.as_of_date, values);
  }
  const dateLifts = [...groups.values()].map(average);
  if (dateLifts.length < 2) return null;
  const mean = average(dateLifts);
  const variance =
    dateLifts.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    (dateLifts.length - 1);
  const margin = 1.96 * Math.sqrt(variance / dateLifts.length);
  return { low: mean - margin, high: mean + margin };
}

function balancedDirectionAccuracy(rows: BenchmarkResult[]) {
  const directions = ["increase", "decrease", "hold"];
  const rates = directions
    .map((direction) => rows.filter((row) => row.llm_direction === direction))
    .filter((group) => group.length > 0)
    .map((group) => group.filter((row) => row.direction_hit).length / group.length);
  return rates.length ? average(rates) : 0;
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="min-w-0 border-r border-border/70 px-4 py-3 last:border-r-0">
      <p className="text-[11px] font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold">{value}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground" title={hint}>{hint}</p>
    </div>
  );
}

function SortHeader({
  label,
  onClick,
  sorted,
  align = "left",
}: {
  label: string;
  onClick: (event?: unknown) => void;
  sorted: false | "asc" | "desc";
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      aria-label={`Sort by ${label}${sorted ? `, currently ${sorted}ending` : ""}`}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 text-xs font-medium hover:text-foreground",
        align === "right" && "ml-auto",
      )}
    >
      {label}
      {sorted === "asc" ? (
        <ArrowUpIcon className="size-3.5" />
      ) : sorted === "desc" ? (
        <ArrowDownIcon className="size-3.5" />
      ) : (
        <ArrowUpDownIcon className="size-3.5 opacity-40" />
      )}
    </button>
  );
}

export function PerformanceLabV2({
  results,
  signalHorizonResults,
  statuses,
  validations,
}: {
  results: BenchmarkResult[];
  signalHorizonResults: SignalHorizonBenchmarkResult[];
  statuses: BenchmarkEvaluationStatus[];
  validations: ValidationRun[];
}) {
  const methods = React.useMemo(
    () =>
      [...new Set(results.map((row) => row.benchmark_method_version || "legacy_vol252d_v1"))]
        .sort((left, right) => {
          if (left === right) return 0;
          return left === "tenor_matched_v2" ? -1 : 1;
        }),
    [results],
  );
  const [method, setMethod] = React.useState(methods[0] ?? "tenor_matched_v2");
  const [pair, setPair] = React.useState("all");
  const [tenor, setTenor] = React.useState("all");
  const [scope, setScope] = React.useState<Scope>("canonical");
  const [model, setModel] = React.useState("all");
  const [prompt, setPrompt] = React.useState("all");
  const [runSource, setRunSource] = React.useState("all");
  const [memoryScope, setMemoryScope] = React.useState<MemoryScope>("all");
  const [regime, setRegime] = React.useState("all");
  const hasCanonical = results.some((row) => row.is_canonical);
  const activeMethod = methods.includes(method) ? method : (methods[0] ?? method);
  const validationById = React.useMemo(
    () => new Map(validations.map((run) => [run.id, run])),
    [validations],
  );
  const matchesMetadata = React.useCallback(
    (validationRunId: string | null) => {
      const run = validationRunId ? validationById.get(validationRunId) : undefined;
      if (!run) {
        return model === "all" && prompt === "all" && runSource === "all" && memoryScope === "all" && regime === "all";
      }
      const hasMemory = run.prior_validation_context.item_count > 0;
      return (
        (model === "all" || run.model_name === model) &&
        (prompt === "all" || run.prompt_version === prompt) &&
        (runSource === "all" || run.run_source === runSource) &&
        (regime === "all" || run.result.deterministic_regime === regime) &&
        (memoryScope === "all" || (memoryScope === "with_memory" ? hasMemory : !hasMemory))
      );
    },
    [memoryScope, model, prompt, regime, runSource, validationById],
  );

  const filtered = React.useMemo(
    () =>
      results.filter((row) => {
        const rowMethod = row.benchmark_method_version || "legacy_vol252d_v1";
        return (
          rowMethod === activeMethod &&
          (scope === "all" || !hasCanonical || row.is_canonical) &&
          (pair === "all" || row.pair_code === pair) &&
          (tenor === "all" || row.tenor_key === tenor) &&
          matchesMetadata(row.llm_validation_run_id)
        );
      }),
    [activeMethod, hasCanonical, matchesMetadata, pair, results, scope, tenor],
  );

  const filteredSignal = React.useMemo(
    () =>
      signalHorizonResults.filter((row) => {
        const rowMethod = row.benchmark_method_version || "legacy_vol252d_v1";
        return (
          rowMethod === activeMethod &&
          (scope === "all" || !hasCanonical || row.is_canonical) &&
          (pair === "all" || row.pair_code === pair) &&
          (tenor === "all" || row.tenor_key === tenor) &&
          matchesMetadata(row.llm_validation_run_id)
        );
      }),
    [activeMethod, hasCanonical, matchesMetadata, pair, scope, signalHorizonResults, tenor],
  );

  const filteredStatuses = statuses.filter(
    (row) =>
      row.benchmark_method_version === activeMethod &&
      (scope === "all" || !hasCanonical || row.is_canonical) &&
      (pair === "all" || row.pair_code === pair) &&
      (tenor === "all" || row.tenor_key === tenor) &&
      matchesMetadata(row.llm_validation_run_id),
  );
  const quantMae = average(filtered.map((row) => row.quant_abs_error));
  const llmMae = average(filtered.map((row) => row.llm_abs_error));
  const maeReduction = quantMae ? (quantMae - llmMae) / quantMae : 0;
  const quantBias = average(filtered.map((row) => row.quant_implied_vol - row.realized_vol));
  const llmBias = average(filtered.map((row) => row.llm_implied_vol - row.realized_vol));
  const quantQlike = average(filtered.map((row) => qlikeLoss(row.quant_implied_vol, row.realized_vol)));
  const llmQlike = average(filtered.map((row) => qlikeLoss(row.llm_implied_vol, row.realized_vol)));
  const qlikeLift = quantQlike - llmQlike;
  const quantUndercoverage = filtered.length
    ? filtered.filter((row) => row.quant_undercovered).length / filtered.length
    : 0;
  const llmUndercoverage = filtered.length
    ? filtered.filter((row) => row.llm_undercovered).length / filtered.length
    : 0;
  const directionAccuracy = balancedDirectionAccuracy(filtered);
  const alwaysDecrease = filtered.length
    ? filtered.filter((row) => row.realized_vol < row.quant_implied_vol * 0.95).length /
      filtered.length
    : 0;
  const interval = clusterInterval(filtered);

  const chartRows = TENORS.map((key) => {
    const rows = filtered.filter((row) => row.tenor_key === key);
    return {
      tenor: TENOR_LABELS[key],
      quant: average(rows.map((row) => row.quant_abs_error)),
      llm: average(rows.map((row) => row.llm_abs_error)),
      lift: average(rows.map((row) => row.llm_lift)),
      count: rows.length,
    };
  }).filter((row) => row.count > 0);

  const experimentRuns = React.useMemo(
    () => validations.filter((run) => run.experiment_id),
    [validations],
  );
  const [experimentPair, setExperimentPair] = React.useState("all");
  const [experimentVariant, setExperimentVariant] = React.useState("all");
  const [experimentSearch, setExperimentSearch] = React.useState("");
  const [experimentFromDate, setExperimentFromDate] = React.useState<Date>();
  const [experimentToDate, setExperimentToDate] = React.useState<Date>();
  const experimentPairs = React.useMemo(
    () => [...new Set(experimentRuns.map((run) => run.pair_code))].sort(),
    [experimentRuns],
  );
  const experimentVariants = React.useMemo(
    () =>
      [
        ...new Set(
          experimentRuns
            .map((run) => run.experiment_variant)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
    [experimentRuns],
  );
  const experimentDateBounds = React.useMemo(() => {
    const dates = experimentRuns
      .map(validationAsOfTime)
      .filter((value): value is Date => Boolean(value));
    if (dates.length === 0) return {};
    return {
      min: new Date(Math.min(...dates.map((value) => value.getTime()))),
      max: new Date(Math.max(...dates.map((value) => value.getTime()))),
    };
  }, [experimentRuns]);
  const experimentRows = React.useMemo(() => {
    const normalizedSearch = experimentSearch.trim().toLowerCase();
    const from = experimentFromDate
      ? new Date(
          experimentFromDate.getFullYear(),
          experimentFromDate.getMonth(),
          experimentFromDate.getDate(),
        )
      : null;
    const to = experimentToDate
      ? new Date(
          experimentToDate.getFullYear(),
          experimentToDate.getMonth(),
          experimentToDate.getDate(),
          23,
          59,
          59,
          999,
        )
      : null;
    return experimentRuns.filter((run) => {
      const asOf = validationAsOfTime(run);
      const searchable = [
        run.experiment_id,
        run.research_brief_hash,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        (experimentPair === "all" || run.pair_code === experimentPair) &&
        (experimentVariant === "all" ||
          run.experiment_variant === experimentVariant) &&
        (!normalizedSearch || searchable.includes(normalizedSearch)) &&
        (!from || (asOf && asOf >= from)) &&
        (!to || (asOf && asOf <= to))
      );
    });
  }, [
    experimentFromDate,
    experimentPair,
    experimentRuns,
    experimentSearch,
    experimentToDate,
    experimentVariant,
  ]);
  const hasExperimentFilters =
    experimentPair !== "all" ||
    experimentVariant !== "all" ||
    Boolean(experimentSearch.trim()) ||
    Boolean(experimentFromDate) ||
    Boolean(experimentToDate);
  const experimentIds = uniqueCount(experimentRuns, (run) => run.experiment_id ?? run.id);
  const matchedExperiments = new Map<string, Set<string>>();
  for (const run of experimentRuns) {
    const variants = matchedExperiments.get(run.experiment_id ?? "") ?? new Set<string>();
    if (run.experiment_variant) variants.add(run.experiment_variant);
    matchedExperiments.set(run.experiment_id ?? "", variants);
  }
  const completePairs = [...matchedExperiments.values()].filter(
    (variants) => variants.has("memory_off") && variants.has("memory_on"),
  ).length;

  const pairs = [...new Set(results.map((row) => row.pair_code))].sort();
  const models = [...new Set(validations.map((run) => run.model_name).filter(Boolean))].sort();
  const prompts = [
    ...new Set(
      validations
        .map((run) => run.prompt_version)
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort();
  const runSources = [...new Set(validations.map((run) => run.run_source))].sort();
  const regimes = [...new Set(validations.map((run) => run.result.deterministic_regime))].sort();
  const selectedRuns = [
    ...new Set(
      filtered
        .map((row) => row.llm_validation_run_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ]
    .map((id) => validationById.get(id))
    .filter((run): run is ValidationRun => Boolean(run));
  const decreaseShare = selectedRuns.length
    ? selectedRuns.filter((run) => run.trend_adjustment_direction === "decrease").length /
      selectedRuns.length
    : 0;
  const flaggedRuns = selectedRuns.filter(
    (run) => run.result.output_quality_flags.length > 0,
  ).length;
  const health = {
    scored: filteredStatuses.filter((row) => row.status === "scored").length,
    pending: filteredStatuses.filter((row) => row.status === "pending").length,
    invalid: filteredStatuses.filter((row) => row.status === "invalid").length,
    notApplicable: filteredStatuses.filter((row) => row.status === "not_applicable").length,
    rolled: filtered.filter((row) => row.maturity_rolled).length,
  };
  const [outcomeSorting, setOutcomeSorting] = React.useState<SortingState>([
    { id: "maturity_date", desc: true },
  ]);
  const [outcomePair, setOutcomePair] = React.useState("all");
  const [outcomeTenor, setOutcomeTenor] = React.useState("all");
  const [outcomeFromDate, setOutcomeFromDate] = React.useState<Date>();
  const [outcomeFromTime, setOutcomeFromTime] = React.useState("00:00");
  const [outcomeToDate, setOutcomeToDate] = React.useState<Date>();
  const [outcomeToTime, setOutcomeToTime] = React.useState("23:59");
  const outcomePairs = React.useMemo(
    () => [...new Set(filtered.map((row) => row.pair_code))].sort(),
    [filtered],
  );
  const outcomeTenors = React.useMemo(
    () =>
      TENORS.filter((key) =>
        filtered.some((row) => row.tenor_key === key),
      ),
    [filtered],
  );
  const outcomeDateBounds = React.useMemo(() => {
    const dates = filtered
      .map(benchmarkEvaluationTime)
      .filter((value): value is Date => Boolean(value));
    if (dates.length === 0) return {};
    return {
      min: new Date(Math.min(...dates.map((value) => value.getTime()))),
      max: new Date(Math.max(...dates.map((value) => value.getTime()))),
    };
  }, [filtered]);
  const outcomeRows = React.useMemo(() => {
    const from = outcomeFromDate
      ? applyTime(outcomeFromDate, outcomeFromTime)
      : null;
    const to = outcomeToDate ? applyTime(outcomeToDate, outcomeToTime) : null;
    return filtered.filter((row) => {
      const evaluatedAt = benchmarkEvaluationTime(row);
      return (
        (outcomePair === "all" || row.pair_code === outcomePair) &&
        (outcomeTenor === "all" || row.tenor_key === outcomeTenor) &&
        (!from || (evaluatedAt && evaluatedAt >= from)) &&
        (!to || (evaluatedAt && evaluatedAt <= to))
      );
    });
  }, [
    filtered,
    outcomeFromDate,
    outcomeFromTime,
    outcomePair,
    outcomeTenor,
    outcomeToDate,
    outcomeToTime,
  ]);
  const hasOutcomeFilters =
    outcomePair !== "all" ||
    outcomeTenor !== "all" ||
    Boolean(outcomeFromDate) ||
    Boolean(outcomeToDate);
  const outcomeColumns = React.useMemo<ColumnDef<BenchmarkResult>[]>(
    () => [
      {
        accessorKey: "pair_code",
        header: ({ column }) => (
          <SortHeader
            label="Pair"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono font-medium">{row.original.pair_code}</span>
        ),
      },
      {
        accessorKey: "tenor_key",
        header: ({ column }) => (
          <SortHeader
            label="Tenor"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
        cell: ({ row }) => TENOR_LABELS[row.original.tenor_key],
      },
      {
        accessorKey: "maturity_date",
        header: ({ column }) => (
          <SortHeader
            label="Declared"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
      },
      {
        id: "evaluation_market_date",
        accessorFn: (row) => row.evaluation_market_date ?? row.maturity_date,
        header: ({ column }) => (
          <SortHeader
            label="Evaluated"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
        cell: ({ row }) => (
          <>
            {row.original.evaluation_market_date ?? row.original.maturity_date}
            {row.original.maturity_rolled ? " · rolled" : ""}
          </>
        ),
      },
      {
        accessorKey: "quant_implied_vol",
        header: ({ column }) => (
          <SortHeader
            label="Quant forecast"
            align="right"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono">
            {formatVol(row.original.quant_implied_vol)}
          </div>
        ),
      },
      {
        accessorKey: "llm_implied_vol",
        header: ({ column }) => (
          <SortHeader
            label="LLM forecast"
            align="right"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono">
            {formatVol(row.original.llm_implied_vol)}
          </div>
        ),
      },
      {
        accessorKey: "realized_vol",
        header: ({ column }) => (
          <SortHeader
            label="Realized"
            align="right"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono">
            {formatVol(row.original.realized_vol)}
          </div>
        ),
      },
      {
        accessorKey: "quant_abs_error",
        header: ({ column }) => (
          <SortHeader
            label="Quant error"
            align="right"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono">
            {formatVol(row.original.quant_abs_error)}
          </div>
        ),
      },
      {
        accessorKey: "llm_abs_error",
        header: ({ column }) => (
          <SortHeader
            label="LLM error"
            align="right"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono">
            {formatVol(row.original.llm_abs_error)}
          </div>
        ),
      },
      {
        accessorKey: "llm_lift",
        header: ({ column }) => (
          <SortHeader
            label="Lift"
            align="right"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
        cell: ({ row }) => (
          <div
            className={cn(
              "text-right font-mono",
              row.original.llm_lift >= 0 ? "text-emerald-500" : "text-red-500",
            )}
          >
            {formatVol(row.original.llm_lift)}
          </div>
        ),
      },
      {
        accessorKey: "llm_direction",
        header: ({ column }) => (
          <SortHeader
            label="Direction"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
      },
    ],
    [],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const outcomeTable = useReactTable({
    data: outcomeRows,
    columns: outcomeColumns,
    state: { sorting: outcomeSorting },
    onSortingChange: setOutcomeSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });
  const [experimentSorting, setExperimentSorting] = React.useState<SortingState>([
    { id: "as_of_date", desc: true },
  ]);
  const experimentColumns = React.useMemo<ColumnDef<ValidationRun>[]>(
    () => [
      {
        accessorKey: "experiment_id",
        header: ({ column }) => (
          <SortHeader
            label="Experiment"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.experiment_id}</span>
        ),
      },
      {
        accessorKey: "pair_code",
        header: ({ column }) => (
          <SortHeader
            label="Pair"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono font-medium">{row.original.pair_code}</span>
        ),
      },
      {
        accessorKey: "experiment_variant",
        header: ({ column }) => (
          <SortHeader
            label="Variant"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
      },
      {
        accessorKey: "as_of_date",
        header: ({ column }) => (
          <SortHeader
            label="As of"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
      },
      {
        accessorKey: "trend_adjustment_pct",
        header: ({ column }) => (
          <SortHeader
            label="Adjustment"
            align="right"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono">
            {formatPercent(row.original.trend_adjustment_pct ?? 0)}
          </div>
        ),
      },
      {
        accessorKey: "research_brief_hash",
        header: ({ column }) => (
          <SortHeader
            label="Brief hash"
            sorted={column.getIsSorted()}
            onClick={column.getToggleSortingHandler()!}
          />
        ),
        cell: ({ row }) => (
          <span
            className="block max-w-[200px] truncate font-mono text-xs"
            title={row.original.research_brief_hash ?? undefined}
          >
            {row.original.research_brief_hash}
          </span>
        ),
      },
    ],
    [],
  );

  const experimentTable = useReactTable({
    data: experimentRows,
    columns: experimentColumns,
    state: { sorting: experimentSorting },
    onSortingChange: setExperimentSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  return (
    <div className="space-y-5">
      <section className="border-y bg-card/30">
        <div className="flex flex-wrap items-end gap-3 px-4 py-3">
          <div className="mr-auto">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Evaluation cohort</p>
            <p className="mt-1 text-sm">One method and one canonical production run per pair/date by default.</p>
          </div>
          <Select value={activeMethod} onValueChange={setMethod}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>{methods.map((item) => <SelectItem key={item} value={item}>{methodLabel(item)}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={pair} onValueChange={setPair}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="All pairs" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All pairs</SelectItem>{pairs.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={tenor} onValueChange={setTenor}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="All tenors" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All tenors</SelectItem>{TENORS.map((item) => <SelectItem key={item} value={item}>{TENOR_LABELS[item]}</SelectItem>)}</SelectContent>
          </Select>
          <ToggleGroup type="single" value={scope} onValueChange={(value) => value && setScope(value as Scope)} variant="outline">
            <ToggleGroupItem value="canonical">Canonical</ToggleGroupItem>
            <ToggleGroupItem value="all">All runs</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="grid gap-2 border-t px-4 py-3 sm:grid-cols-2 lg:grid-cols-5">
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="w-full min-w-0" title={model === "all" ? "All scorer models" : model}><SelectValue placeholder="All scorer models" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All scorer models</SelectItem>{models.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={prompt} onValueChange={setPrompt}>
            <SelectTrigger className="w-full min-w-0" title={prompt === "all" ? "All prompt versions" : prompt}><SelectValue placeholder="All prompt versions" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All prompt versions</SelectItem>{prompts.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={memoryScope} onValueChange={(value) => setMemoryScope(value as MemoryScope)}>
            <SelectTrigger className="w-full min-w-0"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All memory modes</SelectItem><SelectItem value="with_memory">Prior reads used</SelectItem><SelectItem value="without_memory">No prior reads</SelectItem></SelectContent>
          </Select>
          <Select value={runSource} onValueChange={setRunSource}>
            <SelectTrigger className="w-full min-w-0"><SelectValue placeholder="All run sources" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All run sources</SelectItem>{runSources.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={regime} onValueChange={setRegime}>
            <SelectTrigger className="w-full min-w-0"><SelectValue placeholder="All regimes" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All regimes</SelectItem>{regimes.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </section>

      <section className="grid grid-cols-2 border-y bg-card/20 md:grid-cols-4 xl:grid-cols-8">
        <Metric label="Quant MAE" value={filtered.length ? formatVol(quantMae) : "--"} hint="Mean absolute volatility error" />
        <Metric label="LLM MAE" value={filtered.length ? formatVol(llmMae) : "--"} hint="Shadow overlay error" />
        <Metric label="MAE reduction" value={filtered.length ? formatPercent(maeReduction) : "--"} hint="Positive means LLM improved" />
        <Metric label="QLIKE lift" value={filtered.length ? qlikeLift.toFixed(3) : "--"} hint="Positive means better variance calibration" />
        <Metric label="Balanced direction" value={filtered.length ? formatPercent(directionAccuracy) : "--"} hint={`Always-decrease baseline ${formatPercent(alwaysDecrease)}`} />
        <Metric label="Undercoverage Δ" value={filtered.length ? formatPercent(llmUndercoverage - quantUndercoverage) : "--"} hint="Negative means LLM undercovered less often" />
        <Metric label="Quant bias" value={filtered.length ? formatVol(quantBias) : "--"} hint="Positive means overforecast" />
        <Metric label="LLM bias" value={filtered.length ? formatVol(llmBias) : "--"} hint="Positive means overforecast" />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="border p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <div><h2 className="text-base font-semibold">Fixed-tenor forecast error</h2><p className="text-sm text-muted-foreground">Quant and LLM error by exposure tenor</p></div>
            <span className="font-mono text-xs text-muted-foreground">{filtered.length} rows · {uniqueCount(filtered, (row) => row.llm_validation_run_id ?? row.id)} runs</span>
          </div>
          <ChartContainer config={{ quant: { label: "Quant", color: "var(--chart-4)" }, llm: { label: "LLM", color: "var(--chart-1)" } }} className="h-[280px] w-full">
            <BarChart data={chartRows}><CartesianGrid vertical={false} /><XAxis dataKey="tenor" tickLine={false} axisLine={false} /><YAxis tickFormatter={(value) => `${(Number(value) * 100).toFixed(0)}`} width={34} tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent formatter={(value) => formatVol(Number(value))} />} /><Bar dataKey="quant" fill="var(--color-quant)" radius={3} /><Bar dataKey="llm" fill="var(--color-llm)" radius={3} /></BarChart>
          </ChartContainer>
        </div>
        <div className="border p-4">
          <h2 className="text-base font-semibold">Cohort integrity</h2>
          <p className="text-sm text-muted-foreground">Independent samples and evaluator health</p>
          <dl className="mt-4 divide-y text-sm">
            {[
              ["Validation runs", uniqueCount(filtered, (row) => row.llm_validation_run_id ?? row.id)],
              ["Pair/date observations", uniqueCount(filtered, (row) => `${row.pair_code}:${row.as_of_date}`)],
              ["Market dates", uniqueCount(filtered, (row) => row.as_of_date)],
              ["Scored candidates", health.scored || filtered.length],
              ["Pending candidates", health.pending],
              ["Invalid candidates", health.invalid],
              ["Not applicable", health.notApplicable],
              ["Rolled maturities", health.rolled],
            ].map(([label, value]) => <div key={String(label)} className="flex justify-between py-2.5"><dt className="text-muted-foreground">{label}</dt><dd className="font-mono font-medium">{value}</dd></div>)}
          </dl>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className={cn("border p-2", decreaseShare > 0.8 && "border-amber-500/40 bg-amber-500/5")}>
              <p className="text-muted-foreground">Decrease calls</p>
              <p className="mt-1 font-mono text-base">{formatPercent(decreaseShare)}</p>
            </div>
            <div className={cn("border p-2", flaggedRuns > 0 && "border-amber-500/40 bg-amber-500/5")}>
              <p className="text-muted-foreground">Quality-flagged runs</p>
              <p className="mt-1 font-mono text-base">{flaggedRuns}</p>
            </div>
          </div>
          <div className={cn("mt-4 border-l-2 px-3 py-2 text-sm", interval && interval.low > 0 ? "border-emerald-500 bg-emerald-500/5" : "border-amber-500 bg-amber-500/5")}>
            {interval ? `Approximate date-clustered 95% lift interval: ${formatVol(interval.low)} to ${formatVol(interval.high)}.` : "At least two independent market dates are needed for an uncertainty interval."}
          </div>
        </div>
      </section>

      <section className="border">
        <div className="border-b px-4 py-3"><h2 className="text-base font-semibold">Declared signal-life consistency</h2><p className="text-sm text-muted-foreground">Short-window overlay comparison, not long-tenor forecast accuracy</p></div>
        <div className="grid grid-cols-2 md:grid-cols-4">
          <Metric label="Independent runs" value={String(uniqueCount(filteredSignal, (row) => row.llm_validation_run_id ?? row.id))} hint={`${filteredSignal.length} correlated tenor rows`} />
          <Metric label="LLM outperformed" value={filteredSignal.length ? formatPercent(filteredSignal.filter((row) => row.llm_outperformed_quant ?? row.signal_still_valid).length / filteredSignal.length) : "--"} hint="Equal or lower error than quant" />
          <Metric label="Mean lift" value={filteredSignal.length ? formatVol(average(filteredSignal.map((row) => row.llm_lift))) : "--"} hint="During declared signal life" />
          <Metric label="Memory reads" value={filteredSignal.length ? average(filteredSignal.map((row) => row.memory_item_count)).toFixed(1) : "--"} hint="Prior validations used per row" />
        </div>
      </section>

      <section className="border">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">Memory A/B collection</h2>
            <p className="text-sm text-muted-foreground">
              Same snapshot, model, and frozen research brief; only memory changes
            </p>
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {hasExperimentFilters
              ? `${experimentRows.length} of ${experimentRuns.length} runs`
              : `${experimentRuns.length} runs`}{" "}
            · {completePairs} complete pairs · {experimentIds} experiments
          </span>
        </div>
        {experimentRuns.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">
            The paired experiment begins after the new Prefect deployment is applied.
          </p>
        ) : (
          <>
            <div className="border-b bg-muted/15 px-4 py-3">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Memory collection filters
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Find paired experiment runs without changing benchmark charts or KPIs.
                  </p>
                </div>
                {hasExperimentFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setExperimentPair("all");
                      setExperimentVariant("all");
                      setExperimentSearch("");
                      setExperimentFromDate(undefined);
                      setExperimentToDate(undefined);
                      experimentTable.setPageIndex(0);
                    }}
                  >
                    <XIcon data-icon="inline-start" />
                    Clear filters
                  </Button>
                )}
              </div>
              <div className="grid items-end gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-[160px_160px_minmax(220px,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-[11px] font-medium uppercase text-muted-foreground">
                    Currency pair
                  </span>
                  <Select
                    value={experimentPair}
                    onValueChange={(value) => {
                      setExperimentPair(value);
                      experimentTable.setPageIndex(0);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All pairs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all">All pairs</SelectItem>
                        {experimentPairs.map((value) => (
                          <SelectItem key={value} value={value}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-[11px] font-medium uppercase text-muted-foreground">
                    Memory variant
                  </span>
                  <Select
                    value={experimentVariant}
                    onValueChange={(value) => {
                      setExperimentVariant(value);
                      experimentTable.setPageIndex(0);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All variants" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all">All variants</SelectItem>
                        {experimentVariants.map((value) => (
                          <SelectItem key={value} value={value}>
                            {value === "memory_on"
                              ? "Memory on"
                              : value === "memory_off"
                                ? "Memory off"
                                : value}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex min-w-0 flex-col gap-1.5 xl:col-span-2 2xl:col-span-1">
                  <span className="text-[11px] font-medium uppercase text-muted-foreground">
                    Experiment or brief
                  </span>
                  <Input
                    value={experimentSearch}
                    onChange={(event) => {
                      setExperimentSearch(event.target.value);
                      experimentTable.setPageIndex(0);
                    }}
                    placeholder="Search ID or brief hash"
                    className="h-10 font-mono text-xs"
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1.5 xl:col-span-2 2xl:col-span-1">
                  <span className="text-[11px] font-medium uppercase text-muted-foreground">
                    As of from
                  </span>
                  <DatePickerNaturalLanguage
                    value={experimentFromDate}
                    min={experimentDateBounds.min}
                    max={experimentToDate ?? experimentDateBounds.max}
                    onChange={(value) => {
                      setExperimentFromDate(value);
                      experimentTable.setPageIndex(0);
                    }}
                    placeholder="e.g. two weeks ago"
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1.5 xl:col-span-2 2xl:col-span-1">
                  <span className="text-[11px] font-medium uppercase text-muted-foreground">
                    As of to
                  </span>
                  <DatePickerNaturalLanguage
                    value={experimentToDate}
                    min={experimentFromDate ?? experimentDateBounds.min}
                    max={experimentDateBounds.max}
                    onChange={(value) => {
                      setExperimentToDate(value);
                      experimentTable.setPageIndex(0);
                    }}
                    placeholder="e.g. today"
                  />
                </div>
              </div>
            </div>
            <Table className="min-w-[880px]">
              <TableHeader>
                {experimentTable.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="hover:bg-transparent">
                    {headerGroup.headers.map((header) => (
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
                {experimentTable.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={experimentColumns.length}
                      className="h-24 text-center text-sm text-muted-foreground"
                    >
                      No memory experiment runs match the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  experimentTable.getRowModel().rows.map((row) => (
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
                )}
              </TableBody>
            </Table>
            <TablePagination
              table={experimentTable}
              itemLabel="experiment runs"
              pageSizeOptions={[10, 20, 50]}
            />
          </>
        )}
      </section>

      <section className="border">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">Matured outcome tape</h2>
            <p className="text-sm text-muted-foreground">
              Row-level forecast errors summarized in the chart above
            </p>
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {hasOutcomeFilters
              ? `${outcomeRows.length} of ${filtered.length}`
              : filtered.length}{" "}
            outcomes
          </span>
        </div>
        <div className="border-b bg-muted/15 px-4 py-3">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Outcome table filters
              </p>
              <p className="text-xs text-muted-foreground">
                Narrow the tape without changing the chart cohort.
              </p>
            </div>
            {hasOutcomeFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setOutcomePair("all");
                  setOutcomeTenor("all");
                  setOutcomeFromDate(undefined);
                  setOutcomeFromTime("00:00");
                  setOutcomeToDate(undefined);
                  setOutcomeToTime("23:59");
                  outcomeTable.setPageIndex(0);
                }}
              >
                <XIcon data-icon="inline-start" />
                Clear filters
              </Button>
            )}
          </div>
          <div className="grid items-end gap-3 md:grid-cols-2 2xl:grid-cols-[160px_140px_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-medium uppercase text-muted-foreground">
                Currency pair
              </span>
              <Select
                value={outcomePair}
                onValueChange={(value) => {
                  setOutcomePair(value);
                  outcomeTable.setPageIndex(0);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All pairs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All pairs</SelectItem>
                    {outcomePairs.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-medium uppercase text-muted-foreground">
                Tenor
              </span>
              <Select
                value={outcomeTenor}
                onValueChange={(value) => {
                  setOutcomeTenor(value);
                  outcomeTable.setPageIndex(0);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All tenors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All tenors</SelectItem>
                    {outcomeTenors.map((value) => (
                      <SelectItem key={value} value={value}>
                        {TENOR_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-medium uppercase text-muted-foreground">
                Evaluated from
              </span>
              <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_7.5rem]">
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
                <TimePickerIcon
                  value={outcomeFromTime}
                  onChange={(value) => {
                    setOutcomeFromTime(value);
                    outcomeTable.setPageIndex(0);
                  }}
                />
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-medium uppercase text-muted-foreground">
                Evaluated to
              </span>
              <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_7.5rem]">
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
                <TimePickerIcon
                  value={outcomeToTime}
                  onChange={(value) => {
                    setOutcomeToTime(value);
                    outcomeTable.setPageIndex(0);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
        <Table className="min-w-[1280px]">
          <TableHeader>
            {outcomeTable.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
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
            {outcomeTable.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={outcomeColumns.length}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  No matured outcomes match the selected cohort.
                </TableCell>
              </TableRow>
            ) : (
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
            )}
          </TableBody>
        </Table>
        <TablePagination
          table={outcomeTable}
          itemLabel="outcomes"
          pageSizeOptions={[10, 20, 50]}
        />
      </section>
    </div>
  );
}
