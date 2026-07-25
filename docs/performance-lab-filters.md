# Performance Lab Filter Guide

This guide explains which Performance Lab controls to use, what each filter
changes, and what it deliberately leaves unchanged.

## Two Filter Scopes

Performance Lab has two levels of controls:

1. **Evaluation cohort controls** sit at the top of the page. They change the
   dataset used by headline metrics, charts, cohort health, signal-life
   summaries, and the matured outcome source cohort.
2. **Table filters** sit directly above the Memory A/B collection and Matured
   outcome tape. They only narrow the rows and pagination for their own table.

Use cohort controls when asking a benchmark question such as "How did the
primary method perform for USD/GHS at 30 days?" Use table filters when looking
for individual records without changing the charts or KPIs.

## Memory A/B Collection

The Memory A/B collection contains paired experiments where the snapshot,
scorer model, prompt, and research brief are held constant. Only use of prior
validation memory changes.

| Filter | Purpose |
| --- | --- |
| Currency pair | Restricts the collection to one FX pair. |
| Memory variant | Shows only `memory_on` or `memory_off` runs. |
| Experiment or brief | Searches the experiment ID and research-brief hash. Partial values are accepted. |
| As of from | Inclusive earliest validation market date. |
| As of to | Inclusive latest validation market date. |

Example: select `USDGHS`, leave the variant on **All variants**, and paste part
of an experiment ID to place the memory-on and memory-off rows for that
experiment next to each other.

The count in the section header changes from the full run count to
`matching runs of total runs` while a filter is active.

## Matured Outcome Tape

The Matured outcome tape contains forecasts whose future tenor windows have
enough market data to be scored against realized volatility.

| Filter | Purpose |
| --- | --- |
| Currency pair | Restricts matured rows to one FX pair. |
| Tenor | Restricts rows to one forecast horizon. |
| Evaluated from | Inclusive earliest evaluator timestamp. |
| Evaluated to | Inclusive latest evaluator timestamp. |
| Time | Refines a date boundary when several evaluator runs occurred on the same date. |

The outcome filters do not recalculate the chart or headline metrics. They are
designed for row-level investigation within the cohort already selected at the
top of the page.

## Combining Filters

Table filters use **AND logic**. A row must satisfy every active filter.

For example:

- Currency pair: `EURGHS`
- Tenor: `≤30d`
- Evaluated from: `1 Jul 2026, 00:00`
- Evaluated to: `31 Jul 2026, 23:59`

returns only EUR/GHS 30-day outcomes evaluated during July 2026.

Every filter change:

- resets that table to page one;
- updates the visible matching count;
- updates the number of pagination pages;
- preserves the current sort choice.

## Clearing, Sorting, and Pagination

- Select **Clear filters** to restore the full table dataset.
- Select a column heading to sort ascending or descending.
- Use **Rows per page** to show 10, 20, or 50 rows.
- Use the **Page** selector or arrow controls to move through filtered results.
- Search is case-insensitive and accepts partial experiment IDs or brief hashes.

## Date Semantics

- Memory A/B **As of** filters use the validation market date stored on the run.
- Matured outcome **Evaluated** filters use `evaluated_at` when available, then
  fall back to the evaluation market date or maturity date.
- Date boundaries are inclusive.
- The natural-language date inputs accept phrases such as `two weeks ago` and
  `last Friday`, subject to the available data bounds.
