# GC Command Center

GC Command Center is the production dashboard for short-dated COMEX Gold (GC) options and connected MT5 signal feeds.

## Source of truth

**Barchart:** CSV import only. The dashboard opens Barchart, the user downloads the CSV with Barchart's own Download button, and the dashboard imports that file. Do not reintroduce server-side Barchart scraping/session logic or replace Barchart with another data provider.

**MT5:** signals arrive through `POST /api/mt5/ingest` and are read through `GET /api/mt5/state`. Supported feeds are WIN, XAU5, and XAU1. Supported tiers are early, partial, confirmed, and watch.

## Project structure

- `app/page.tsx` — main dashboard and UI state
- `app/globals.css` — dashboard styling
- `app/components/BarchartCsvImport.tsx` — Barchart CSV import flow
- `app/api/mt5/ingest/route.ts` — MT5 signal receiver
- `app/api/mt5/state/route.ts` — MT5 state endpoint
- `app/lib/mt5Store.ts` — current in-memory MT5 store
- `app/layout.tsx` — metadata
- `app/icon.svg` — CC favicon

## Development rule

**`main` is the canonical branch.** Start every new change from the latest `main`, make one focused change, build/type-check, commit clearly, deploy, verify production, and then begin the next change.

`dropdown-theme-fix` is historical context for the MT5 work that was consolidated into `main`. Do not use it as the normal development branch.

## Guardrails

- Keep the working Barchart CSV workflow.
- Do not add demo/fake option data.
- Do not silently change the options scoring engine during UI work.
- Keep UI, data parsing, options scoring, MT5, and infrastructure changes separate when practical.
- Never commit credentials or tokens.

## Production

Primary production domain: `https://gccommandcenter.vercel.app/`

The current MT5 store is runtime memory, not permanent database storage. Moving it to persistent storage is a separate architecture change.
