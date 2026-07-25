"use client";

import type { Table } from "@tanstack/react-table";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Shared pagination footer for any TanStack table that has the pagination row model. */
export function TablePagination<T>({
  table,
  itemLabel = "rows",
  pageSizeOptions = [10, 20, 50, 100],
}: {
  table: Table<T>;
  itemLabel?: string;
  pageSizeOptions?: number[];
}) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const total = table.getFilteredRowModel().rows.length;
  const first = total === 0 ? 0 : pageIndex * pageSize + 1;
  const last = Math.min((pageIndex + 1) * pageSize, total);
  const pageCount = table.getPageCount() || 1;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
      <div className="text-xs text-muted-foreground" aria-live="polite">
        <span className="font-mono text-foreground">{first}–{last}</span> of{" "}
        <span className="font-mono text-foreground">{total}</span> {itemLabel}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Rows per page
          </span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger size="sm" className="w-[72px]" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {pageSizeOptions.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <span className="text-xs text-muted-foreground">Page</span>
          <Select
            value={String(pageIndex + 1)}
            onValueChange={(value) => table.setPageIndex(Number(value) - 1)}
          >
            <SelectTrigger size="sm" className="w-[64px]" aria-label="Jump to page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Array.from({ length: pageCount }, (_, index) => index + 1).map(
                  (page) => (
                    <SelectItem key={page} value={String(page)}>
                      {page}
                    </SelectItem>
                  ),
                )}
              </SelectGroup>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">of {pageCount}</span>
        </div>
        <Button
          variant="outline"
          size="icon-sm"
          className="hidden sm:inline-flex"
          onClick={() => table.firstPage()}
          disabled={!table.getCanPreviousPage()}
          aria-label="First page"
          title="First page"
        >
          <ChevronsLeftIcon />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          aria-label="Previous page"
          title="Previous page"
        >
          <ChevronLeftIcon />
        </Button>
        <span className="min-w-16 text-center text-xs text-muted-foreground tabular-nums md:hidden">
          {pageIndex + 1} / {pageCount}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          aria-label="Next page"
          title="Next page"
        >
          <ChevronRightIcon />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          className="hidden sm:inline-flex"
          onClick={() => table.lastPage()}
          disabled={!table.getCanNextPage()}
          aria-label="Last page"
          title="Last page"
        >
          <ChevronsRightIcon />
        </Button>
      </div>
    </div>
  );
}
