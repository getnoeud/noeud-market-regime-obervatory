import Link from "next/link";
import { ActivityIcon, ChartNoAxesCombinedIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function MaturityRiskViewSwitcher({
  active,
}: {
  active: "lab" | "surface";
}) {
  return (
    <div
      className="flex w-fit items-center gap-1 rounded-lg border bg-muted/30 p-1"
      aria-label="Maturity risk view"
    >
      <Button asChild variant={active === "lab" ? "secondary" : "ghost"} size="sm">
        <Link href="/maturity-risk">
          <ActivityIcon data-icon="inline-start" />
          Operational Lab
        </Link>
      </Button>
      <Button asChild variant={active === "surface" ? "secondary" : "ghost"} size="sm">
        <Link href="/maturity-risk/surface">
          <ChartNoAxesCombinedIcon data-icon="inline-start" />
          Surface Explorer
        </Link>
      </Button>
    </div>
  );
}
