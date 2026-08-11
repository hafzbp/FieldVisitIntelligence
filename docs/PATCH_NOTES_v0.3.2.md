# Patch Notes — v0.3.1 → v0.3.2

## Result
Database trigger hotfix synchronized into the repository as a formal migration.

## Previous version
v0.3.1 — Supabase-connected frontend with schema version `202608110002`.

## New version
v0.3.2 — schema version `202608110003`.

## Root cause
Migration `202608110001_initial_fvi_schema.sql` attached one generic `touch_updated_at()` trigger to `profiles`, `visits`, and `calls`. That function attempted to set `new.last_edited_by = auth.uid()` for every table. `public.profiles` does not contain a `last_edited_by` column, causing profile updates such as changing a user role from `jovis` to `admin` to fail with PostgreSQL error 42703.

## What changed
- Added `public.touch_updated_at()` for timestamp-only tables.
- Added `public.touch_updated_at_with_editor()` for tables that contain `last_edited_by`.
- Rebound `trg_profiles_touch` to timestamp-only behavior.
- Rebound `trg_visits_touch` and `trg_calls_touch` to editor-aware behavior.
- Bumped application version, service-worker cache, export metadata, and schema metadata to v0.3.2.

## Exact revised locations
- `supabase/migrations/202608110003_fix_update_triggers.sql` — new migration.
- `src/config/app-config.js` — version bump.
- `src/export/exporter.js` — export version label.
- `sw.js` — cache namespace bump.
- `version.json` — app/schema version.
- `docs/CHANGELOG.md`, `docs/PATCH_NOTES.md`, `docs/QA_REPORT.md` — handover documentation.

## Business-logic impact
No intended change to field-visit business rules. The fix restores the ability to maintain profile roles while preserving editor tracking for visit/call records.

## IT-logic / architecture impact
Trigger responsibilities are now aligned with table schemas instead of assuming identical audit columns across tables.

## Rollback
Rollback target: v0.3.1 frontend. Database rollback is normally unnecessary because the v0.3.2 trigger split is backward-compatible. If required, the previous generic trigger can be recreated, but this would reintroduce the profile-update defect and is not recommended.
