/**
 * Domain types for the Noeud Market Regime Observatory.
 *
 * These mirror the contracts produced by the `noeud-market-regime` service:
 *  - the sectioned per-pair payload from `presentation/market_regime_payload.py`
 *  - the persisted records in `storage/models.py`
 *  - the LLM validation contracts in `intelligence/models.py`
 *
 * The frontend reads these shapes from same-origin Next.js route handlers
 * (Supabase-backed in deployed environments, fixture-backed only in explicit local mode). Keeping the types
 * aligned to the backend payload makes the eventual swap a drop-in change.
 */

export const REGIME_LABELS = [
  "CALM",
  "NORMAL",
  "ELEVATED",
  "STRESSED",
  "CRISIS",
] as const;
export type RegimeLabel = (typeof REGIME_LABELS)[number];

export type TrendSignal = "RISING" | "FLAT" | "FALLING";
export type CompositeSignal =
  | "STRONG_RISING"
  | "STRONG_FALLING"
  | "FLAT"
  | "MIXED_SIGNAL";
export type BacktestStatus = "PASS" | "ACCEPTABLE" | "FAIL";

// --- Sectioned per-pair payload ------------------------------------------

export type LiveSpotRates = {
  currency_pair: string;
  spot_rate: number | null;
  prior_close: number | null;
  day_change: number | null;
  day_change_pct: number | null;
  market_data_provider: string;
  data_source: string;
};

export type VolatilityReadings = {
  currency: string;
  vol_7d: number;
  vol_30d: number;
  vol_60d: number;
  vol_90d: number;
  vol_180d: number;
  vol_252d: number;
  accel_vs_252d: number;
  regime: RegimeLabel;
  regime_score: number;
};

export type VolatilityTrendSignals = {
  currency: string;
  trend_10d: number;
  trend_30d: number;
  trend_90d: number;
  short_signal: TrendSignal;
  med_signal: TrendSignal;
  long_signal: TrendSignal;
  composite_signal: CompositeSignal;
};

export type VolatilityTermStructure = {
  currency_pair: string;
  tenor_le_7d: number;
  tenor_le_30d: number;
  tenor_le_60d: number;
  tenor_le_90d: number;
  tenor_le_180d: number;
  tenor_gt_180d: number;
};

export type RegimeMultipliers = {
  currency: string;
  tenor_le_14d: number;
  tenor_le_30d: number;
  tenor_le_60d: number;
  tenor_le_90d: number;
  tenor_le_180d: number;
  tenor_gt_180d: number;
  trend_signal: CompositeSignal;
  confidence: string;
};

export type HedgeCostParameters = {
  currency_pair: string;
  fwd_cost_annual_pct: number;
  typical_bid_ask_spread: number;
  hedgeability_score: number;
  notes: string;
};

export type HistoricalVar = {
  currency_pair: string;
  hist_var_99_1day: number;
  hist_var_99_30day: number;
  parametric_var_30d: number;
  fat_tail_ratio: number;
};

export type BacktestValidation = {
  var_99_coverage: number;
  target_coverage: number;
  system_status: BacktestStatus;
};

export type SystemValidationChecks = {
  spot_rates_loaded: boolean;
  multipliers_in_valid_range: boolean;
  term_structure_complete: boolean;
  historical_var_available: boolean;
};

/** Full sectioned payload for one pair, as returned by the regime service. */
export type RegimeSnapshot = {
  pair: string;
  display_pair: string;
  as_of_date: string;
  market_data_provider: string;
  live_spot_rates: LiveSpotRates;
  current_volatility_readings: VolatilityReadings;
  volatility_trend_signals: VolatilityTrendSignals;
  volatility_term_structure: VolatilityTermStructure;
  dynamic_trend_aware_regime_multiplier: RegimeMultipliers;
  hedge_cost_parameters: HedgeCostParameters;
  historical_var: HistoricalVar;
  backtest_validation_results: BacktestValidation;
  system_validation_checks: SystemValidationChecks;
};

// --- History (one row per stored snapshot) -------------------------------

export type RegimeHistoryPoint = {
  as_of_date: string;
  spot_rate: number;
  day_change_pct: number;
  regime: RegimeLabel;
  regime_score: number;
  acceleration_vs_252d: number;
  vol_7d: number;
  vol_30d: number;
  vol_60d: number;
  vol_90d: number;
  vol_180d: number;
  vol_252d: number;
  trend_30d: number;
  composite_signal: CompositeSignal;
  volatility_term_structure: VolatilityTermStructure;
  dynamic_trend_aware_regime_multiplier: RegimeMultipliers;
  hist_var_99_30d: number;
  fat_tail_ratio: number;
};

// --- Data health: provider runs & raw prices -----------------------------

export type ProviderRun = {
  id: string;
  provider_name: string;
  pair_code: string;
  requested_at: string | null;
  completed_at: string | null;
  status: string;
  row_count: number;
  source_detail: Record<string, unknown> | null;
};

export type RawPriceObservation = {
  observed_on: string;
  close_raw: number;
  close_display: number;
};

// --- LLM validation layer ------------------------------------------------

export type ResearchEvidenceItem = {
  title: string;
  url: string;
  source: string;
  published_at: string | null;
  excerpt: string;
  relevance_score: number;
  retrieved_at?: string | null;
  source_tier?: string | null;
  citation_origin?: string | null;
};

export type ResearchBrief = {
  pair: string;
  display_pair: string;
  as_of_date: string;
  macro_context: string;
  central_bank_context: string;
  currency_specific_context: string;
  market_sentiment_summary: string;
  policy_liquidity_context: string;
  risk_events: string[];
  evidence: ResearchEvidenceItem[];
  retrieval_model: string;
};

export type ValidationStatus =
  | "supports"
  | "partially_supports"
  | "contradicts"
  | "insufficient_evidence";

export type RecommendedAction =
  | "accept_deterministic_read"
  | "monitor_closely"
  | "escalate_for_human_review"
  | "rerun_with_deeper_research";

export type MarketSentiment =
  | "volatility_dampening"
  | "volatility_amplifying"
  | "mixed"
  | "unclear";

export type TrendAdjustmentDirection =
  | "increase"
  | "decrease"
  | "hold"
  | "insufficient_evidence";

export type ValidationRunSource =
  | "scheduled"
  | "manual"
  | "backfill"
  | "experiment"
  | "test"
  | "unknown";

export type TrendAwareMultiplierMap = {
  tenor_le_14d: number;
  tenor_le_30d: number;
  tenor_le_60d: number;
  tenor_le_90d: number;
  tenor_le_180d: number;
  tenor_gt_180d: number;
};

export type LLMCitation = {
  url: string;
  title: string;
  content: string;
};

export type LLMCallRecord = {
  call_role: "research" | "scorer" | "aggregation";
  model: string;
  raw_content: string;
  parsed_json: Record<string, unknown>;
  citations: LLMCitation[];
  reasoning_content: string | null;
};

export type PriorValidationContextItem = {
  validation_run_id: string;
  as_of_date: string;
  created_at: string;
  run_source: string;
  status: string;
  confidence: number | null;
  market_sentiment: MarketSentiment | null;
  trend_adjustment_direction: TrendAdjustmentDirection | null;
  trend_adjustment_pct: number | null;
  trend_adjustment_confidence: number | null;
  primary_trend_aware_tenor: keyof TrendAwareMultiplierMap | null;
  deterministic_primary_trend_multiplier: number | null;
  recommended_primary_trend_multiplier: number | null;
  expected_signal_horizon_days: number | null;
  expected_signal_valid_until: string | null;
  prior_market_state?: {
    market_data_provider: string | null;
    observed_spot_rate: number | null;
    prior_close: number | null;
    day_change_pct: number | null;
    regime: string | null;
  };
  validation_summary: string;
  trend_aware_validation_summary: string;
  trend_adjustment_rationale: string;
  signal_horizon_rationale: string;
  trend_driver_evidence: string[];
  watch_items: string[];
  source_titles: {
    title: string | null;
    source: string | null;
    published_at: string | null;
  }[];
};

export type PriorValidationContext = {
  memory_mode: string;
  pair_code: string;
  current_as_of_date: string;
  lookback_days: number;
  item_count: number;
  selection_policy?: string;
  continuity_summary?: {
    active_prior_signal: boolean;
    latest_prior_read: {
      as_of_date: string | null;
      trend_adjustment_direction: TrendAdjustmentDirection | null;
      expected_signal_valid_until: string | null;
    } | null;
  };
  items: PriorValidationContextItem[];
};

export type ValidationResult = {
  pair: string;
  display_pair: string;
  as_of_date: string;
  status: ValidationStatus;
  confidence: number;
  deterministic_regime: RegimeLabel;
  external_context_regime_read: string;
  validation_summary: string;
  rationale: string;
  market_sentiment: MarketSentiment;
  trend_aware_validation_summary: string;
  deterministic_trend_aware_multipliers: TrendAwareMultiplierMap;
  llm_recommended_trend_aware_multipliers: TrendAwareMultiplierMap;
  primary_trend_aware_tenor: keyof TrendAwareMultiplierMap;
  deterministic_primary_trend_multiplier: number;
  recommended_primary_trend_multiplier: number;
  trend_adjustment_direction: TrendAdjustmentDirection;
  trend_adjustment_pct: number;
  trend_adjustment_confidence: number;
  trend_adjustment_rationale: string;
  trend_driver_evidence: string[];
  expected_signal_horizon_days: number;
  expected_signal_valid_until: string;
  signal_horizon_rationale: string;
  output_quality_flags: string[];
  supporting_points: string[];
  contradicting_points: string[];
  watch_items: string[];
  recommended_action: RecommendedAction;
  scorer_model: string;
  prompt_version: string;
  research_brief: ResearchBrief;
};

/** One persisted LLM validation run with its full audit trace. */
export type ValidationRun = {
  id: string;
  pair_code: string;
  as_of_date: string;
  status: ValidationStatus;
  model_name: string;
  prompt_version: string | null;
  run_source: ValidationRunSource;
  experiment_id: string | null;
  experiment_variant: string | null;
  research_brief_hash: string | null;
  is_shadow: boolean;
  confidence: number | null;
  rationale: string | null;
  market_sentiment: MarketSentiment | null;
  trend_adjustment_direction: TrendAdjustmentDirection | null;
  trend_adjustment_pct: number | null;
  trend_adjustment_confidence: number | null;
  deterministic_primary_trend_multiplier: number | null;
  recommended_primary_trend_multiplier: number | null;
  primary_trend_aware_tenor: keyof TrendAwareMultiplierMap | null;
  deterministic_trend_aware_multipliers: TrendAwareMultiplierMap | null;
  llm_recommended_trend_aware_multipliers: TrendAwareMultiplierMap | null;
  created_at: string;
  result: ValidationResult;
  prior_validation_context: PriorValidationContext;
  independent_scorer_results: ValidationResult[];
  raw_model_responses: LLMCallRecord[];
};

export type BenchmarkResult = {
  id: string;
  llm_validation_run_id: string | null;
  market_regime_snapshot_id: string | null;
  pair_code: string;
  as_of_date: string;
  maturity_date: string;
  evaluation_market_date: string | null;
  maturity_rolled: boolean;
  evaluated_at: string;
  tenor_key: keyof TrendAwareMultiplierMap;
  benchmark_method_version: string;
  horizon_days: number;
  quant_multiplier: number;
  llm_multiplier: number;
  baseline_vol_252d: number;
  baseline_vol: number | null;
  baseline_source: string | null;
  quant_implied_vol: number;
  llm_implied_vol: number;
  realized_vol: number;
  realized_abs_return: number;
  realized_max_abs_return: number;
  quant_abs_error: number;
  llm_abs_error: number;
  llm_lift: number;
  llm_direction: TrendAdjustmentDirection;
  direction_hit: boolean;
  quant_undercovered: boolean;
  llm_undercovered: boolean;
  observation_count: number;
  is_canonical: boolean;
  scoring_notes: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

export type SignalHorizonBenchmarkResult = {
  id: string;
  llm_validation_run_id: string | null;
  market_regime_snapshot_id: string | null;
  pair_code: string;
  as_of_date: string;
  expected_signal_horizon_days: number;
  expected_signal_valid_until: string;
  maturity_date: string;
  evaluation_market_date: string | null;
  maturity_rolled: boolean;
  evaluated_at: string;
  tenor_key: keyof TrendAwareMultiplierMap;
  benchmark_method_version: string;
  quant_multiplier: number;
  llm_multiplier: number;
  baseline_vol_252d: number;
  baseline_vol: number | null;
  baseline_source: string | null;
  quant_implied_vol: number;
  llm_implied_vol: number;
  realized_vol: number;
  realized_abs_return: number;
  realized_max_abs_return: number;
  quant_abs_error: number;
  llm_abs_error: number;
  llm_lift: number;
  llm_direction: TrendAdjustmentDirection;
  direction_hit: boolean;
  signal_still_valid: boolean;
  llm_outperformed_quant: boolean | null;
  quant_undercovered: boolean;
  llm_undercovered: boolean;
  observation_count: number;
  memory_item_count: number;
  is_canonical: boolean;
  scoring_notes: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

export type BenchmarkEvaluationStatus = {
  id: string;
  llm_validation_run_id: string;
  pair_code: string;
  as_of_date: string;
  benchmark_kind: "fixed_tenor" | "signal_horizon";
  benchmark_method_version: string;
  tenor_key: keyof TrendAwareMultiplierMap;
  declared_maturity_date: string | null;
  evaluation_market_date: string | null;
  status: "scored" | "pending" | "invalid" | "not_applicable";
  reason: string | null;
  observation_count: number;
  is_canonical: boolean;
  evaluated_at: string;
};

export type MLMultiplierModel = {
  id: string;
  model_key: string;
  display_name: string;
  model_version: string;
  status: "shadow_active" | "shadow_candidate" | "shadow_rejected" | "retired";
  output_role: string;
  artifact_sha256: string;
  feature_schema: string[];
  hyperparameters: Record<string, unknown>;
  training_first_date: string;
  training_last_as_of_date: string;
  latest_label_available_on: string;
  training_rows: number;
  holdout_metrics: Record<string, number>;
  rolling_metrics: Record<string, number>;
  gate_report: {
    official_promotion_eligible?: boolean;
    decision?: string;
    reason?: string;
    passed_segments?: number;
    failed_segments?: number;
    [key: string]: unknown;
  };
  sklearn_version: string;
  trained_at: string;
  activated_at: string | null;
  run_source: string;
  created_at?: string;
};

export type MLMultiplierPrediction = {
  id: string;
  model_id: string;
  market_regime_snapshot_id: string;
  pair_code: string;
  as_of_date: string;
  tenor_key: keyof TrendAwareMultiplierMap;
  horizon_days: number;
  quant_multiplier: number;
  ml_multiplier: number | null;
  difference_vs_quant: number | null;
  base_vol: number;
  quant_implied_vol: number;
  ml_implied_vol: number | null;
  prediction_status: "predicted" | "invalid" | "missing_model";
  model_version: string;
  output_role: string;
  is_shadow: boolean;
  evaluation_status: "pending" | "scored" | "invalid";
  evaluation_reason: string | null;
  evaluated_at: string | null;
  created_at: string;
};

export type MLMultiplierBenchmarkResult = {
  id: string;
  prediction_id: string;
  model_id: string;
  market_regime_snapshot_id: string;
  pair_code: string;
  as_of_date: string;
  maturity_date: string;
  evaluation_market_date: string;
  maturity_rolled: boolean;
  tenor_key: keyof TrendAwareMultiplierMap;
  horizon_days: number;
  benchmark_method_version: string;
  quant_multiplier: number;
  ml_multiplier: number;
  base_vol: number;
  quant_implied_vol: number;
  ml_implied_vol: number;
  realized_vol: number;
  quant_abs_error: number;
  ml_abs_error: number;
  ml_lift: number;
  quant_qlike: number;
  ml_qlike: number;
  quant_undercovered: boolean;
  ml_undercovered: boolean;
  observation_count: number;
  regime: string;
  model_version: string;
  scoring_notes: Record<string, unknown> | null;
  evaluated_at: string;
  created_at?: string;
};

export type MLMultiplierLabResponse = {
  models: MLMultiplierModel[];
  predictions: MLMultiplierPrediction[];
  benchmarks: MLMultiplierBenchmarkResult[];
};

export type ObservatoryDataSourceStatus = {
  source: "supabase" | "mock";
  mode: string;
  configured: boolean;
  production_safe: boolean;
  checked_at: string;
};

// --- Aggregate / list responses ------------------------------------------

export type RegimeOverviewResponse = {
  as_of_date: string | null;
  supported_pairs: string[];
  snapshots: RegimeSnapshot[];
};
