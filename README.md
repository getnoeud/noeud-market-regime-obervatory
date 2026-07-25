# Noeud Regime Observatory

Internal dashboard for the [Noeud Market Regime](../noeud-market-regime) deterministic FX market-regime engine and its LLM validation layer.

It surfaces, for every supported pair, the full deterministic snapshot (volatility, trend, acceleration, regime, term structure, multipliers, VaR, hedge cost, backtest, integrity checks), the LLM validation trace (status, confidence, research brief, evidence, ensemble scorers, raw model responses), and ingestion provenance (provider runs).

## Stack

- Next.js App Router (16) + TypeScript
- shadcn/ui (`radix-rhea` registry) for every component
- Recharts via the shadcn chart wrapper
- TanStack Query (data fetching) + TanStack Table (sortable tables)
- Zustand (filter state) · next-themes · sonner

## Pages

| Route | Purpose |
| --- | --- |
| `/` | Overview — KPI cards, regime distribution, acceleration leaderboard, all-pairs table |
| `/pairs` | Pair grid (searchable) |
| `/pairs/[pair]` | Full per-pair snapshot, charts, and inline validation |
| `/validation` | Validation overview — status KPIs and runs table |
| `/validation/[pair]` | Full LLM validation trace for a pair |
| `/performance` | Performance Lab — benchmark metrics, Memory A/B experiments, and matured outcomes |
| `/data-health` | Provider runs and ingestion status |
| `/help` | Methodology — regime bands, metrics, the validation pipeline |

Performance Lab filter behavior and usage examples are documented in
[`docs/performance-lab-filters.md`](docs/performance-lab-filters.md).

## Data layer

The frontend reads through same-origin Next.js route handlers. Those handlers use
Supabase when explicitly selected, or the deterministic fixture dataset when mock
mode is selected. A failed Supabase request never falls back to mock data because
mixing live and fixture rows would make the dashboard misleading.

```
UI (hooks/use-regime.ts)
  -> lib/api.ts (axios, same-origin /api)
    -> app/api/* route handlers
      -> lib/server-data.ts
        -> Supabase REST tables/views when configured
        -> lib/mock/dataset.ts fixtures otherwise
```

Set:

```bash
OBSERVATORY_DATA_SOURCE=supabase      # auto | supabase | mock
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...         # preferred for server routes
# or SUPABASE_ANON_KEY=...            # works for read-only RLS policies
```

The live reader uses:

- `latest_market_regime_snapshots`
- `market_regime_snapshots`
- `raw_price_observations`
- `provider_runs`
- `latest_llm_validation_runs`

`lib/mock/*` remains a deterministic, seeded re-implementation of the engine so
the UI is still demoable before Supabase is configured.

### Switching Data Sources Locally

Use either explicit command:

```bash
npm run dev:mock       # fixture data; header badge says MOCK
npm run dev:supabase   # live Supabase; header badge says SUPABASE
```

Or change `OBSERVATORY_DATA_SOURCE` in `.env`, stop the running dev server with
`Ctrl+C`, and start it again. Refreshing the browser is not enough because these
variables are read by the Next.js server process.

Before using live mode for this stabilization release, apply:

```text
../noeud-market-regime/supabase/20260719_performance_stabilization.sql
```

If that migration is missing, the Performance Lab intentionally reports a
Supabase contract error instead of showing mock evaluation health beside live
benchmark rows.

For a Vercel deployment, set `OBSERVATORY_DATA_SOURCE=supabase`, `SUPABASE_URL`,
and the server-only Supabase key in the Vercel project environment. Then redeploy;
changing the local `.env` or refreshing the deployed page does not update Vercel's
runtime environment.

Point the client at an external API instead by setting `NEXT_PUBLIC_API_BASE_URL`.

## Contracts

`lib/types.ts` mirrors the backend shapes exactly:

- the sectioned per-pair payload from `presentation/market_regime_payload.py`
- the persisted records in `storage/models.py`
- the LLM validation contracts in `intelligence/models.py`

## Develop

```bash
npm install
npm run dev:mock       # http://localhost:3000 with fixtures
npm run dev:supabase   # http://localhost:3000 with live Supabase
npm run build    # production build
npm run lint
```
