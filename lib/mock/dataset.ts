/**
 * Fixture dataset for the observatory, assembled from the TS regime engine port.
 *
 * Everything is deterministic (seeded per pair) and anchored to a fixed
 * as-of date so the demo is stable. The route handlers under `app/api/*`
 * read exclusively through the accessor functions at the bottom of this file,
 * so swapping to Supabase later means rewriting those handlers — nothing in
 * the UI layer changes.
 */
import {
  annualizedVol,
  buildPriceSeries,
  classifyRegime,
  classifyTrend,
  combineTrendSignals,
  hashSeed,
  histVar,
  HISTORICAL_VAR_30D_SCALER,
  HISTORICAL_VAR_LOOKBACK,
  logReturns,
  mulberry32,
  REGIME_LABELS,
  tenorMultipliers,
  termStructure,
  TREND_WINDOWS,
  VAR_COVERAGE_TARGET,
  VOLATILITY_WINDOWS,
} from "@/lib/mock/engine";
import type {
  BacktestStatus,
  BenchmarkResult,
  CompositeSignal,
  LLMCallRecord,
  MarketSentiment,
  MLMultiplierBenchmarkResult,
  MLMultiplierModel,
  MLMultiplierPrediction,
  ProviderRun,
  RawPriceObservation,
  RecommendedAction,
  RegimeHistoryPoint,
  RegimeLabel,
  RegimeSnapshot,
  ResearchEvidenceItem,
  SignalHorizonBenchmarkResult,
  TrendAdjustmentDirection,
  TrendSignal,
  ValidationResult,
  ValidationRun,
  ValidationStatus,
} from "@/lib/types";

// --- Anchor date & calendar ----------------------------------------------

const AS_OF = "2026-06-04";
const HISTORY_DAYS = 420; // enough for full 252d windows + trailing history
const HISTORY_WINDOW = 120; // business days exposed as history

function businessDaysBack(end: string, count: number): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${end}T00:00:00Z`);
  while (dates.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return dates.reverse();
}

const CALENDAR = businessDaysBack(AS_OF, HISTORY_DAYS);

// --- Currency + pair registry --------------------------------------------

/** Units of currency per 1 USD (a coarse, fictional 2026 snapshot). */
const USD_PER: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  GHS: 12.5,
  NGN: 1600,
  KES: 129,
  ZAR: 18.3,
};

const MAJORS = ["USD", "EUR", "GBP"];
const AFRICAN = ["GHS", "NGN", "KES", "ZAR"];

function buildPairCodes(): string[] {
  const directed = MAJORS.flatMap((b) => AFRICAN.map((q) => `${b}${q}`));
  const cross = AFRICAN.flatMap((b) =>
    AFRICAN.filter((q) => q !== b).map((q) => `${b}${q}`),
  );
  return [...directed, ...cross];
}

export const PAIR_CODES = buildPairCodes();

function displayPair(code: string): string {
  return `${code.slice(0, 3)}/${code.slice(3)}`;
}

function startRate(code: string): number {
  const base = code.slice(0, 3);
  const quote = code.slice(3);
  return USD_PER[quote] / USD_PER[base];
}

const HEDGE_DEFAULTS: Record<
  string,
  { fwd_cost_annual_pct: number; typical_bid_ask_spread: number; hedgeability_score: number; notes: string }
> = {
  USDGHS: { fwd_cost_annual_pct: 0.15, typical_bid_ask_spread: 0.015, hedgeability_score: 7, notes: "Forward contracts available, ~6% annualized cost" },
  EURGHS: { fwd_cost_annual_pct: 0.15, typical_bid_ask_spread: 0.014, hedgeability_score: 7, notes: "Forward contracts available, ~5% annualized cost" },
  GBPGHS: { fwd_cost_annual_pct: 0.15, typical_bid_ask_spread: 0.016, hedgeability_score: 6, notes: "Synthesized from anchor legs; forwards thinner" },
  USDNGN: { fwd_cost_annual_pct: 0.22, typical_bid_ask_spread: 0.02, hedgeability_score: 5, notes: "NAFEM window; forwards available but wider" },
  USDKES: { fwd_cost_annual_pct: 0.12, typical_bid_ask_spread: 0.012, hedgeability_score: 7, notes: "Reasonable forward liquidity" },
  USDZAR: { fwd_cost_annual_pct: 0.07, typical_bid_ask_spread: 0.006, hedgeability_score: 9, notes: "Deep, liquid market with tight spreads" },
};

function hedgeFor(code: string) {
  if (HEDGE_DEFAULTS[code]) return { currency_pair: displayPair(code), ...HEDGE_DEFAULTS[code] };
  // Reasonable defaults for the remaining crosses.
  const quote = code.slice(3);
  const score = quote === "ZAR" ? 8 : quote === "KES" ? 6 : quote === "GHS" ? 6 : 5;
  return {
    currency_pair: displayPair(code),
    fwd_cost_annual_pct: quote === "ZAR" ? 0.08 : 0.18,
    typical_bid_ask_spread: quote === "ZAR" ? 0.008 : 0.018,
    hedgeability_score: score,
    notes: "Cross synthesized from USD anchor legs; indicative hedge parameters",
  };
}

// --- Per-pair metric computation -----------------------------------------

type PairSeries = {
  code: string;
  prices: number[];
  returns: number[];
  vol30Series: number[];
  baseVolAnnual: number;
  stress: number;
};

function buildPairSeries(code: string): PairSeries {
  const seed = hashSeed(code);
  const rng = mulberry32(seed);
  // Frontier quotes are more volatile; ZAR is liquid; crosses inherit a mix.
  const quote = code.slice(3);
  const baseTable: Record<string, number> = { GHS: 0.1, NGN: 0.16, KES: 0.07, ZAR: 0.18 };
  const baseVolAnnual = (baseTable[quote] ?? 0.12) * (0.85 + rng() * 0.5);
  // Spread of stress factors so the grid covers CALM..CRISIS.
  const stress = 0.4 + rng() * 5.4;
  const drift = (rng() - 0.35) * 0.08;
  const prices = buildPriceSeries(seed, startRate(code), baseVolAnnual, drift, stress, HISTORY_DAYS);
  const returns = logReturns(prices);
  const vol30Series = prices.map((_, i) => annualizedVol(returns, 30, i));
  return { code, prices, returns, vol30Series, baseVolAnnual, stress };
}

function trendRatioAt(vol30: number[], window: number, index: number): number {
  const meanAt = (end: number) => {
    if (end + 1 < window) return NaN;
    const slice = vol30.slice(end - window + 1, end + 1).filter((v) => !Number.isNaN(v));
    if (slice.length < window) return NaN;
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  };
  const current = meanAt(index);
  const previous = meanAt(index - window);
  return current / previous;
}

type Metrics = {
  index: number;
  date: string;
  spot: number;
  prior: number;
  dayChange: number;
  dayChangePct: number;
  vols: Record<number, number>;
  trends: Record<number, number>;
  trendSignals: Record<number, TrendSignal>;
  acceleration: number;
  regime: RegimeLabel;
  regimeScore: number;
  composite: CompositeSignal;
  term: Record<string, number>;
  multipliers: Record<string, number>;
  histVar1d: number;
  histVar30d: number;
  parametricVar30d: number;
  fatTail: number;
};

function metricsAt(series: PairSeries, index: number): Metrics {
  const { prices, returns, vol30Series } = series;
  const vols: Record<number, number> = {};
  for (const w of VOLATILITY_WINDOWS) vols[w] = annualizedVol(returns, w, index);

  const trends: Record<number, number> = {};
  const trendSignals: Record<number, TrendSignal> = {};
  for (const w of TREND_WINDOWS) {
    const ratio = trendRatioAt(vol30Series, w, index);
    trends[w] = ratio;
    trendSignals[w] = classifyTrend(ratio);
  }

  const acceleration = vols[30] / vols[252];
  const [regime, regimeScore] = classifyRegime(acceleration);
  const term = termStructure(vols);
  const multipliers = tenorMultipliers(acceleration, trends);
  const histVar1d = histVar(returns, HISTORICAL_VAR_LOOKBACK, index);
  const histVar30d = histVar1d * HISTORICAL_VAR_30D_SCALER;
  const parametricVar30d = vols[30] * multipliers["<=30d"];
  const fatTail = histVar30d / parametricVar30d;

  const spot = prices[index];
  const prior = prices[index - 1];
  const dayChange = spot - prior;

  const composite = combineTrendSignals(TREND_WINDOWS.map((w) => trendSignals[w]));

  return {
    index,
    date: CALENDAR[index],
    spot,
    prior,
    dayChange,
    dayChangePct: dayChange / prior,
    vols,
    trends,
    trendSignals,
    acceleration,
    regime,
    regimeScore,
    composite,
    term,
    multipliers,
    histVar1d,
    histVar30d,
    parametricVar30d,
    fatTail,
  };
}

function backtestStatus(coverage: number): BacktestStatus {
  if (coverage >= VAR_COVERAGE_TARGET) return "PASS";
  if (coverage >= VAR_COVERAGE_TARGET - 0.015) return "ACCEPTABLE";
  return "FAIL";
}

function multiplierConfidence(regime: RegimeLabel): string {
  if (regime === "CALM" || regime === "NORMAL") return "HIGH_NORMAL_MARKET_CONDITIONS";
  if (regime === "ELEVATED") return "MEDIUM_SHIFTING_MARKET_CONDITIONS";
  return "HIGH_STRESS_MARKET_CONDITIONS";
}

function snapshotFromMetrics(series: PairSeries, m: Metrics): RegimeSnapshot {
  const code = series.code;
  const display = displayPair(code);
  // VaR coverage hovers near target, lower for stressed pairs.
  const coverage = Math.min(0.998, 0.986 + (3 - Math.min(m.acceleration, 3)) * 0.004);
  return {
    pair: code,
    display_pair: display,
    as_of_date: m.date,
    market_data_provider: "yfinance",
    live_spot_rates: {
      currency_pair: display,
      spot_rate: m.spot,
      prior_close: m.prior,
      day_change: m.dayChange,
      day_change_pct: m.dayChangePct,
      market_data_provider: "yfinance",
      data_source: "yfinance",
    },
    current_volatility_readings: {
      currency: display,
      vol_7d: m.vols[7],
      vol_30d: m.vols[30],
      vol_60d: m.vols[60],
      vol_90d: m.vols[90],
      vol_180d: m.vols[180],
      vol_252d: m.vols[252],
      accel_vs_252d: m.acceleration,
      regime: m.regime,
      regime_score: m.regimeScore,
    },
    volatility_trend_signals: {
      currency: display,
      trend_10d: m.trends[10],
      trend_30d: m.trends[30],
      trend_90d: m.trends[90],
      short_signal: m.trendSignals[10],
      med_signal: m.trendSignals[30],
      long_signal: m.trendSignals[90],
      composite_signal: m.composite,
    },
    volatility_term_structure: {
      currency_pair: display,
      tenor_le_7d: m.term["<=7d"],
      tenor_le_30d: m.term["<=30d"],
      tenor_le_60d: m.term["<=60d"],
      tenor_le_90d: m.term["<=90d"],
      tenor_le_180d: m.term["<=180d"],
      tenor_gt_180d: m.term[">180d"],
    },
    dynamic_trend_aware_regime_multiplier: {
      currency: display,
      tenor_le_14d: m.multipliers["<=14d"],
      tenor_le_30d: m.multipliers["<=30d"],
      tenor_le_60d: m.multipliers["<=60d"],
      tenor_le_90d: m.multipliers["<=90d"],
      tenor_le_180d: m.multipliers["<=180d"],
      tenor_gt_180d: m.multipliers[">180d"],
      trend_signal: m.composite,
      confidence: multiplierConfidence(m.regime),
    },
    hedge_cost_parameters: hedgeFor(code),
    historical_var: {
      currency_pair: display,
      hist_var_99_1day: m.histVar1d,
      hist_var_99_30day: m.histVar30d,
      parametric_var_30d: m.parametricVar30d,
      fat_tail_ratio: m.fatTail,
    },
    backtest_validation_results: {
      var_99_coverage: coverage,
      target_coverage: VAR_COVERAGE_TARGET,
      system_status: backtestStatus(coverage),
    },
    system_validation_checks: {
      spot_rates_loaded: m.spot != null,
      multipliers_in_valid_range: Object.values(m.multipliers).every(
        (v) => v >= 0.8 && v <= 3.0,
      ),
      term_structure_complete: Object.keys(m.term).length === 6,
      historical_var_available: m.histVar1d > 0,
    },
  };
}

// --- LLM validation fixtures ---------------------------------------------

const SCORER_MODELS = [
  "google/gemini-3-flash-preview",
  "anthropic/claude-haiku-4.5",
  "openai/gpt-5-mini",
];

function evidenceFor(code: string, rng: () => number): ResearchEvidenceItem[] {
  const display = displayPair(code);
  const quote = code.slice(3);
  const cbank: Record<string, string> = {
    GHS: "Bank of Ghana", NGN: "Central Bank of Nigeria", KES: "Central Bank of Kenya", ZAR: "South African Reserve Bank",
  };
  const titles = [
    `${cbank[quote] ?? "Central bank"} holds policy rate amid inflation watch`,
    `${display} liquidity tightens as importers raise FX demand`,
    `IMF review flags external financing pressures for ${quote}`,
    `Commodity swings ripple through ${quote} forward curve`,
  ];
  const sources = ["Reuters", "Bloomberg", "centralbank.gov", "IMF"];
  return titles.slice(0, 2 + Math.floor(rng() * 3)).map((title, i) => ({
    title,
    url: `https://example.com/${code.toLowerCase()}/${i}`,
    source: sources[i % sources.length],
    published_at: CALENDAR[CALENDAR.length - 1 - Math.floor(rng() * 20)] + "T09:00:00Z",
    excerpt:
      "Market participants point to shifting external balances and central-bank guidance as the dominant near-term drivers.",
    relevance_score: Number((0.6 + rng() * 0.39).toFixed(2)),
  }));
}

function statusFor(regime: RegimeLabel, rng: () => number): ValidationStatus {
  const r = rng();
  if (regime === "CRISIS" || regime === "STRESSED") {
    return r < 0.55 ? "supports" : r < 0.8 ? "partially_supports" : "contradicts";
  }
  return r < 0.65 ? "supports" : r < 0.88 ? "partially_supports" : "insufficient_evidence";
}

function actionFor(status: ValidationStatus, regime: RegimeLabel): RecommendedAction {
  if (status === "contradicts") return "escalate_for_human_review";
  if (status === "insufficient_evidence") return "rerun_with_deeper_research";
  if (regime === "CRISIS" || regime === "STRESSED") return "monitor_closely";
  return "accept_deterministic_read";
}

function buildValidationRun(snapshot: RegimeSnapshot): ValidationRun {
  const code = snapshot.pair;
  const rng = mulberry32(hashSeed(code + ":llm"));
  const regime = snapshot.current_volatility_readings.regime;
  const display = snapshot.display_pair;
  const status = statusFor(regime, rng);
  const action = actionFor(status, regime);
  const confidence = Number((0.55 + rng() * 0.4).toFixed(2));
  const quote = code.slice(3);
  const cbank: Record<string, string> = {
    GHS: "Bank of Ghana", NGN: "Central Bank of Nigeria", KES: "Central Bank of Kenya", ZAR: "South African Reserve Bank",
  };
  const evidence = evidenceFor(code, rng);
  const deterministicMultipliers = snapshot.dynamic_trend_aware_regime_multiplier;
  const sentiment: MarketSentiment =
    regime === "CALM" || regime === "NORMAL"
      ? "volatility_dampening"
      : regime === "CRISIS" || regime === "STRESSED"
        ? "volatility_amplifying"
        : "mixed";
  const adjustmentPct =
    sentiment === "volatility_dampening"
      ? -0.05
      : sentiment === "volatility_amplifying"
        ? 0.08
        : 0.0;
  const adjustmentDirection: TrendAdjustmentDirection =
    adjustmentPct > 0 ? "increase" : adjustmentPct < 0 ? "decrease" : "hold";
  const recommendedMultipliers = {
    tenor_le_14d: Number((deterministicMultipliers.tenor_le_14d * (1 + adjustmentPct)).toFixed(3)),
    tenor_le_30d: Number((deterministicMultipliers.tenor_le_30d * (1 + adjustmentPct)).toFixed(3)),
    tenor_le_60d: Number((deterministicMultipliers.tenor_le_60d * (1 + adjustmentPct)).toFixed(3)),
    tenor_le_90d: Number((deterministicMultipliers.tenor_le_90d * (1 + adjustmentPct)).toFixed(3)),
    tenor_le_180d: Number((deterministicMultipliers.tenor_le_180d * (1 + adjustmentPct)).toFixed(3)),
    tenor_gt_180d: Number((deterministicMultipliers.tenor_gt_180d * (1 + adjustmentPct)).toFixed(3)),
  };
  const horizonDays = 2 + Math.floor(rng() * 5);
  const validUntil = new Date(`${snapshot.as_of_date}T00:00:00Z`);
  validUntil.setUTCDate(validUntil.getUTCDate() + horizonDays);

  const brief = {
    pair: code,
    display_pair: display,
    as_of_date: snapshot.as_of_date,
    macro_context: `External balances and import cover remain the dominant macro drivers for ${quote}. Recent data shows ${regime === "CALM" || regime === "NORMAL" ? "orderly" : "increasingly two-way"} flows.`,
    central_bank_context: `${cbank[quote] ?? "The central bank"} has signalled a data-dependent stance; forward guidance is consistent with a ${regime.toLowerCase()} volatility read.`,
    currency_specific_context: `${display} order flow is dominated by importer demand and offshore positioning; liquidity is ${regime === "CRISIS" ? "thin" : "moderate"}.`,
    market_sentiment_summary:
      sentiment === "volatility_dampening"
        ? "Market mood is orderly and dampens the need for an elevated trend-aware multiplier."
        : sentiment === "volatility_amplifying"
          ? "Market mood is defensive and supports a higher trend-aware multiplier overlay."
          : "Market mood is mixed and does not strongly justify moving the multiplier.",
    policy_liquidity_context: `${cbank[quote] ?? "The central bank"} liquidity operations are treated as the main policy channel for near-term FX volatility sentiment.`,
    risk_events: [
      "Upcoming central-bank rate decision",
      "Monthly inflation print",
      quote === "NGN" ? "FX window reform headlines" : "Commodity price swings",
    ],
    evidence,
    retrieval_model: "perplexity/sonar",
  };

  const result: ValidationResult = {
    pair: code,
    display_pair: display,
    as_of_date: snapshot.as_of_date,
    status,
    confidence,
    deterministic_regime: regime,
    external_context_regime_read:
      status === "supports" ? regime : status === "contradicts" ? "ELEVATED" : `${regime} (with caveats)`,
    validation_summary:
      status === "supports"
        ? `External context corroborates the deterministic ${regime} read for ${display}.`
        : status === "partially_supports"
          ? `External context broadly aligns with the ${regime} read for ${display}, with some offsetting signals.`
          : status === "contradicts"
            ? `External context points to more stress than the deterministic ${regime} read for ${display}.`
            : `Insufficient fresh evidence to confirm the ${regime} read for ${display}.`,
    rationale:
      "The deterministic engine anchors on realized-volatility acceleration. The research brief is treated as the factual anchor; where qualitative signals diverge they are noted as watch items rather than overrides.",
    market_sentiment: sentiment,
    trend_aware_validation_summary:
      adjustmentDirection === "decrease"
        ? `Market mood supports a modest decrease from the deterministic ${display} trend-aware multipliers.`
        : adjustmentDirection === "increase"
          ? `Market mood supports a modest increase above the deterministic ${display} trend-aware multipliers.`
          : `Market mood supports holding the deterministic ${display} trend-aware multipliers.`,
    deterministic_trend_aware_multipliers: {
      tenor_le_14d: deterministicMultipliers.tenor_le_14d,
      tenor_le_30d: deterministicMultipliers.tenor_le_30d,
      tenor_le_60d: deterministicMultipliers.tenor_le_60d,
      tenor_le_90d: deterministicMultipliers.tenor_le_90d,
      tenor_le_180d: deterministicMultipliers.tenor_le_180d,
      tenor_gt_180d: deterministicMultipliers.tenor_gt_180d,
    },
    llm_recommended_trend_aware_multipliers: recommendedMultipliers,
    primary_trend_aware_tenor: "tenor_le_30d",
    deterministic_primary_trend_multiplier: deterministicMultipliers.tenor_le_30d,
    recommended_primary_trend_multiplier: recommendedMultipliers.tenor_le_30d,
    trend_adjustment_direction: adjustmentDirection,
    trend_adjustment_pct: adjustmentPct,
    trend_adjustment_confidence: Number((confidence - 0.05).toFixed(2)),
    trend_adjustment_rationale:
      "The overlay is driven by the cited policy/liquidity context and market mood, then applied conservatively to the deterministic tenor multiplier map.",
    trend_driver_evidence: [
      `${cbank[quote] ?? "Central-bank"} policy/liquidity context`,
      "Importer demand and offshore positioning tone",
    ],
    expected_signal_horizon_days: horizonDays,
    expected_signal_valid_until: validUntil.toISOString().slice(0, 10),
    signal_horizon_rationale:
      "The cited policy and liquidity drivers are expected to remain relevant for a few market sessions before a fresh news read is needed.",
    output_quality_flags: [],
    supporting_points: [
      `Realized vol acceleration of ${snapshot.current_volatility_readings.accel_vs_252d.toFixed(2)}x is consistent with the ${regime} band.`,
      `${cbank[quote] ?? "Central-bank"} guidance does not contradict the current read.`,
    ],
    contradicting_points:
      status === "contradicts" || status === "partially_supports"
        ? ["Offshore positioning hints at a faster build in implied vol than realized vol shows."]
        : [],
    watch_items: [
      "Next central-bank decision could re-rate the front end.",
      "Liquidity gaps around month-end may distort short-tenor vol.",
    ],
    recommended_action: action,
    scorer_model: SCORER_MODELS[0],
    prompt_version: "market-regime-validation-v1",
    research_brief: brief,
  };

  const priorMemoryItems = [1, 2, 3].map((offset) => {
    const priorDate = new Date(`${snapshot.as_of_date}T00:00:00Z`);
    priorDate.setUTCDate(priorDate.getUTCDate() - offset);
    const priorDateKey = priorDate.toISOString().slice(0, 10);
    return {
      validation_run_id: `val_${code.toLowerCase()}_${priorDateKey}`,
      as_of_date: priorDateKey,
      created_at: `${priorDateKey}T07:42:00Z`,
      run_source: "scheduled",
      status,
      confidence: Number((confidence - offset * 0.02).toFixed(2)),
      market_sentiment: sentiment,
      trend_adjustment_direction: adjustmentDirection,
      trend_adjustment_pct: adjustmentPct,
      trend_adjustment_confidence: Number((confidence - 0.08).toFixed(2)),
      primary_trend_aware_tenor: "tenor_le_30d" as const,
      deterministic_primary_trend_multiplier: deterministicMultipliers.tenor_le_30d,
      recommended_primary_trend_multiplier: recommendedMultipliers.tenor_le_30d,
      expected_signal_horizon_days: Math.max(1, horizonDays - offset + 1),
      expected_signal_valid_until: result.expected_signal_valid_until,
      validation_summary: result.validation_summary,
      trend_aware_validation_summary: result.trend_aware_validation_summary,
      trend_adjustment_rationale: result.trend_adjustment_rationale,
      signal_horizon_rationale: result.signal_horizon_rationale,
      trend_driver_evidence: result.trend_driver_evidence,
      watch_items: result.watch_items,
      source_titles: evidence.slice(0, 2).map((item) => ({
        title: item.title,
        source: item.source,
        published_at: item.published_at,
      })),
    };
  });

  const independent: ValidationResult[] = SCORER_MODELS.map((model, i) => ({
    ...result,
    status: i === 0 ? status : statusFor(regime, rng),
    confidence: Number((0.5 + rng() * 0.45).toFixed(2)),
    scorer_model: model,
  }));

  const raw: LLMCallRecord[] = [
    {
      call_role: "research",
      model: "perplexity/sonar",
      raw_content: `Research brief for ${display} as of ${snapshot.as_of_date}. ${brief.macro_context}`,
      parsed_json: { macro_context: brief.macro_context, risk_events: brief.risk_events },
      citations: evidence.map((e) => ({ url: e.url, title: e.title, content: e.excerpt })),
      reasoning_content: null,
    },
    ...independent.map((r) => ({
      call_role: "scorer" as const,
      model: r.scorer_model,
      raw_content: `{"status":"${r.status}","confidence":${r.confidence}}`,
      parsed_json: { status: r.status, confidence: r.confidence },
      citations: [],
      reasoning_content: "Weighed realized-vol acceleration against the shared research brief.",
    })),
    {
      call_role: "aggregation",
      model: "anthropic/claude-sonnet-4.5",
      raw_content: result.validation_summary,
      parsed_json: { status: result.status, recommended_action: result.recommended_action },
      citations: [],
      reasoning_content: "Aggregated independent scorer views using the research brief as the factual anchor.",
    },
  ];

  // Validation runs land a day after the snapshot, around the morning schedule.
  return {
    id: `val_${code.toLowerCase()}_${snapshot.as_of_date}`,
    pair_code: code,
    as_of_date: snapshot.as_of_date,
    status,
    model_name: "anthropic/claude-sonnet-4.5",
    prompt_version: "market-regime-validation-v1",
    run_source: "scheduled",
    experiment_id: null,
    experiment_variant: null,
    research_brief_hash: null,
    is_shadow: true,
    confidence,
    rationale: result.rationale,
    market_sentiment: result.market_sentiment,
    trend_adjustment_direction: result.trend_adjustment_direction,
    trend_adjustment_pct: result.trend_adjustment_pct,
    trend_adjustment_confidence: result.trend_adjustment_confidence,
    deterministic_primary_trend_multiplier: result.deterministic_primary_trend_multiplier,
    recommended_primary_trend_multiplier: result.recommended_primary_trend_multiplier,
    primary_trend_aware_tenor: result.primary_trend_aware_tenor,
    deterministic_trend_aware_multipliers: result.deterministic_trend_aware_multipliers,
    llm_recommended_trend_aware_multipliers: result.llm_recommended_trend_aware_multipliers,
    created_at: `${snapshot.as_of_date}T07:42:00Z`,
    result,
    prior_validation_context: {
      memory_mode: "rolling_7d_validation_memory_v1",
      pair_code: code,
      current_as_of_date: snapshot.as_of_date,
      lookback_days: 7,
      item_count: priorMemoryItems.length,
      items: priorMemoryItems,
    },
    independent_scorer_results: independent,
    raw_model_responses: raw,
  };
}

// --- Provider run fixtures -----------------------------------------------

function buildProviderRuns(code: string, rowCount: number): ProviderRun[] {
  const rng = mulberry32(hashSeed(code + ":runs"));
  const dates = businessDaysBack(AS_OF, 8);
  return dates.map((date, i) => {
    const failed = rng() < 0.06;
    return {
      id: `run_${code.toLowerCase()}_${date}`,
      provider_name: "yfinance",
      pair_code: code,
      requested_at: date,
      completed_at: `${date}T06:${(14 + i).toString().padStart(2, "0")}:00Z`,
      status: failed ? "failed" : "succeeded",
      row_count: failed ? 0 : i === 0 ? rowCount : 3 + Math.floor(rng() * 2),
      source_detail: failed
        ? { error: "yfinance returned empty frame", retved: true }
        : {
            symbol: `${code}=X`,
            mode: i === 0 && rng() < 0.3 ? "full_backfill" : "incremental",
            overlap_days: 3,
            ...(i === 0 && rng() < 0.3 ? { backfill_reason: "insufficient_history" } : {}),
          },
    };
  });
}

// --- Build & cache the whole dataset -------------------------------------

type Dataset = {
  asOf: string;
  pairs: string[];
  snapshots: Record<string, RegimeSnapshot>;
  history: Record<string, RegimeHistoryPoint[]>;
  prices: Record<string, RawPriceObservation[]>;
  validations: Record<string, ValidationRun>;
  providerRuns: Record<string, ProviderRun[]>;
};

let CACHE: Dataset | null = null;

function build(): Dataset {
  const snapshots: Record<string, RegimeSnapshot> = {};
  const history: Record<string, RegimeHistoryPoint[]> = {};
  const prices: Record<string, RawPriceObservation[]> = {};
  const validations: Record<string, ValidationRun> = {};
  const providerRuns: Record<string, ProviderRun[]> = {};

  for (const code of PAIR_CODES) {
    const series = buildPairSeries(code);
    const lastIndex = series.prices.length - 1;
    const latest = metricsAt(series, lastIndex);
    const snapshot = snapshotFromMetrics(series, latest);
    snapshots[code] = snapshot;

    const points: RegimeHistoryPoint[] = [];
    for (let i = lastIndex - HISTORY_WINDOW + 1; i <= lastIndex; i++) {
      const m = metricsAt(series, i);
      points.push({
        as_of_date: m.date,
        spot_rate: m.spot,
        day_change_pct: m.dayChangePct,
        regime: m.regime,
        regime_score: m.regimeScore,
        acceleration_vs_252d: m.acceleration,
        vol_7d: m.vols[7],
        vol_30d: m.vols[30],
        vol_60d: m.vols[60],
        vol_90d: m.vols[90],
        vol_180d: m.vols[180],
        vol_252d: m.vols[252],
        trend_30d: m.trends[30],
        composite_signal: m.composite,
        volatility_term_structure: {
          currency_pair: displayPair(code),
          tenor_le_7d: m.term["<=7d"],
          tenor_le_30d: m.term["<=30d"],
          tenor_le_60d: m.term["<=60d"],
          tenor_le_90d: m.term["<=90d"],
          tenor_le_180d: m.term["<=180d"],
          tenor_gt_180d: m.term[">180d"],
        },
        dynamic_trend_aware_regime_multiplier: {
          currency: displayPair(code),
          tenor_le_14d: m.multipliers["<=14d"],
          tenor_le_30d: m.multipliers["<=30d"],
          tenor_le_60d: m.multipliers["<=60d"],
          tenor_le_90d: m.multipliers["<=90d"],
          tenor_le_180d: m.multipliers["<=180d"],
          tenor_gt_180d: m.multipliers[">180d"],
          trend_signal: m.composite,
          confidence: multiplierConfidence(m.regime),
        },
        hist_var_99_30d: m.histVar30d,
        fat_tail_ratio: m.fatTail,
      });
    }
    history[code] = points;

    prices[code] = [];
    for (let i = lastIndex - HISTORY_WINDOW + 1; i <= lastIndex; i++) {
      prices[code].push({
        observed_on: CALENDAR[i],
        close_raw: series.prices[i],
        close_display: series.prices[i],
      });
    }

    validations[code] = buildValidationRun(snapshot);
    providerRuns[code] = buildProviderRuns(code, series.prices.length);
  }

  return { asOf: AS_OF, pairs: PAIR_CODES, snapshots, history, prices, validations, providerRuns };
}

function dataset(): Dataset {
  if (!CACHE) CACHE = build();
  return CACHE;
}

// --- Public accessors (the swap seam for Supabase) -----------------------

export function getAsOf(): string {
  return dataset().asOf;
}

export function getSupportedPairs(): string[] {
  return [...dataset().pairs];
}

export function getLatestSnapshots(): RegimeSnapshot[] {
  const d = dataset();
  return d.pairs.map((p) => d.snapshots[p]);
}

export function getSnapshot(code: string): RegimeSnapshot | null {
  return dataset().snapshots[code.toUpperCase()] ?? null;
}

export function getHistory(code: string): RegimeHistoryPoint[] {
  return dataset().history[code.toUpperCase()] ?? [];
}

export function getPrices(code: string): RawPriceObservation[] {
  return dataset().prices[code.toUpperCase()] ?? [];
}

export function getValidation(code: string): ValidationRun | null {
  return dataset().validations[code.toUpperCase()] ?? null;
}

export function getAllValidations(): ValidationRun[] {
  const d = dataset();
  return d.pairs.map((p) => d.validations[p]);
}

export function getProviderRuns(code?: string): ProviderRun[] {
  const d = dataset();
  if (code) return d.providerRuns[code.toUpperCase()] ?? [];
  return d.pairs.flatMap((p) => d.providerRuns[p]);
}

export function getBenchmarkResults(): BenchmarkResult[] {
  const d = dataset();
  const tenors = [
    ["tenor_le_14d", 14],
    ["tenor_le_30d", 30],
    ["tenor_le_60d", 60],
    ["tenor_le_90d", 90],
  ] as const;
  return d.pairs.slice(0, 10).flatMap((pair, pairIndex) => {
    const validation = d.validations[pair];
    const snapshot = d.snapshots[pair];
    return tenors.map(([tenorKey, horizon], tenorIndex) => {
      const quant = validation.result.deterministic_trend_aware_multipliers[tenorKey];
      const llm = validation.result.llm_recommended_trend_aware_multipliers[tenorKey];
      const structure = snapshot.volatility_term_structure;
      const baseline = tenorKey === "tenor_le_14d"
        ? Math.sqrt((16 / 23) * structure.tenor_le_7d ** 2 + (7 / 23) * structure.tenor_le_30d ** 2)
        : structure[tenorKey];
      const rng = mulberry32(hashSeed(`${pair}:${tenorKey}:benchmark`));
      const realized = baseline * quant * (0.82 + rng() * 0.42);
      const quantImplied = baseline * quant;
      const llmImplied = baseline * llm;
      const quantError = Math.abs(realized - quantImplied);
      const llmError = Math.abs(realized - llmImplied);
      const maturity = new Date(`${validation.as_of_date}T00:00:00Z`);
      maturity.setUTCDate(maturity.getUTCDate() + horizon);
      return {
        id: `bench_${pair}_${tenorKey}`,
        llm_validation_run_id: validation.id,
        market_regime_snapshot_id: null,
        pair_code: pair,
        as_of_date: validation.as_of_date,
        maturity_date: maturity.toISOString().slice(0, 10),
        evaluation_market_date: maturity.toISOString().slice(0, 10),
        maturity_rolled: false,
        evaluated_at: `${AS_OF}T09:${String(pairIndex + tenorIndex).padStart(2, "0")}:00Z`,
        tenor_key: tenorKey,
        benchmark_method_version: "tenor_matched_v2",
        horizon_days: horizon,
        quant_multiplier: quant,
        llm_multiplier: llm,
        baseline_vol_252d: baseline,
        baseline_vol: baseline,
        baseline_source: tenorKey === "tenor_le_14d" ? "variance_interp_7d_30d_at_14d" : tenorKey,
        quant_implied_vol: quantImplied,
        llm_implied_vol: llmImplied,
        realized_vol: realized,
        realized_abs_return: realized / Math.sqrt(252 / Math.max(horizon, 1)),
        realized_max_abs_return: realized / Math.sqrt(252 / Math.max(horizon, 1)) * 1.35,
        quant_abs_error: quantError,
        llm_abs_error: llmError,
        llm_lift: quantError - llmError,
        llm_direction: validation.result.trend_adjustment_direction,
        direction_hit:
          validation.result.trend_adjustment_direction === "increase"
            ? realized > quantImplied
            : validation.result.trend_adjustment_direction === "decrease"
              ? realized < quantImplied
              : Math.abs(realized - quantImplied) <= quantImplied * 0.05,
        quant_undercovered: realized > quantImplied,
        llm_undercovered: realized > llmImplied,
        observation_count: Math.max(2, Math.round(horizon * 0.72)),
        is_canonical: true,
        scoring_notes: {
          fixture: true,
          expected_signal_horizon_days: validation.result.expected_signal_horizon_days,
          expected_signal_valid_until: validation.result.expected_signal_valid_until,
          memory_item_count: validation.prior_validation_context.item_count,
        },
        created_at: `${AS_OF}T09:00:00Z`,
        updated_at: `${AS_OF}T09:00:00Z`,
      } satisfies BenchmarkResult;
    });
  });
}

export function getSignalHorizonBenchmarkResults(): SignalHorizonBenchmarkResult[] {
  const d = dataset();
  const tenors = [
    "tenor_le_14d",
    "tenor_le_30d",
    "tenor_le_60d",
    "tenor_le_90d",
    "tenor_le_180d",
    "tenor_gt_180d",
  ] as const;
  return d.pairs.slice(0, 10).flatMap((pair, pairIndex) => {
    const validation = d.validations[pair];
    const snapshot = d.snapshots[pair];
    const horizon = validation.result.expected_signal_horizon_days;
    const maturity = validation.result.expected_signal_valid_until;
    return tenors.map((tenorKey, tenorIndex) => {
      const quant = validation.result.deterministic_trend_aware_multipliers[tenorKey];
      const llm = validation.result.llm_recommended_trend_aware_multipliers[tenorKey];
      const structure = snapshot.volatility_term_structure;
      const baseline = tenorKey === "tenor_le_14d"
        ? Math.sqrt((16 / 23) * structure.tenor_le_7d ** 2 + (7 / 23) * structure.tenor_le_30d ** 2)
        : structure[tenorKey];
      const rng = mulberry32(hashSeed(`${pair}:${tenorKey}:signal-horizon`));
      const realized = baseline * quant * (0.78 + rng() * 0.48);
      const quantImplied = baseline * quant;
      const llmImplied = baseline * llm;
      const quantError = Math.abs(realized - quantImplied);
      const llmError = Math.abs(realized - llmImplied);
      return {
        id: `signal_horizon_${pair}_${tenorKey}`,
        llm_validation_run_id: validation.id,
        market_regime_snapshot_id: null,
        pair_code: pair,
        as_of_date: validation.as_of_date,
        expected_signal_horizon_days: horizon,
        expected_signal_valid_until: maturity,
        maturity_date: maturity,
        evaluation_market_date: maturity,
        maturity_rolled: false,
        evaluated_at: `${AS_OF}T09:${String(pairIndex + tenorIndex).padStart(2, "0")}:00Z`,
        tenor_key: tenorKey,
        benchmark_method_version: "tenor_matched_v2",
        quant_multiplier: quant,
        llm_multiplier: llm,
        baseline_vol_252d: baseline,
        baseline_vol: baseline,
        baseline_source: tenorKey === "tenor_le_14d" ? "variance_interp_7d_30d_at_14d" : tenorKey,
        quant_implied_vol: quantImplied,
        llm_implied_vol: llmImplied,
        realized_vol: realized,
        realized_abs_return: realized / Math.sqrt(252 / Math.max(horizon, 1)),
        realized_max_abs_return: realized / Math.sqrt(252 / Math.max(horizon, 1)) * 1.25,
        quant_abs_error: quantError,
        llm_abs_error: llmError,
        llm_lift: quantError - llmError,
        llm_direction: validation.result.trend_adjustment_direction,
        direction_hit:
          validation.result.trend_adjustment_direction === "increase"
            ? realized > quantImplied
            : validation.result.trend_adjustment_direction === "decrease"
              ? realized < quantImplied
              : Math.abs(realized - quantImplied) <= quantImplied * 0.05,
        signal_still_valid: llmError <= quantError,
        llm_outperformed_quant: llmError <= quantError,
        quant_undercovered: realized > quantImplied,
        llm_undercovered: realized > llmImplied,
        observation_count: Math.max(2, Math.round(horizon * 0.72)),
        memory_item_count: validation.prior_validation_context.item_count,
        is_canonical: true,
        scoring_notes: {
          fixture: true,
          method: "realized_forward_vol_over_llm_declared_signal_horizon",
        },
        created_at: `${AS_OF}T09:00:00Z`,
        updated_at: `${AS_OF}T09:00:00Z`,
      } satisfies SignalHorizonBenchmarkResult;
    });
  });
}

const ML_TENORS = [
  ["tenor_le_14d", 14],
  ["tenor_le_30d", 30],
  ["tenor_le_60d", 60],
  ["tenor_le_90d", 90],
  ["tenor_le_180d", 180],
  ["tenor_gt_180d", 252],
] as const;

export function getMLMultiplierModels(): MLMultiplierModel[] {
  return [
    {
      id: "ml-model-noeud-direct-v1",
      model_key: "noeud-multiplier-direct",
      display_name: "Noeud Multiplier Direct v1",
      model_version: "noeud-multiplier-direct-v1",
      status: "shadow_active",
      output_role: "independent_shadow_challenger",
      artifact_sha256: "089cc8b4697109894de4b76edc80aec61e2de7963bca0f295079198e02618aec",
      feature_schema: ["base_vol", "trend_90d", "vol_90d", "pair_code", "tenor", "regime"],
      hyperparameters: {
        loss: "quantile",
        alpha: 0.6,
        n_estimators: 150,
        max_depth: 2,
      },
      training_first_date: "2008-06-27",
      training_last_as_of_date: "2026-05-21",
      latest_label_available_on: "2026-06-04",
      training_rows: 82327,
      holdout_metrics: {
        mae_volatility: 0.087618,
        qlike: -2.54778,
        undercoverage_rate: 0.3238,
        mae_reduction_vs_quant_pct: 43.23,
      },
      rolling_metrics: {
        observations: 56847,
        market_dates: 3225,
        quant_mae_vol: 0.112662,
        ml_mae_vol: 0.072782,
        mae_reduction_pct: 35.398,
        undercoverage_delta_pp: -4.329,
      },
      gate_report: {
        official_promotion_eligible: false,
        decision: "fail",
        passed_segments: 32,
        failed_segments: 29,
        reason:
          "Aggregate accuracy improves, but required stability gates fail in several years and stressed segments.",
      },
      sklearn_version: "1.9.0",
      trained_at: "2026-07-26T08:29:18.843034+00:00",
      activated_at: "2026-07-26T10:00:00+00:00",
      run_source: "bundled_release",
    },
  ];
}

export function getMLMultiplierPredictions(): MLMultiplierPrediction[] {
  const d = dataset();
  return ["USDGHS", "EURGHS", "GBPGHS"].flatMap((pair, pairIndex) =>
    d.history[pair].slice(-30).flatMap((point, dateIndex) =>
      ML_TENORS.map(([tenor, horizon], tenorIndex) => {
        const quant = point.dynamic_trend_aware_regime_multiplier[tenor];
        const cycle = Math.sin((dateIndex + tenorIndex * 2 + pairIndex) / 5);
        const ml = Math.max(0.8, Math.min(3, quant * (0.95 + cycle * 0.055)));
        const base =
          tenor === "tenor_le_14d"
            ? point.volatility_term_structure.tenor_le_30d
            : point.volatility_term_structure[
                tenor === "tenor_gt_180d" ? "tenor_gt_180d" : tenor
              ];
        return {
          id: `ml-pred-${pair}-${point.as_of_date}-${tenor}`,
          model_id: "ml-model-noeud-direct-v1",
          market_regime_snapshot_id: `snapshot-${pair}-${point.as_of_date}`,
          pair_code: pair,
          as_of_date: point.as_of_date,
          tenor_key: tenor,
          horizon_days: horizon,
          quant_multiplier: quant,
          ml_multiplier: ml,
          difference_vs_quant: ml - quant,
          base_vol: base,
          quant_implied_vol: base * quant,
          ml_implied_vol: base * ml,
          prediction_status: "predicted",
          model_version: "noeud-multiplier-direct-v1",
          output_role: "independent_shadow_challenger",
          is_shadow: true,
          evaluation_status: dateIndex < 12 ? "scored" : "pending",
          evaluation_reason: null,
          evaluated_at: dateIndex < 12 ? `${AS_OF}T09:00:00Z` : null,
          created_at: `${point.as_of_date}T08:16:00Z`,
        } satisfies MLMultiplierPrediction;
      }),
    ),
  );
}

export function getMLMultiplierBenchmarks(): MLMultiplierBenchmarkResult[] {
  return getMLMultiplierPredictions()
    .filter((prediction) => prediction.evaluation_status === "scored")
    .map((prediction, index) => {
      const ml = prediction.ml_multiplier ?? prediction.quant_multiplier;
      const realized =
        prediction.base_vol *
        prediction.quant_multiplier *
        (0.86 + (index % 7) * 0.045);
      const quantError = Math.abs(prediction.quant_implied_vol - realized);
      const mlError = Math.abs((prediction.ml_implied_vol ?? 0) - realized);
      const maturity = new Date(`${prediction.as_of_date}T00:00:00Z`);
      maturity.setUTCDate(maturity.getUTCDate() + prediction.horizon_days);
      const qlike = (forecast: number) => {
        const fv = Math.max(forecast ** 2, 1e-12);
        const rv = Math.max(realized ** 2, 1e-12);
        return Math.log(fv) + rv / fv;
      };
      return {
        id: `ml-bench-${prediction.id}`,
        prediction_id: prediction.id,
        model_id: prediction.model_id,
        market_regime_snapshot_id: prediction.market_regime_snapshot_id,
        pair_code: prediction.pair_code,
        as_of_date: prediction.as_of_date,
        maturity_date: maturity.toISOString().slice(0, 10),
        evaluation_market_date: maturity.toISOString().slice(0, 10),
        maturity_rolled: false,
        tenor_key: prediction.tenor_key,
        horizon_days: prediction.horizon_days,
        benchmark_method_version: "ml_tenor_matched_v1",
        quant_multiplier: prediction.quant_multiplier,
        ml_multiplier: ml,
        base_vol: prediction.base_vol,
        quant_implied_vol: prediction.quant_implied_vol,
        ml_implied_vol: prediction.ml_implied_vol ?? 0,
        realized_vol: realized,
        quant_abs_error: quantError,
        ml_abs_error: mlError,
        ml_lift: quantError - mlError,
        quant_qlike: qlike(prediction.quant_implied_vol),
        ml_qlike: qlike(prediction.ml_implied_vol ?? 0),
        quant_undercovered: realized > prediction.quant_implied_vol,
        ml_undercovered: realized > (prediction.ml_implied_vol ?? 0),
        observation_count: Math.max(2, Math.round(prediction.horizon_days * 0.72)),
        regime: "NORMAL",
        model_version: prediction.model_version,
        scoring_notes: { fixture: true },
        evaluated_at: `${AS_OF}T09:00:00Z`,
      } satisfies MLMultiplierBenchmarkResult;
    });
}

export { REGIME_LABELS };
