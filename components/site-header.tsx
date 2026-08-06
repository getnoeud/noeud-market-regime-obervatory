"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { DatabaseIcon, MoonIcon, SunIcon, TriangleAlertIcon } from "lucide-react";

import { PairSwitcher } from "@/components/regime/pair-switcher";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useDataSourceStatus } from "@/hooks/use-regime";
import { cn } from "@/lib/utils";

const TITLES: Record<string, string> = {
  pairs: "Pair Review",
  validation: "Validation Runs",
  performance: "Performance Lab",
  "maturity-risk": "Maturity Risk Lab",
  "data-health": "Data Health",
  help: "Help & Methodology",
};

export function SiteHeader() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const sourceQuery = useDataSourceStatus();

  const segments = pathname.split("/").filter(Boolean);
  const root = segments[0];
  const title = pathname === "/" ? "Overview" : (TITLES[root] ?? "Overview");

  // On a per-pair detail route, show the pair switcher in the header.
  const detail =
    root === "pairs" && segments[1]
      ? { pair: segments[1].toUpperCase(), basePath: "/pairs", preserveQuery: true }
      : null;

  return (
    <header className="sticky top-0 z-20 flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/85 backdrop-blur md:rounded-t-[14px]">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 h-4 data-vertical:self-auto" />
        <h1 className="text-sm font-medium md:text-base">{title}</h1>
        <div className="ml-auto flex items-center gap-2">
          {sourceQuery.data && (
            <span
              title={`${sourceQuery.data.source} · checked ${new Date(sourceQuery.data.checked_at).toLocaleString()}`}
              className={cn(
                "hidden items-center gap-1.5 rounded border px-2 py-1 font-mono text-[11px] uppercase sm:flex",
                sourceQuery.data.source === "supabase"
                  ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-600 dark:text-emerald-400"
                  : "border-amber-500/25 bg-amber-500/8 text-amber-700 dark:text-amber-300",
              )}
            >
              {sourceQuery.data.source === "supabase" ? (
                <DatabaseIcon className="size-3" />
              ) : (
                <TriangleAlertIcon className="size-3" />
              )}
              {sourceQuery.data.source}
              <span className="text-[10px] opacity-70">
                {new Date(sourceQuery.data.checked_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </span>
          )}
          {detail && (
            <React.Suspense fallback={null}>
              <PairSwitcher
                current={detail.pair}
                basePath={detail.basePath}
                preserveQuery={detail.preserveQuery}
              />
            </React.Suspense>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            <SunIcon className="size-4 scale-100 transition-transform dark:scale-0" />
            <MoonIcon className="absolute size-4 scale-0 transition-transform dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
