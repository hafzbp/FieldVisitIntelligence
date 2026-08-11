# PATCH NOTES — v0.3.4

## Previous version
v0.3.3

## New version
v0.3.4

## Problem statement
The UI could show `Sync Error · N` without exposing which record failed or the original Supabase error. Cached cloud rows could also carry server-managed audit columns back into later UPSERT payloads. This made field troubleshooting opaque and could cause avoidable database rejections.

## Root cause
1. `cloud-repository.js` forwarded the complete local object during UPSERT. Local objects may originate from Supabase cache and therefore contain server-managed columns such as `created_at`, `updated_at`, and `last_edited_by`.
2. Sync queue errors were only represented as a count in the header. The stored `last_error` was not surfaced in the UI and there was no targeted retry control.
3. Repeated edits before successful sync could create redundant queue operations.
4. The service worker used cache-first GET handling, increasing the chance of seeing a stale frontend immediately after a GitHub Pages release.

## Resolution
- Added explicit Visit/Call client-field whitelists before Supabase UPSERT.
- Added queue coalescing by entity + operation + record ID.
- Added explicit SYNCING/ERROR lifecycle metadata and retry actions.
- Added clickable Sync badge and Sync & QA Diagnostics panel.
- Added per-record error detail, attempt count, Retry, and Retry All Errors.
- Added authenticated diagnostic snapshot that respects current RLS.
- Changed service worker to network-first with cache fallback.

## Exact revised locations
- `src/data/cloud-repository.js` — payload sanitization + diagnostic snapshot.
- `src/data/sync-engine.js` — queue coalescing, status lifecycle, retry APIs, diagnostics.
- `src/ui/app.js` — clickable Sync badge, queue/error UI, diagnostic checks/actions.
- `assets/styles.css` — diagnostics/sync UI styles.
- `sw.js` — v0.3.4 cache + network-first fetch.
- `src/config/app-config.js`, `src/export/exporter.js`, `version.json` — version metadata.
- `tests/unit/test_v034.py` — static/unit QA guard.

## Business logic impact
No intended change to EC/Non-EC, omzet, reason capture, mismatch classification, follow-up logic, taxonomy discovery, or Admin/JOVIS role design.

## IT/architecture impact
Sync becomes diagnosable and recoverable without clearing browser data or re-entering calls. PostgreSQL remains authoritative for server audit/default fields.

## Data impact
No database migration and no local database reset. Existing queue items remain readable. Failed v0.3.x items should automatically retry through the sanitized cloud layer after deployment.

## Rollback
Replace frontend files with v0.3.3. No Supabase rollback is required because schema did not change. Do not clear browser data while unsynced queue items exist.
