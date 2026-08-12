# Changelog

## [0.4.0] - 2026-08-12

### Added
- Primary VISIT vs secondary pure BY WA call method.
- Reason-specific rich Non-EC evidence for PIC, closed store, BMA, financial, refusal, external supplier, price, product, other and unclear cases.
- BMA stock/SKU rows and salesman oversized-order claim capture.
- Post-visit recovery attempts without overwriting original Non-EC.
- Private compressed photo evidence.
- Admin Summary, row-level Detail, Join Visit Map, Q1–Q5 rule-based Analysis and Settings-only administration.
- Export sheets `11_REASON_DETAIL`, `12_STOCK_CHECK`, `13_RECOVERY_ATTEMPTS`, `14_PHOTO_EVIDENCE`.

### Changed
- Physical Visit EC/SC now explicitly excludes pure WhatsApp EC.
- IndexedDB schema upgraded to v2 while retaining database name `fvi_v030`.
- Sync queue processes parent entities before child evidence and protects pending child state during inbound refresh.

### Security
- Added RLS for rich-evidence tables.
- Added private `call-evidence` Storage bucket and signed Admin viewing.
- Retained immutable tombstone protections.

### QA
- 123 automated/static/executable checks PASS, 0 FAIL.
- Target Supabase migration/authenticated workflow, real GPS/camera, photo upload, and full browser E2E remain BLOCKED until deployed smoke testing.

### Migration
- Requires `202608120008_rich_non_ec_admin_intelligence.sql` after successful Migration 007.

## [0.3.10] - 2026-08-12

### Fixed
- Replaced the failed active Migration 006 path with standalone/idempotent Migration 007.
- Legacy exact-SFA backfill now skips soft-deleted Calls and Calls under soft-deleted Visits.
- Runtime SFA provenance normalization returns deleted rows unchanged.

### Preserved
- v0.3.8 tombstone and Call-parent integrity guards remain enabled.
- v0.3.9 exact seven E-Work/SFA options and conservative recovery rules are unchanged.
- Existing Call/Visit IDs, GPS, timestamps, omzet, evidence and legacy SFA values remain intact.

### Added
- Read-only post-migration verification SQL.
- Failed Migration 006 archived under `docs/failed_migrations/` for audit traceability.
- v0.3.9 rollback source package.

### Database
- Active schema migration: `202608120007_exact_sfa_legacy_recovery_tombstone_safe.sql`.
- Schema version is now `202608120007`.

### QA
- Regression/static/unit suites and synthetic export integration executed for v0.3.10.
- Real Supabase execution remains BLOCKED until run in the production project.

## [0.3.9] - 2026-08-12

### Fixed
- Replaced interpreted SFA reason choices with the exact seven options available in E-Work/SFA.
- Reason accuracy no longer trusts the pre-v0.3.9 shared-taxonomy match flag.

### Added
- `sfa_reason_exact_code`, `sfa_capture_type`, and `sfa_recovery_status`.
- Conservative legacy auto-recovery for Stock, Financial/Cash, and Store Closed.
- Admin `SFA Legacy Recovery` queue for ambiguous historical calls.
- SFA data-quality coverage metrics.
- `NON_CAUSAL`, `TAXONOMY_GAP`, and `UNRESOLVED` derived analysis states.
- `10_SFA_RECOVERY` export sheet.

### Database
- Added migration `202608120006_exact_sfa_legacy_recovery.sql`.
- Schema version is now `202608120006`.
- Existing IDs and raw legacy SFA values are preserved.

### QA
- 121 automated assertions PASS / 0 FAIL across retained regression and v0.3.9 suites.
- Synthetic detailed-export XML parse PASS.
- Real Supabase/mobile smoke tests remain BLOCKED until deployment.

## [0.3.7] - 2026-08-11

### Added
- Mandatory GPS check-in gate before starting each new call.
- Check-in and checkout timestamps and coordinates with browser-reported accuracy.
- Automatic `duration_seconds` calculation for time spent at the outlet.
- Store-code (`Kode Toko`) input with fixed `C` prefix and numeric-only entry.
- Dwell-time KPIs and `09_DWELL_TIME_GPS` export sheet.

### Changed
- New-call `call_timestamp` now uses the check-in timestamp for backward compatibility.
- Saving a new call requires a successful checkout location capture.
- Existing-call edit preserves original check-in / checkout timestamps and coordinates.

### Database
- Added migration `202608110004_add_call_checkin_location.sql`.
- Schema version is now `202608110004`.


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

## [0.3.8] - 2026-08-11

### Fixed
- Admin soft-delete now reconciles across all JOVIS/device IndexedDB caches.
- Deleted Visit/Call tombstones are fetched from Supabase and overwrite stale active local copies.
- Stale pending local edits for a cloud-deleted row are discarded instead of resurrecting deleted data.
- Deleted Visit drafts and selected routes are cleaned automatically.

### Added
- 60-second inbound cloud refresh outside active field entry/setup.
- Pull-on-focus / pull-on-visibility for faster cross-device convergence.
- Migration `202608110005_protect_soft_delete_tombstones.sql` for tombstone and Call-parent integrity protection.

### Database
- Schema version is now `202608110005`.

### QA
- 90 PASS / 0 FAIL across retained automated/static regression suites.
