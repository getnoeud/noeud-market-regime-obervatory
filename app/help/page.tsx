import { RegimeBadge } from "@/components/regime/badges";
import { SectionTitle } from "@/components/regime/primitives";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { REGIME_DESCRIPTIONS } from "@/lib/regime";

const REGIME_BANDS = [
  { regime: "CALM", range: "accel < 0.80", score: 1 },
  { regime: "NORMAL", range: "0.80 ≤ accel < 1.20", score: 2 },
  { regime: "ELEVATED", range: "1.20 ≤ accel < 1.80", score: 3 },
  { regime: "STRESSED", range: "1.80 ≤ accel < 2.50", score: 4 },
  { regime: "CRISIS", range: "accel ≥ 2.50", score: 5 },
] as const;

const METRICS = [
  {
    name: "Acceleration (accel vs 252d)",
    body: "Ratio of 30-day annualized volatility to 252-day annualized volatility. The single number that drives regime classification — it measures how fast volatility is building relative to its annual baseline.",
  },
  {
    name: "Volatility windows",
    body: "Annualized realized volatility computed over 7, 30, 60, 90, 180 and 252 trading-day lookbacks from log returns. Shorter windows react faster; longer windows define the baseline.",
  },
  {
    name: "Trend signals",
    body: "10d / 30d / 90d ratios of recent mean volatility to the prior equal-length window. RISING above 1.08, FALLING below 0.92, otherwise FLAT. The composite is STRONG_RISING / STRONG_FALLING / FLAT / MIXED.",
  },
  {
    name: "Term structure",
    body: "Tenor-matched annualized volatility blending the 30d front and 252d anchor by tenor weight, giving a vol estimate per hedge horizon (≤7d through >180d).",
  },
  {
    name: "Trend-aware multipliers",
    body: "Bounded [0.8x, 3.0x] tenor multipliers derived from acceleration plus a trend adjustment. Used to scale exposures by hedge horizon. The ≤14d bucket only takes upside trend adjustment.",
  },
  {
    name: "Historical VaR & fat tail",
    body: "99% historical value-at-risk from the 252-day distribution of absolute returns (1d, scaled to 30d), a parametric 30d VaR, and their ratio as a fat-tail indicator.",
  },
  {
    name: "Backtest validation",
    body: "Rolling 1-day VaR coverage versus the 99% target. PASS at or above target, ACCEPTABLE within 1.5pp, otherwise FAIL.",
  },
];

const PIPELINE = [
  { step: "1 · Retrieval", body: "perplexity/sonar gathers current market context (macro, central bank, currency-specific) and returns cited evidence." },
  { step: "2 · Memory", body: "The scorer receives compact same-pair validation context from the previous seven calendar days so today's view can react to what it said earlier." },
  { step: "3 · Scoring", body: "One or more scorer models independently judge whether external context supports the deterministic trend-aware multiplier read over the shared research brief and prior context." },
  { step: "4 · Horizon", body: "The final JSON includes how many days the LLM believes today's overlay remains useful before a fresh evidence read is required." },
  { step: "5 · Aggregation", body: "anthropic/claude-sonnet-4.5 aggregates the views using the research brief and citations as the factual anchor — not a majority vote." },
];

const BENCHMARK_METRICS = [
  {
    name: "Quant implied volatility",
    body: "The primary benchmark multiplies each tenor-matched volatility curve point by its deterministic trend-aware multiplier. The 14d point is variance-interpolated between 7d and 30d.",
  },
  {
    name: "LLM implied volatility",
    body: "The exact same tenor baseline multiplied by the LLM recommendation. Only the multiplier changes, so the comparison isolates the overlay decision.",
  },
  {
    name: "Realized forward volatility",
    body: "The annualized volatility that actually occurred between the validation date and the tenor maturity date.",
  },
  {
    name: "LLM lift",
    body: "Quant absolute error minus LLM absolute error. Positive lift means the LLM overlay was closer to the realized outcome.",
  },
  {
    name: "QLIKE lift",
    body: "Quant QLIKE loss minus LLM QLIKE loss on forecast variance. Positive is better. It penalizes poor variance calibration and severe underforecasting, so an always-lower overlay cannot rely on MAE alone.",
  },
  {
    name: "Direction hit",
    body: "Checks whether the LLM's increase, decrease, or hold call agreed with the matured realized volatility after a 5% tolerance band.",
  },
  {
    name: "Memory-backed lift",
    body: "Compares benchmark lift for validations that used prior same-pair context. This helps test whether rolling memory improves the overlay versus isolated daily reads.",
  },
  {
    name: "Signal horizon",
    body: "The LLM's expected useful life for today's overlay. The lab shows average signal life and front-tenor hit rates so the team can monitor whether short-lived calls mature correctly.",
  },
  {
    name: "Undercoverage",
    body: "Flags whether realized volatility exceeded the implied volatility level. Lower undercoverage can mean better risk protection, but may also imply more conservative hedging.",
  },
];

const PERFORMANCE_TABLE_FILTERS = [
  {
    title: "Memory A/B collection",
    scope: "Filters only the paired memory experiment table.",
    items: [
      ["Currency pair", "Show experiments for one FX pair."],
      ["Memory variant", "Compare memory-on or memory-off runs in isolation."],
      ["Experiment or brief", "Search a full or partial experiment ID or frozen research-brief hash."],
      ["As of from / to", "Restrict runs by the validation market date. The dates are inclusive."],
    ],
  },
  {
    title: "Matured outcome tape",
    scope: "Filters only matured benchmark rows; charts and headline KPIs keep their selected cohort.",
    items: [
      ["Currency pair", "Show matured outcomes for one FX pair."],
      ["Tenor", "Focus on one forecast horizon, from ≤14d through >180d."],
      ["Evaluated from / to", "Restrict rows by the timestamp when the benchmark was evaluated."],
      ["Time", "Refine either date boundary when several evaluator runs occurred on the same day."],
    ],
  },
] as const;

export default function HelpPage() {
  return (
    <>
      <SectionTitle description="How the deterministic engine reads the market, and how the LLM layer validates it.">
        Methodology
      </SectionTitle>

      <Tabs defaultValue="methodology" className="gap-4">
        <TabsList>
          <TabsTrigger value="methodology">Engine Methodology</TabsTrigger>
          <TabsTrigger value="validation">LLM Validation</TabsTrigger>
          <TabsTrigger value="performance">Performance Lab</TabsTrigger>
        </TabsList>

        <TabsContent value="methodology" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Regime Bands</CardTitle>
              <CardDescription>
                Regimes are classified purely from acceleration, the 30d / 252d volatility ratio.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-6">Regime</TableHead>
                    <TableHead>Acceleration band</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead className="px-6">Reading</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {REGIME_BANDS.map((b) => (
                    <TableRow key={b.regime}>
                      <TableCell className="px-6">
                        <RegimeBadge regime={b.regime} />
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {b.range}
                      </TableCell>
                      <TableCell className="font-mono">{b.score}</TableCell>
                      <TableCell className="px-6 text-sm text-muted-foreground">
                        {REGIME_DESCRIPTIONS[b.regime]}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {METRICS.map((m) => (
              <Card key={m.name}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{m.name}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-relaxed text-muted-foreground">
                  {m.body}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Data Source</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-muted-foreground">
              Prices are ingested daily from yfinance and normalized into per-pair daily closes. Sparse direct
              histories such as GBP/GHS are synthesized from liquid USD anchor legs, then overlaid with any direct
              quotes Yahoo provides. The deterministic engine reads stored prices, computes the snapshot, and persists
              it; the observatory reads snapshots, validation runs, provider runs, and benchmark rows through Supabase.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">LLM Validation Pipeline</CardTitle>
              <CardDescription>
                The intelligence layer validates the trend-aware multiplier ladder. It does not overwrite the deterministic snapshot.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              {PIPELINE.map((p) => (
                <div key={p.step} className="rounded-lg border p-4">
                  <div className="text-sm font-semibold">{p.step}</div>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {p.body}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Trend-Aware Focus</CardTitle>
              <CardDescription>
                The model receives the full deterministic payload, but its recommendation is centered on the multiplier ladder from 14d through 180d+.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-muted-foreground">
              The LLM reads recent market context over the configured lookback window, checks whether that context implies higher, lower, or stable volatility pressure, then returns its own recommended multiplier map beside the quant map. The UI shows both ladders side by side so the finance team can see exactly where the model agrees, tightens, or relaxes the deterministic trend-aware view.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Performance Benchmark</CardTitle>
              <CardDescription>
                Benchmark rows are scored only after enough future price data exists for the tenor window.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-muted-foreground">
              Each LLM validation freezes both multiplier ladders, the full tenor volatility curve, and the validation date. The primary evaluator waits for each tenor to mature, calculates realized forward volatility, and compares tenor-matched quant and LLM forecasts against what actually happened. The older 252d-anchor method remains available only as a diagnostic.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Signal-Life Benchmark</CardTitle>
              <CardDescription>
                The LLM declares one expected-valid-until date for the whole overlay.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-muted-foreground">
              The signal-horizon evaluator waits until that declared date matures, then checks whether the overlay helped during that short window across the multiplier ladder. This is a secondary consistency diagnostic. A three-day signal life does not prove a 90d or 180d forecast; only the corresponding matured fixed-tenor benchmark can do that.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Using Performance Lab Filters</CardTitle>
              <CardDescription>
                Global cohort controls and table filters have intentionally different scopes.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Use the controls at the top of Performance Lab when you want to
                recalculate charts, KPIs, and benchmark summaries. Use the filter
                bar attached to a table when you only want to find or inspect rows
                in that table. Table filters combine with AND logic, reset the
                table to page one, and update its row count and pagination.
              </p>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {PERFORMANCE_TABLE_FILTERS.map((group) => (
                  <div key={group.title} className="border p-4">
                    <h3 className="text-sm font-semibold">{group.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {group.scope}
                    </p>
                    <dl className="mt-3 divide-y text-sm">
                      {group.items.map(([name, body]) => (
                        <div key={name} className="grid gap-1 py-2.5 sm:grid-cols-[140px_1fr]">
                          <dt className="font-medium">{name}</dt>
                          <dd className="text-muted-foreground">{body}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Select <span className="font-medium text-foreground">Clear filters</span>{" "}
                to restore every row in that table. Sorting is applied after
                filtering, and the rows-per-page and page controls apply to the
                filtered result.
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {BENCHMARK_METRICS.map((m) => (
              <Card key={m.name}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{m.name}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-relaxed text-muted-foreground">
                  {m.body}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Automation</CardTitle>
              <CardDescription>
                The benchmark flow is deployed separately from daily ingestion, calculation, and LLM validation.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-muted-foreground">
              Prefect runs the fixed-tenor benchmark evaluator weekly by default. The signal-horizon evaluator runs Monday, Wednesday, and Friday at 09:00 Accra time because LLM signal lives can mature in only a few days. Both flows scan stored validation runs, write matured results to their benchmark tables, and leave fresh windows pending until their future prices exist.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
