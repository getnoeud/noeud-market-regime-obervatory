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
  CheckCircle2Icon,
  DatabaseIcon,
  RefreshCwIcon,
  XCircleIcon,
} from "lucide-react";

import { TablePagination } from "@/components/regime/table-pagination";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatDate, formatDateTime } from "@/lib/format";
import type { ProviderRun } from "@/lib/types";
import { cn } from "@/lib/utils";

function StatusCell({ status }: { status: string }) {
  const ok = ["success", "succeeded", "skipped"].includes(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        ok
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25"
          : "bg-red-600/15 text-red-700 dark:text-red-300 border-red-600/25",
      )}
    >
      {ok ? <CheckCircle2Icon className="size-3" /> : <XCircleIcon className="size-3" />}
      {status}
    </span>
  );
}

function modeOf(run: ProviderRun): string {
  const detail = run.source_detail ?? {};
  if (!["success", "succeeded", "skipped"].includes(run.status)) {
    return String((detail as Record<string, unknown>).error ?? "—");
  }
  const mode = (detail as Record<string, unknown>).mode as string | undefined;
  const fetchMode = (detail as Record<string, unknown>).fetch_mode as string | undefined;
  const backfill = (detail as Record<string, unknown>).backfill_reason as string | undefined;
  const label = mode ?? fetchMode ?? "—";
  return backfill ? `${label} · ${backfill}` : label;
}

export function DataHealthCards({ runs }: { runs: ProviderRun[] }) {
  const succeeded = runs.filter((r) =>
    ["success", "succeeded", "skipped"].includes(r.status),
  ).length;
  const failed = runs.length - succeeded;
  const rows = runs.reduce((a, r) => a + r.row_count, 0);
  const backfills = runs.filter(
    (r) => (r.source_detail as Record<string, unknown> | null)?.backfill_reason,
  ).length;

  const cards = [
    { label: "Provider Runs", value: runs.length, icon: DatabaseIcon, hint: "Across all pairs (recent window)" },
    { label: "Succeeded", value: succeeded, icon: CheckCircle2Icon, hint: `${failed} failed` },
    { label: "Rows Ingested", value: rows.toLocaleString(), icon: RefreshCwIcon, hint: "Normalized daily price rows" },
    { label: "Backfills", value: backfills, icon: RefreshCwIcon, hint: "Insufficient-history repairs" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <c.icon className="size-3.5" /> {c.label}
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">{c.value}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">{c.hint}</CardContent>
        </Card>
      ))}
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
      onClick={onClick}
      className={cn("flex items-center gap-1 text-xs font-medium hover:text-foreground", align === "right" && "ml-auto")}
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

export function ProviderRunsTable({ runs }: { runs: ProviderRun[] }) {
  const [pair, setPair] = React.useState<string>("ALL");
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "completed_at", desc: true },
  ]);
  const pairs = React.useMemo(
    () => Array.from(new Set(runs.map((r) => r.pair_code))).sort(),
    [runs],
  );
  const data = React.useMemo(
    () => runs.filter((r) => pair === "ALL" || r.pair_code === pair),
    [runs, pair],
  );
  const providers = React.useMemo(
    () => Array.from(new Set(data.map((run) => run.provider_name))).sort(),
    [data],
  );

  const columns = React.useMemo<ColumnDef<ProviderRun>[]>(
    () => [
      {
        accessorKey: "pair_code",
        header: ({ column }) => <SortHeader label="Pair" sorted={column.getIsSorted()} onClick={column.getToggleSortingHandler()!} />,
        cell: ({ row }) => <span className="font-mono font-medium">{row.original.pair_code}</span>,
      },
      {
        accessorKey: "provider_name",
        header: () => <span className="text-xs font-medium">Provider</span>,
        enableSorting: false,
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.provider_name}</span>,
      },
      {
        accessorKey: "requested_at",
        header: ({ column }) => <SortHeader label="Requested" sorted={column.getIsSorted()} onClick={column.getToggleSortingHandler()!} />,
        cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.requested_at)}</span>,
      },
      {
        accessorKey: "completed_at",
        header: ({ column }) => <SortHeader label="Completed" sorted={column.getIsSorted()} onClick={column.getToggleSortingHandler()!} />,
        cell: ({ row }) => <span className="text-muted-foreground">{formatDateTime(row.original.completed_at)}</span>,
      },
      {
        accessorKey: "status",
        header: ({ column }) => <SortHeader label="Status" sorted={column.getIsSorted()} onClick={column.getToggleSortingHandler()!} />,
        cell: ({ row }) => <StatusCell status={row.original.status} />,
      },
      {
        accessorKey: "row_count",
        header: ({ column }) => <SortHeader label="Rows" align="right" sorted={column.getIsSorted()} onClick={column.getToggleSortingHandler()!} />,
        cell: ({ row }) => <div className="text-right font-mono tabular-nums">{row.original.row_count}</div>,
      },
      {
        id: "mode",
        header: () => <span className="text-xs font-medium">Mode</span>,
        enableSorting: false,
        cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{modeOf(row.original)}</span>,
      },
    ],
    [],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Provider Runs</CardTitle>
          <CardDescription>
            {providers.length ? providers.join(" + ") : "Market-data"} ingestion
            runs · {data.length} shown
          </CardDescription>
        </div>
        <Select value={pair} onValueChange={setPair}>
          <SelectTrigger size="sm" className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All pairs</SelectItem>
            {pairs.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((header) => (
                  <TableHead key={header.id} className="px-4">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-muted-foreground">
                  No provider runs found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-4 py-2.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination table={table} />
      </CardContent>
    </Card>
  );
}
