import {
  getAllValidations as getMockAllValidations,
  getAsOf as getMockAsOf,
  getBenchmarkResults as getMockBenchmarkResults,
  getHistory as getMockHistory,
  getLatestSnapshots as getMockLatestSnapshots,
  getPrices as getMockPrices,
  getProviderRuns as getMockProviderRuns,
  getMLMultiplierBenchmarks as getMockMLMultiplierBenchmarks,
  getMLMultiplierModels as getMockMLMultiplierModels,
  getMLMultiplierPredictions as getMockMLMultiplierPredictions,
  getMaturityRiskBenchmarks as getMockMaturityRiskBenchmarks,
  getMaturityRiskForecasts as getMockMaturityRiskForecasts,
  getMaturityRiskPolicies as getMockMaturityRiskPolicies,
  getSignalHorizonBenchmarkResults as getMockSignalHorizonBenchmarkResults,
  getSnapshot as getMockSnapshot,
  getSupportedPairs as getMockSupportedPairs,
  getValidation as getMockValidation,
} from "@/lib/mock/dataset";
import type {
  CompositeSignal,
  BenchmarkResult,
  BenchmarkEvaluationStatus,
  LLMCallRecord,
  ProviderRun,
  RawPriceObservation,
  RecommendedAction,
  RegimeHistoryPoint,
  RegimeLabel,
  RegimeSnapshot,
  ResearchBrief,
  MarketSentiment,
  MLMultiplierBenchmarkResult,
  MLMultiplierModel,
  MLMultiplierPrediction,
  MaturityRiskBenchmarkResult,
  MaturityRiskForecast,
  MaturityRiskPolicy,
  MLShadowContext,
  MLShadowTenorComparison,
  PriorValidationContext,
  PriorValidationContextItem,
  SignalHorizonBenchmarkResult,
  ObservatoryDataSourceStatus,
  TrendAdjustmentDirection,
  TrendAwareMultiplierMap,
  ValidationResult,
  ValidationRun,
  ValidationRunSource,
  ValidationStatus,
} from "@/lib/types";

type JsonRecord = Record<string, unknown>;

type SnapshotRow = {
  id: string;
  provider_run_id: string | null;
  pair_code: string;
  as_of_date: string;
  spot_rate: number;
  prior_close: number;
  day_change: number;
  day_change_pct: number;
  regime: string;
  regime_score: number;
  acceleration_vs_252d: number;
  vol_7d: number;
  vol_30d: number;
  vol_60d: number;
  vol_90d: number;
  vol_180d: number;
  vol_252d: number;
  trend_10d: number;
  trend_30d: number;
  trend_90d: number;
  composite_signal: string;
  hist_var_99_30d: number;
  fat_tail_ratio: number;
  snapshot_payload: RegimeSnapshot;
  created_at: string;
};

type ValidationRow = {
  id: string;
  market_regime_snapshot_id: string | null;
  pair_code: string;
  as_of_date: string;
  status: string;
  model_name: string;
  prompt_version: string | null;
  run_source: string | null;
  experiment_id: string | null;
  experiment_variant: string | null;
  research_brief_hash: string | null;
  is_shadow: boolean | null;
  input_payload: JsonRecord | null;
  output_payload: JsonRecord | null;
  rationale: string | null;
  confidence: number | null;
  market_sentiment: string | null;
  trend_adjustment_direction: string | null;
  trend_adjustment_pct: number | null;
  trend_adjustment_confidence: number | null;
  deterministic_primary_trend_multiplier: number | null;
  recommended_primary_trend_multiplier: number | null;
  primary_trend_aware_tenor: string | null;
  deterministic_trend_aware_multipliers: JsonRecord | null;
  llm_recommended_trend_aware_multipliers: JsonRecord | null;
  created_at: string;
};

type BenchmarkRow = BenchmarkResult;
type SignalHorizonBenchmarkRow = SignalHorizonBenchmarkResult;
type MLMultiplierModelRow = MLMultiplierModel;
type MLMultiplierPredictionRow = MLMultiplierPrediction;
type MLMultiplierBenchmarkRow = MLMultiplierBenchmarkResult;

type SupabaseConfig = {
  url: string;
  key: string;
};

type DataSourceMode = "auto" | "supabase" | "mock";

function dataSourceMode(): DataSourceMode {
  const configured = process.env.OBSERVATORY_DATA_SOURCE?.trim().toLowerCase();
  if (configured === "auto" || configured === "supabase" || configured === "mock") {
    return configured;
  }
  if (configured) {
    throw new Error(
      `Invalid OBSERVATORY_DATA_SOURCE=${configured}; expected auto, supabase, or mock`,
    );
  }
  return process.env.NODE_ENV === "production" ? "supabase" : "mock";
}

function supabaseConfig(): SupabaseConfig | null {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_KEY?.trim() ||
    "";
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

function shouldUseSupabase() {
  const mode = dataSourceMode();
  return mode === "supabase" || (mode === "auto" && supabaseConfig() !== null);
}

async function supabaseGet<T>(
  table: string,
  params: Record<string, string | number | boolean | undefined> = {},
): Promise<T[]> {
  const config = supabaseConfig();
  if (!config) throw new Error("Supabase is not configured");

  const requestedLimit = Math.max(Number(params.limit ?? 1000), 0);
  const pageSize = Math.min(requestedLimit || 1000, 1000);
  const baseParams = { ...params };
  delete baseParams.limit;
  const rows: T[] = [];

  while (rows.length < requestedLimit) {
    const url = new URL(`${config.url}/rest/v1/${table}`);
    for (const [key, value] of Object.entries(baseParams)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    const remaining = requestedLimit - rows.length;
    url.searchParams.set("limit", String(Math.min(pageSize, remaining)));
    url.searchParams.set("offset", String(rows.length));

    const response = await fetch(url, {
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Supabase ${table} request failed: ${response.status} ${body}`);
    }

    const page = (await response.json()) as T[];
    rows.push(...page);
    if (page.length < Math.min(pageSize, remaining)) break;
  }

  return rows;
}

async function withFallback<T>(loadSupabase: () => Promise<T>, loadMock: () => T): Promise<T> {
  if (!shouldUseSupabase()) return loadMock();
  return loadSupabase();
}

function displayPair(pair: string) {
  return `${pair.slice(0, 3)}/${pair.slice(3)}`;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value ? value : fallback;
}

function addDaysIso(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function isRegime(value: unknown): value is RegimeLabel {
  return ["CALM", "NORMAL", "ELEVATED", "STRESSED", "CRISIS"].includes(String(value));
}

function isComposite(value: unknown): value is CompositeSignal {
  return ["STRONG_RISING", "STRONG_FALLING", "FLAT", "MIXED_SIGNAL"].includes(
    String(value),
  );
}

function isValidationStatus(value: unknown): value is ValidationStatus {
  return [
    "supports",
    "partially_supports",
    "contradicts",
    "insufficient_evidence",
  ].includes(String(value));
}

function validationRunSource(value: unknown): ValidationRunSource {
  if (["scheduled", "manual", "backfill", "experiment", "test"].includes(String(value))) {
    return value as ValidationRunSource;
  }
  return "unknown";
}

function isRecommendedAction(value: unknown): value is RecommendedAction {
  return [
    "accept_deterministic_read",
    "monitor_closely",
    "escalate_for_human_review",
    "rerun_with_deeper_research",
  ].includes(String(value));
}

function isMarketSentiment(value: unknown): value is MarketSentiment {
  return [
    "volatility_dampening",
    "volatility_amplifying",
    "mixed",
    "unclear",
  ].includes(String(value));
}

function isTrendAdjustmentDirection(value: unknown): value is TrendAdjustmentDirection {
  return ["increase", "decrease", "hold", "insufficient_evidence"].includes(String(value));
}

function isTrendAwareTenor(value: unknown): value is keyof TrendAwareMultiplierMap {
  return [
    "tenor_le_14d",
    "tenor_le_30d",
    "tenor_le_60d",
    "tenor_le_90d",
    "tenor_le_180d",
    "tenor_gt_180d",
  ].includes(String(value));
}

function trendAwareMapFromRecord(value: unknown, fallback = 0): TrendAwareMultiplierMap {
  const record = asRecord(value);
  return {
    tenor_le_14d: asNumber(record.tenor_le_14d, fallback),
    tenor_le_30d: asNumber(record.tenor_le_30d, fallback),
    tenor_le_60d: asNumber(record.tenor_le_60d, fallback),
    tenor_le_90d: asNumber(record.tenor_le_90d, fallback),
    tenor_le_180d: asNumber(record.tenor_le_180d, fallback),
    tenor_gt_180d: asNumber(record.tenor_gt_180d, fallback),
  };
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mlShadowContextFromPayload(value: unknown): MLShadowContext | null {
  const record = asRecord(value);
  const tenorPayload = asRecord(record.tenors);
  const tenors: MLShadowContext["tenors"] = {};

  for (const [key, value] of Object.entries(tenorPayload)) {
    if (!isTrendAwareTenor(key)) continue;
    const comparison = asRecord(value);
    tenors[key] = {
      quant_engine_multiplier: nullableNumber(
        comparison.quant_engine_multiplier,
      ),
      independent_ml_shadow_multiplier: nullableNumber(
        comparison.independent_ml_shadow_multiplier,
      ),
      difference_vs_quant: nullableNumber(comparison.difference_vs_quant),
      prediction_status: asString(comparison.prediction_status, "unknown"),
    } satisfies MLShadowTenorComparison;
  }

  if (Object.keys(tenors).length === 0) return null;
  return {
    role: asString(record.role, "independent_shadow_challenger"),
    authority: asString(record.authority, "diagnostic_only"),
    official_numeric_layer: asString(
      record.official_numeric_layer,
      "quant_engine",
    ),
    pair_code: asString(record.pair_code),
    as_of_date: asString(record.as_of_date),
    model_version: asString(record.model_version, "unknown"),
    tenors,
  };
}

function priorValidationContextFromPayload(
  value: unknown,
  pairCode: string,
  currentAsOfDate: string,
): PriorValidationContext {
  const record = asRecord(value);
  const items = asArray<JsonRecord>(record.items).map<PriorValidationContextItem>((item) => {
    const tenor = item.primary_trend_aware_tenor;
    const marketSentiment = item.market_sentiment;
    const direction = item.trend_adjustment_direction;
    const priorMarketState = asRecord(item.prior_market_state);
    return {
      validation_run_id: asString(item.validation_run_id),
      as_of_date: asString(item.as_of_date),
      created_at: asString(item.created_at),
      run_source: asString(item.run_source, "unknown"),
      status: asString(item.status),
      confidence:
        typeof item.confidence === "number" && Number.isFinite(item.confidence)
          ? item.confidence
          : null,
      market_sentiment: isMarketSentiment(marketSentiment) ? marketSentiment : null,
      trend_adjustment_direction: isTrendAdjustmentDirection(direction) ? direction : null,
      trend_adjustment_pct:
        typeof item.trend_adjustment_pct === "number" &&
        Number.isFinite(item.trend_adjustment_pct)
          ? item.trend_adjustment_pct
          : null,
      trend_adjustment_confidence:
        typeof item.trend_adjustment_confidence === "number" &&
        Number.isFinite(item.trend_adjustment_confidence)
          ? item.trend_adjustment_confidence
          : null,
      primary_trend_aware_tenor: isTrendAwareTenor(tenor) ? tenor : null,
      deterministic_primary_trend_multiplier:
        typeof item.deterministic_primary_trend_multiplier === "number" &&
        Number.isFinite(item.deterministic_primary_trend_multiplier)
          ? item.deterministic_primary_trend_multiplier
          : null,
      recommended_primary_trend_multiplier:
        typeof item.recommended_primary_trend_multiplier === "number" &&
        Number.isFinite(item.recommended_primary_trend_multiplier)
          ? item.recommended_primary_trend_multiplier
          : null,
      expected_signal_horizon_days:
        typeof item.expected_signal_horizon_days === "number" &&
        Number.isFinite(item.expected_signal_horizon_days)
          ? item.expected_signal_horizon_days
          : null,
      expected_signal_valid_until: asString(item.expected_signal_valid_until) || null,
      prior_market_state: {
        market_data_provider:
          asString(priorMarketState.market_data_provider) || null,
        observed_spot_rate:
          typeof priorMarketState.observed_spot_rate === "number" &&
          Number.isFinite(priorMarketState.observed_spot_rate)
            ? priorMarketState.observed_spot_rate
            : null,
        prior_close:
          typeof priorMarketState.prior_close === "number" &&
          Number.isFinite(priorMarketState.prior_close)
            ? priorMarketState.prior_close
            : null,
        day_change_pct:
          typeof priorMarketState.day_change_pct === "number" &&
          Number.isFinite(priorMarketState.day_change_pct)
            ? priorMarketState.day_change_pct
            : null,
        regime: asString(priorMarketState.regime) || null,
      },
      validation_summary: asString(item.validation_summary),
      trend_aware_validation_summary: asString(item.trend_aware_validation_summary),
      trend_adjustment_rationale: asString(item.trend_adjustment_rationale),
      signal_horizon_rationale: asString(item.signal_horizon_rationale),
      trend_driver_evidence: asArray<string>(item.trend_driver_evidence),
      watch_items: asArray<string>(item.watch_items),
      source_titles: asArray<JsonRecord>(item.source_titles).map((source) => ({
        title: asString(source.title) || null,
        source: asString(source.source) || null,
        published_at: asString(source.published_at) || null,
      })),
    };
  });
  const continuity = asRecord(record.continuity_summary);
  const latestPriorRead = asRecord(continuity.latest_prior_read);
  const latestDirection = latestPriorRead.trend_adjustment_direction;

  return {
    memory_mode: asString(record.memory_mode, "none"),
    pair_code: asString(record.pair_code, pairCode),
    current_as_of_date: asString(record.current_as_of_date, currentAsOfDate),
    lookback_days: asNumber(record.lookback_days, 0),
    item_count: asNumber(record.item_count, items.length),
    selection_policy: asString(record.selection_policy) || undefined,
    continuity_summary: {
      active_prior_signal: continuity.active_prior_signal === true,
      latest_prior_read: Object.keys(latestPriorRead).length
        ? {
            as_of_date: asString(latestPriorRead.as_of_date) || null,
            trend_adjustment_direction: isTrendAdjustmentDirection(latestDirection)
              ? latestDirection
              : null,
            expected_signal_valid_until:
              asString(latestPriorRead.expected_signal_valid_until) || null,
          }
        : null,
    },
    items,
  };
}

function snapshotFromRow(row: SnapshotRow): RegimeSnapshot {
  return row.snapshot_payload;
}

function historyFromRow(row: SnapshotRow): RegimeHistoryPoint {
  const payload = row.snapshot_payload;
  return {
    as_of_date: row.as_of_date,
    spot_rate: row.spot_rate,
    day_change_pct: row.day_change_pct,
    regime: isRegime(row.regime) ? row.regime : "NORMAL",
    regime_score: row.regime_score,
    acceleration_vs_252d: row.acceleration_vs_252d,
    vol_7d: row.vol_7d,
    vol_30d: row.vol_30d,
    vol_60d: row.vol_60d,
    vol_90d: row.vol_90d,
    vol_180d: row.vol_180d,
    vol_252d: row.vol_252d,
    trend_30d: row.trend_30d,
    composite_signal: isComposite(row.composite_signal)
      ? row.composite_signal
      : "MIXED_SIGNAL",
    volatility_term_structure: payload.volatility_term_structure,
    dynamic_trend_aware_regime_multiplier:
      payload.dynamic_trend_aware_regime_multiplier,
    hist_var_99_30d: row.hist_var_99_30d,
    fat_tail_ratio: row.fat_tail_ratio,
  };
}

function fallbackResearchBrief(pair: string, asOf: string): ResearchBrief {
  return {
    pair,
    display_pair: displayPair(pair),
    as_of_date: asOf,
    macro_context: "No research brief was stored for this validation run.",
    central_bank_context: "No central-bank context was stored for this validation run.",
    currency_specific_context: "No currency-specific context was stored.",
    market_sentiment_summary: "No market sentiment summary was stored.",
    policy_liquidity_context: "No policy/liquidity context was stored.",
    risk_events: [],
    evidence: [],
    retrieval_model: "unknown",
  };
}

function callRecordFromPayload(value: unknown): LLMCallRecord {
  const record = asRecord(value);
  const role = asString(record.call_role, "scorer");
  return {
    call_role:
      role === "research" || role === "aggregation" || role === "scorer"
        ? role
        : "scorer",
    model: asString(record.model, "unknown"),
    raw_content: asString(record.raw_content),
    parsed_json: asRecord(record.parsed_json),
    citations: asArray<JsonRecord>(record.citations).map((citation) => ({
      url: asString(citation.url),
      title: asString(citation.title),
      content: asString(citation.content),
    })),
    reasoning_content:
      typeof record.reasoning_content === "string" ? record.reasoning_content : null,
  };
}

function validationResultFromPayload(
  value: unknown,
  row: ValidationRow,
  brief: ResearchBrief,
): ValidationResult {
  const record = asRecord(value);
  const pair = asString(record.pair, row.pair_code);
  const status = isValidationStatus(record.status) ? record.status : "insufficient_evidence";
  const regime = isRegime(record.deterministic_regime)
    ? record.deterministic_regime
    : "NORMAL";
  const action = isRecommendedAction(record.recommended_action)
    ? record.recommended_action
    : "rerun_with_deeper_research";
  const deterministicMultipliers = trendAwareMapFromRecord(
    record.deterministic_trend_aware_multipliers ??
      row.deterministic_trend_aware_multipliers,
    asNumber(row.deterministic_primary_trend_multiplier, 0),
  );
  const recommendedMultipliers = trendAwareMapFromRecord(
    record.llm_recommended_trend_aware_multipliers ??
      row.llm_recommended_trend_aware_multipliers,
    asNumber(row.recommended_primary_trend_multiplier, 0),
  );
  const primaryTenor = isTrendAwareTenor(
    record.primary_trend_aware_tenor ?? row.primary_trend_aware_tenor,
  )
    ? (record.primary_trend_aware_tenor ?? row.primary_trend_aware_tenor)
    : "tenor_le_30d";
  const marketSentimentValue = record.market_sentiment ?? row.market_sentiment;
  const marketSentiment: MarketSentiment = isMarketSentiment(marketSentimentValue)
    ? marketSentimentValue
    : "unclear";
  const trendDirectionValue = record.trend_adjustment_direction ?? row.trend_adjustment_direction;
  const trendAdjustmentDirection: TrendAdjustmentDirection = isTrendAdjustmentDirection(
    trendDirectionValue,
  )
    ? trendDirectionValue
    : "insufficient_evidence";

  return {
    pair,
    display_pair: asString(record.display_pair, displayPair(pair)),
    as_of_date: asString(record.as_of_date, row.as_of_date),
    status,
    confidence: asNumber(record.confidence, row.confidence ?? 0),
    deterministic_regime: regime,
    external_context_regime_read: asString(record.external_context_regime_read, regime),
    validation_summary: asString(
      record.validation_summary,
      "Validation output did not include a summary.",
    ),
    rationale: asString(record.rationale, row.rationale ?? ""),
    market_sentiment: marketSentiment,
    trend_aware_validation_summary: asString(
      record.trend_aware_validation_summary,
      asString(record.validation_summary, "No trend-aware summary stored."),
    ),
    deterministic_trend_aware_multipliers: deterministicMultipliers,
    llm_recommended_trend_aware_multipliers: recommendedMultipliers,
    primary_trend_aware_tenor: primaryTenor as keyof TrendAwareMultiplierMap,
    deterministic_primary_trend_multiplier: asNumber(
      record.deterministic_primary_trend_multiplier,
      asNumber(row.deterministic_primary_trend_multiplier, deterministicMultipliers.tenor_le_30d),
    ),
    recommended_primary_trend_multiplier: asNumber(
      record.recommended_primary_trend_multiplier,
      asNumber(row.recommended_primary_trend_multiplier, recommendedMultipliers.tenor_le_30d),
    ),
    trend_adjustment_direction: trendAdjustmentDirection,
    trend_adjustment_pct: asNumber(
      record.trend_adjustment_pct,
      asNumber(row.trend_adjustment_pct, 0),
    ),
    trend_adjustment_confidence: asNumber(
      record.trend_adjustment_confidence,
      asNumber(row.trend_adjustment_confidence, 0),
    ),
    trend_adjustment_rationale: asString(
      record.trend_adjustment_rationale,
      asString(record.rationale, row.rationale ?? ""),
    ),
    trend_driver_evidence: asArray<string>(record.trend_driver_evidence),
    expected_signal_horizon_days: asNumber(record.expected_signal_horizon_days, 1),
    expected_signal_valid_until: asString(
      record.expected_signal_valid_until,
      addDaysIso(row.as_of_date, 1),
    ),
    signal_horizon_rationale: asString(
      record.signal_horizon_rationale,
      "No signal horizon rationale was stored for this validation run.",
    ),
    output_quality_flags: asArray<string>(record.output_quality_flags),
    supporting_points: asArray<string>(record.supporting_points),
    contradicting_points: asArray<string>(record.contradicting_points),
    watch_items: asArray<string>(record.watch_items),
    recommended_action: action,
    scorer_model: asString(record.scorer_model, row.model_name),
    prompt_version: asString(record.prompt_version, row.prompt_version ?? "unknown"),
    research_brief: brief,
  };
}

function validationFromRow(row: ValidationRow): ValidationRun {
  const input = asRecord(row.input_payload);
  const deterministicInput = asRecord(input.deterministic_payload);
  const output = asRecord(row.output_payload);
  const briefPayload = output.research_brief ?? asRecord(output.validation_result).research_brief;
  const brief = {
    ...fallbackResearchBrief(row.pair_code, row.as_of_date),
    ...asRecord(briefPayload),
  } as ResearchBrief;
  const result = validationResultFromPayload(output.validation_result, row, brief);
  const independent = asArray(output.independent_scorer_results).map((item) =>
    validationResultFromPayload(item, row, brief),
  );
  const priorContext = priorValidationContextFromPayload(
    output.prior_validation_context,
    row.pair_code,
    row.as_of_date,
  );

  return {
    id: row.id,
    pair_code: row.pair_code,
    as_of_date: row.as_of_date,
    status: isValidationStatus(row.status) ? row.status : result.status,
    model_name: row.model_name,
    prompt_version: row.prompt_version,
    run_source: validationRunSource(row.run_source),
    experiment_id: row.experiment_id,
    experiment_variant: row.experiment_variant,
    research_brief_hash: row.research_brief_hash,
    is_shadow: row.is_shadow ?? true,
    confidence: row.confidence,
    rationale: row.rationale,
    market_sentiment: isMarketSentiment(row.market_sentiment) ? row.market_sentiment : null,
    trend_adjustment_direction: isTrendAdjustmentDirection(row.trend_adjustment_direction)
      ? row.trend_adjustment_direction
      : null,
    trend_adjustment_pct: row.trend_adjustment_pct,
    trend_adjustment_confidence: row.trend_adjustment_confidence,
    deterministic_primary_trend_multiplier: row.deterministic_primary_trend_multiplier,
    recommended_primary_trend_multiplier: row.recommended_primary_trend_multiplier,
    primary_trend_aware_tenor: isTrendAwareTenor(row.primary_trend_aware_tenor)
      ? row.primary_trend_aware_tenor
      : null,
    deterministic_trend_aware_multipliers: row.deterministic_trend_aware_multipliers
      ? trendAwareMapFromRecord(row.deterministic_trend_aware_multipliers)
      : null,
    llm_recommended_trend_aware_multipliers: row.llm_recommended_trend_aware_multipliers
      ? trendAwareMapFromRecord(row.llm_recommended_trend_aware_multipliers)
      : null,
    created_at: row.created_at,
    result,
    independent_ml_shadow_context: mlShadowContextFromPayload(
      deterministicInput.independent_ml_shadow_context,
    ),
    prior_validation_context: priorContext,
    independent_scorer_results: independent,
    raw_model_responses: asArray(output.raw_model_responses).map(callRecordFromPayload),
  };
}

async function latestSnapshotRows(): Promise<SnapshotRow[]> {
  return supabaseGet<SnapshotRow>("latest_market_regime_snapshots", {
    select: "*",
    order: "pair_code.asc",
  });
}

export async function getAsOf(): Promise<string | null> {
  return withFallback(
    async () => {
      const rows = await latestSnapshotRows();
      return rows.reduce<string | null>(
        (latest, row) => (!latest || row.as_of_date > latest ? row.as_of_date : latest),
        null,
      );
    },
    () => getMockAsOf(),
  );
}

export async function getSupportedPairs(): Promise<string[]> {
  return withFallback(
    async () => (await latestSnapshotRows()).map((row) => row.pair_code),
    () => getMockSupportedPairs(),
  );
}

export async function getLatestSnapshots(): Promise<RegimeSnapshot[]> {
  return withFallback(
    async () => (await latestSnapshotRows()).map(snapshotFromRow),
    () => getMockLatestSnapshots(),
  );
}

export async function getSnapshot(pair: string): Promise<RegimeSnapshot | null> {
  const code = pair.toUpperCase();
  return withFallback(
    async () => {
      const rows = await supabaseGet<SnapshotRow>("latest_market_regime_snapshots", {
        select: "*",
        pair_code: `eq.${code}`,
        limit: 1,
      });
      return rows[0] ? snapshotFromRow(rows[0]) : null;
    },
    () => getMockSnapshot(code),
  );
}

export async function getHistory(pair: string): Promise<RegimeHistoryPoint[]> {
  const code = pair.toUpperCase();
  return withFallback(
    async () => {
      const rows = await supabaseGet<SnapshotRow>("market_regime_snapshots", {
        select: "*",
        pair_code: `eq.${code}`,
        order: "as_of_date.desc",
        limit: 180,
      });
      return rows.map(historyFromRow).reverse();
    },
    () => getMockHistory(code),
  );
}

export async function getPrices(pair: string): Promise<RawPriceObservation[]> {
  const code = pair.toUpperCase();
  return withFallback(
    async () => {
      const rows = await supabaseGet<RawPriceObservation>("raw_price_observations", {
        select: "observed_on,close_raw,close_display",
        pair_code: `eq.${code}`,
        order: "observed_on.desc",
        limit: 180,
      });
      return rows.reverse();
    },
    () => getMockPrices(code),
  );
}

export async function getProviderRuns(pair?: string): Promise<ProviderRun[]> {
  const code = pair?.toUpperCase();
  return withFallback(
    async () =>
      supabaseGet<ProviderRun>("provider_runs", {
        select: "*",
        pair_code: code ? `eq.${code}` : undefined,
        order: "created_at.desc",
        limit: 300,
      }),
    () => getMockProviderRuns(code),
  );
}

export async function getAllValidations(): Promise<ValidationRun[]> {
  return withFallback(
    async () => {
      const rows = await supabaseGet<ValidationRow>("latest_llm_validation_runs", {
        select: "*",
        order: "pair_code.asc",
      });
      return rows.map(validationFromRow);
    },
    () => getMockAllValidations(),
  );
}

export async function getValidation(pair: string): Promise<ValidationRun | null> {
  const code = pair.toUpperCase();
  return withFallback(
    async () => {
      const rows = await supabaseGet<ValidationRow>("latest_llm_validation_runs", {
        select: "*",
        pair_code: `eq.${code}`,
        limit: 1,
      });
      return rows[0] ? validationFromRow(rows[0]) : null;
    },
    () => getMockValidation(code),
  );
}

/** Every validation run for one pair (a pair can be validated many times). */
export async function getValidationsForPair(pair: string): Promise<ValidationRun[]> {
  const code = pair.toUpperCase();
  return withFallback(
    async () => {
      const rows = await supabaseGet<ValidationRow>("llm_validation_runs", {
        select: "*",
        pair_code: `eq.${code}`,
        order: "created_at.desc",
        limit: 100,
      });
      return rows.map(validationFromRow);
    },
    () => {
      const run = getMockValidation(code);
      return run ? [run] : [];
    },
  );
}

/** Every validation run across all pairs, newest first (the validation log). */
export async function getValidationRuns(): Promise<ValidationRun[]> {
  return withFallback(
    async () => {
      const rows = await supabaseGet<ValidationRow>("llm_validation_runs", {
        select: "*",
        order: "created_at.desc",
        limit: 300,
      });
      return rows.map(validationFromRow);
    },
    () => getMockAllValidations(),
  );
}

export async function getBenchmarkResults(): Promise<BenchmarkResult[]> {
  return withFallback(
    async () => {
      const rows = await supabaseGet<BenchmarkRow>("benchmark_results", {
        select: "*",
        order: "maturity_date.desc",
        limit: 1000,
      });
      return rows.map((row) => ({
        ...row,
        tenor_key: isTrendAwareTenor(row.tenor_key) ? row.tenor_key : "tenor_le_30d",
        llm_direction: isTrendAdjustmentDirection(row.llm_direction)
          ? row.llm_direction
          : "insufficient_evidence",
      }));
    },
    () => getMockBenchmarkResults(),
  );
}

export async function getSignalHorizonBenchmarkResults(): Promise<SignalHorizonBenchmarkResult[]> {
  return withFallback(
    async () => {
      const rows = await supabaseGet<SignalHorizonBenchmarkRow>("signal_horizon_benchmark_results", {
        select: "*",
        order: "maturity_date.desc",
        limit: 1000,
      });
      return rows.map((row) => ({
        ...row,
        tenor_key: isTrendAwareTenor(row.tenor_key) ? row.tenor_key : "tenor_le_30d",
        llm_direction: isTrendAdjustmentDirection(row.llm_direction)
          ? row.llm_direction
          : "insufficient_evidence",
      }));
    },
    () => getMockSignalHorizonBenchmarkResults(),
  );
}

export async function getBenchmarkEvaluationStatuses(): Promise<BenchmarkEvaluationStatus[]> {
  return withFallback(
    async () => {
      const rows = await supabaseGet<BenchmarkEvaluationStatus>(
        "benchmark_evaluation_statuses",
        {
          select: "*",
          order: "as_of_date.desc",
          limit: 5000,
        },
      );
      return rows.map((row) => ({
        ...row,
        tenor_key: isTrendAwareTenor(row.tenor_key) ? row.tenor_key : "tenor_le_30d",
      }));
    },
    () => [],
  );
}

export async function getMLMultiplierModels(): Promise<MLMultiplierModel[]> {
  return withFallback(
    async () =>
      supabaseGet<MLMultiplierModelRow>("ml_multiplier_models", {
        select:
          "id,model_key,display_name,model_version,status,output_role,artifact_sha256," +
          "feature_schema,hyperparameters,training_first_date,training_last_as_of_date," +
          "latest_label_available_on,training_rows,holdout_metrics,rolling_metrics," +
          "gate_report,sklearn_version,trained_at,activated_at,run_source,created_at",
        order: "trained_at.desc",
        limit: 50,
      }),
    () => getMockMLMultiplierModels(),
  );
}

export async function getMLMultiplierPredictions(): Promise<MLMultiplierPrediction[]> {
  return withFallback(
    async () => {
      const rows = await supabaseGet<MLMultiplierPredictionRow>(
        "ml_multiplier_predictions",
        {
          select:
            "id,model_id,market_regime_snapshot_id,pair_code,as_of_date,tenor_key," +
            "horizon_days,quant_multiplier,ml_multiplier,difference_vs_quant,base_vol," +
            "quant_implied_vol,ml_implied_vol,prediction_status,model_version,output_role," +
            "is_shadow,evaluation_status,evaluation_reason,evaluated_at,created_at",
          order: "as_of_date.desc,horizon_days.asc",
          limit: 5000,
        },
      );
      return rows.map((row) => ({
        ...row,
        tenor_key: isTrendAwareTenor(row.tenor_key)
          ? row.tenor_key
          : "tenor_le_30d",
      }));
    },
    () => getMockMLMultiplierPredictions(),
  );
}

export async function getMLMultiplierBenchmarks(): Promise<MLMultiplierBenchmarkResult[]> {
  return withFallback(
    async () => {
      const rows = await supabaseGet<MLMultiplierBenchmarkRow>(
        "ml_multiplier_benchmark_results",
        {
          select: "*",
          order: "evaluation_market_date.desc,horizon_days.asc",
          limit: 5000,
        },
      );
      return rows.map((row) => ({
        ...row,
        tenor_key: isTrendAwareTenor(row.tenor_key)
          ? row.tenor_key
          : "tenor_le_30d",
      }));
    },
    () => getMockMLMultiplierBenchmarks(),
  );
}

export async function getMaturityRiskForecasts(): Promise<MaturityRiskForecast[]> {
  return withFallback(
    async () =>
      supabaseGet<MaturityRiskForecast>("latest_maturity_risk_forecasts", {
        select: "*",
        order: "as_of_date.desc,candidate_type.asc,horizon_days.asc",
        limit: 3000,
      }),
    getMockMaturityRiskForecasts,
  );
}

export async function getMaturityRiskBenchmarks(): Promise<MaturityRiskBenchmarkResult[]> {
  return withFallback(
    async () =>
      supabaseGet<MaturityRiskBenchmarkResult>("maturity_risk_benchmark_results", {
        select: "*",
        horizon_days: "in.(1,3,5,7,10,14,21,30,45,60,90,120,180,252)",
        order: "evaluation_market_date.desc,horizon_days.asc",
        limit: 10000,
      }),
    getMockMaturityRiskBenchmarks,
  );
}

export async function getMaturityRiskPolicies(): Promise<MaturityRiskPolicy[]> {
  return withFallback(
    async () =>
      supabaseGet<MaturityRiskPolicy>("maturity_risk_policies", {
        select: "*",
        order: "created_at.desc",
        limit: 50,
      }),
    getMockMaturityRiskPolicies,
  );
}

export function getDataSourceStatus(): ObservatoryDataSourceStatus {
  const mode = dataSourceMode();
  const configured = supabaseConfig() !== null;
  const source = shouldUseSupabase() ? "supabase" : "mock";
  return {
    source,
    mode,
    configured,
    production_safe:
      source === "supabase" && configured && process.env.NODE_ENV === "production",
    checked_at: new Date().toISOString(),
  };
}
