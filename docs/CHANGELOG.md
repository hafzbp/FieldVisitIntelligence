# Changelog

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
