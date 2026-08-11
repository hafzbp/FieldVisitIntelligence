# Patch Notes — v0.2.0 → v0.3.0

## Problem
v0.2 stores each observer's visit in a separate browser and requires manual JSON merge for consolidated analysis.

## Root cause
The application had no central identity, central database, or row-level access model.

## Resolution
v0.3 introduces Supabase Auth/Postgres/RLS while retaining a local offline queue.

## Business impact
- Parallel JOVIS field visits become centrally visible to Admin.
- Detailed raw evidence remains exportable for manual ChatGPT analysis.
- Unmapped actual reasons become an explicit research dataset for future E-Work taxonomy design.

## Architecture impact
MAJOR change: single-file/local-only prototype → modular static web app + cloud backend.

## Migration
v0.2 localStorage can be copied into the authenticated user's v0.3 dataset through Settings. Original v0.2 data is not deleted.

## Exact revised locations
- `index.html` — modular application entry point.
- `assets/styles.css` — mobile-first UI.
- `src/config/supabase-config.js` — public Supabase connection configuration.
- `src/config/app-config.js` — version, feature flags, translations, default taxonomy.
- `src/data/local-db.js` — IndexedDB local cache/draft/queue storage.
- `src/data/supabase-client.js` — Supabase browser client.
- `src/data/cloud-repository.js` — database read/write adapter.
- `src/data/sync-engine.js` — offline queue and retry logic.
- `src/auth/auth-service.js` — email/password session flow.
- `src/domain/reason-engine.js` — actual/SFA classification.
- `src/domain/analysis-engine.js` — deterministic consolidated analytics.
- `src/export/exporter.js` — detailed 9-sheet analytical workbook.
- `src/ui/app.js` — JOVIS field flow + Admin command center.
- `supabase/migrations/202608110001_initial_fvi_schema.sql` — schema/RLS/audit/constraints.
- `sw.js` — application caching.

## Previous vs New
| Area | v0.2.0 | v0.3.0 | Reason | Impact |
|---|---|---|---|---|
| Identity | Observer text field | Supabase Auth user | Multi-user ownership | Traceable JOVIS data |
| Storage | Browser localStorage | Supabase + IndexedDB queue | Parallel observers | Central Admin view |
| Consolidation | JSON manual merge | Server dataset | Remove manual merge | Admin sees all authorized rows |
| Security | Device-local only | RLS | User separation | JOVIS cannot read peers |
| Editing | Local overwrite | Cloud update + audit | Admin/JOVIS can edit completed data | Traceability |
| Other reason | Local discovery | Central discovery + detailed export | E-Work taxonomy research | Cross-JOVIS compilation |
| Export | Detailed local workbook | Detailed filtered/consolidated workbook | Manual ChatGPT analysis | Raw evidence retained |
