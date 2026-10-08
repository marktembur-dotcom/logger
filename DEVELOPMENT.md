# Development Guide

## One source of truth

Use **`main`**. The Barchart and MT5 development lines were previously split between `main` and `dropdown-theme-fix`. They are now consolidated into `main` so future changes have one clear path.

## Safe change sequence

`main` → inspect current code → make one focused change → build/type-check → commit → deploy → verify production → next change.

## Change categories

- **UI:** styling, layout, text
- **Barchart CSV:** download/import/parsing
- **Options engine:** ranking and scoring
- **MT5:** ingest/state/feed/tape
- **Infrastructure:** Vercel and environment configuration

Avoid mixing unrelated categories in one change.

## Barchart rules

Barchart is the options data source. The current workflow is Barchart's own CSV download followed by direct import into the dashboard. Do not reintroduce server-side Barchart scraping/session fetching and do not substitute another market-data provider.

Do not invent fields that are absent from an exported CSV. The current Volatility & Greeks export can contain Strike, Type, Latest, IV, Delta, Gamma, Theta, Vega, IV Skew, and Last Trade; Open Interest, Volume, Bid/Ask, and the underlying futures last price are not guaranteed in every export.

## MT5 rules

MT5 authentication uses the server environment variable `MT5_INGEST_TOKEN`. Never put the token in source code, documentation, commits, or client-side JavaScript.

The ingest endpoint validates authorization, source, tier, and signal fields. The dashboard reads state from `/api/mt5/state`.

The current store uses `globalThis.__mt5State`, which is runtime memory. If permanent history is required, that is a separate architecture change and should not be introduced as part of a UI change.

## Commit names

Use specific messages such as:

- `Fix Barchart CSV parser`
- `Style MT5 signal stack`
- `Add MT5 confidence field`
- `Update levels table layout`

Avoid vague messages such as `updates`, `changes`, or `fix stuff`.

## Branch policy

`main` is canonical. If a temporary branch is needed, branch from the latest `main`, for example `feature/mt5-confidence`, and merge it back when complete. Avoid long-lived parallel branches that become alternate versions of the app.

## Production checklist

After deployment verify: dashboard loads; Barchart CSV import works; the current stacked export parses correctly; Levels, Option Chain, and Skew Map work; MT5 Signal Stack and MT5 Tape load; and `gccommandcenter.vercel.app` points to the newest deployment.
