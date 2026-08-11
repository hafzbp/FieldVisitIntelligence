# Changelog

## [0.3.4] - 2026-08-11

### Fixed
- Sanitized Visit and Call cloud UPSERT payloads so server-managed `created_at`, `updated_at`, and `last_edited_by` are never sent from the browser.
- Existing failed queue items can be retried after deployment without re-entering field data.
- Repeated pending UPSERTs for the same record are coalesced into the newest queue item.

### Added
- Clickable Sync badge.
- Sync queue detail with original Supabase error text, entity, attempts, and per-row retry.
- Retry All Errors action.
- In-app QA diagnostics for IndexedDB, Auth session, profile, Supabase visibility/RLS behavior, and queue health.

### Changed
- Service worker GET strategy changed from cache-first to network-first with offline cache fallback to reduce stale GitHub Pages assets after releases.

### Database
- No new SQL migration. Schema remains `202608110003`.

## [0.3.2] - 2026-08-11

### Fixed
- Split the generic update trigger into timestamp-only and editor-aware variants.
- `profiles` updates no longer attempt to write a non-existent `last_edited_by` column.
- `visits` and `calls` continue to record `last_edited_by`.

### Database
- Added migration `202608110003_fix_update_triggers.sql`.
- Schema version is now `202608110003`.

### Frontend
- Version/cache/export metadata bumped to v0.3.2; no intended business-logic change.

## [0.3.1] - 2026-08-11

### Changed
- Connected frontend configuration to Supabase project `gxwysmjttzqppiadryjc`.
- Added publishable browser key configuration.
- Bumped service-worker cache to `fvi-v0.3.1` to prevent stale v0.3.0 configuration.

### Security
- No secret/service-role key is stored in the repository.
- JWKS URL is not required by the browser client.

### Database
- No schema change from v0.3.0. Existing migration set remains `202608110001` + `202608110002`.


## [0.3.0] - 2026-08-11
### Added
- Supabase Auth and database integration architecture.
- Admin/JOVIS authorization through RLS.
- IndexedDB local-first sync queue.
- Mandatory EC omzet.
- Admin consolidated dashboard.
- Call audit trail.
- One active visit per JOVIS.
- Detailed ChatGPT-ready analytical export.
- Unmapped actual-reason discovery module.
- v0.2 local-data migration.
- Service worker / installable web app support.

### Changed
- Operational source of truth moves from localStorage to Supabase.
- v0.2 JSON merge is no longer the normal multi-observer workflow.

## [0.3.3] - 2026-08-11
### Fixed
- Reworked IndexedDB transaction lifecycle to prevent `IDBDatabase: The database connection is closing` startup failures.
- Added automatic IndexedDB connection invalidation/reopen and retry for closing/inactive connection errors.
- Added version-change/connection-close handling so stale browser connections are not reused.

### QA
- Local IndexedDB CRUD/reopen regression test added and passed in Chromium.
- Supabase Auth/RLS end-to-end remains pending real-device verification after deployment.
