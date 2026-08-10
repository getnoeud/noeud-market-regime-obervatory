import * as React from "react";

export function chartTooltipColor(item: unknown) {
  if (item && typeof item === "object") {
    if ("color" in item && typeof item.color === "string") return item.color;
    if (
      "payload" in item &&
      item.payload &&
      typeof item.payload === "object" &&
      "fill" in item.payload &&
      typeof item.payload.fill === "string"
    ) {
      return item.payload.fill;
    }
  }
  return "var(--muted-foreground)";
}

export function ChartTooltipRow({
  color,
  label,
  value,
}: {
  color: string;
  label: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <span className="flex w-full min-w-44 items-center gap-2">
      <span
        aria-hidden="true"
        className="size-2.5 shrink-0 rounded-[2px]"
        style={{ backgroundColor: color }}
      />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-mono font-medium tabular-nums text-foreground">
        {value}
      </span>
    </span>
  );
}
