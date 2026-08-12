# Patch Notes — Field Visit Intelligence v0.4.0

**Previous:** v0.3.10  
**New:** v0.4.0  
**Schema:** 202608120008  
**Release type:** MINOR — new backward-compatible capture and Admin intelligence capabilities

## Objective

Turn the existing field-call logger into a richer JOVIS evidence-capture tool and make the Admin role a dedicated analysis workspace, while preserving all existing Visit/Call IDs, exact SFA recovery, GPS/dwell-time capture, offline sync, and tombstone protections.

## Problem statement

v0.3.10 could capture EC/Non-EC, exact SFA reason, observed reason, GPS, and export, but it did not structurally capture several research questions required for the next join visits:

- whether a Non-EC still had same-day order chance;
- why PIC/Toko Tutup occurred and whether it was recoverable;
- which recovery channel actually worked;
- what BMA products were still present and whether the salesman believed the prior order was oversized;
- pure WhatsApp EC obtained without a physical visit;
- photo evidence;
- detailed Admin row filtering, map sequence, and rule-based research summaries.

## Root cause

The v0.3.x data model had a single Call record as the main grain and only generic reason/follow-up fields. Repeated structures such as SKU stock rows, recovery attempts, and photos could not be represented cleanly without either overloading text fields or adding repeating columns. Admin screens were also designed around monitoring rather than deep evidence inspection.

## What changed

### JOVIS

- Added Call Method gate: large primary `VISIT`, secondary `BY WA`.
- VISIT retains mandatory GPS; BY WA is pure EC/REMOTE with no GPS/dwell time.
- Added dynamic reason-specific detail questions for every observed Non-EC category.
- BMA requires at least one remaining product/SKU and a salesman oversized-order statement.
- Added optional/recommended photo evidence with local WebP compression.
- Added Recovery Pending and append-only post-visit recovery attempts.

### Admin

- Removed Visit workflow/navigation from Admin.
- Added Summary / Detail / Map / Analisis / Pengaturan navigation.
- Added per-data-column filters and clickable GPS coordinates.
- Added rich call detail including reason detail, stock, recovery, and photos.
- Added Join Visit map with sequence grouped by Visit ID.
- Added five rule-based research questions with configurable minimum sample.

### Data/export

- Added normalized child tables for reason detail, stock items, recovery attempts, photo metadata, and app settings.
- Added private Supabase Storage bucket `call-evidence`.
- Added export sheets 11–14.
- Visit EC/SC, Pure WA EC, and Recovered EC are explicitly separated.

## Exact revised locations

| File | Revised area |
|---|---|
| `src/config/app-config.js` | v0.4.0 version, DB v2, feature flags, exact/observed taxonomy defaults |
| `src/ui/app.js` | Call method gate, rich Non-EC forms, recovery, Admin Summary/Detail/Map/Analysis/Settings |
| `src/domain/reason-detail-config.js` | Dynamic question schemas/options for all observed reasons |
| `src/domain/admin-intelligence.js` | Visit/WA/recovery KPIs and Q1–Q5 rule engine |
| `src/domain/analysis-engine.js` | Physical Visit-only EC/SC denominator and WA separation |
| `src/data/local-db.js` | IndexedDB v2 child stores |
| `src/data/cloud-repository.js` | New Supabase child tables, settings, Storage operations |
| `src/data/sync-engine.js` | Entity dependency ordering and child queue support |
| `src/data/media-service.js` | Image compression, local Blob staging, private upload |
| `src/export/exporter.js` | Rich evidence sheets and separated Visit/WA/recovery summary |
| `index.html` | Leaflet runtime assets |
| `assets/styles.css` | v0.4.0 mobile/admin/map/detail styles |
| `sw.js` | cache version + new module cache entries |
| `supabase/migrations/202608120008_rich_non_ec_admin_intelligence.sql` | additive database/RLS/Storage migration |
| `supabase/verification/202608120008_verify.sql` | post-migration integrity checks |

## Previous vs new

| Area | v0.3.10 | v0.4.0 | Impact |
|---|---|---|---|
| Call method | Physical Visit implicit | VISIT vs pure WHATSAPP explicit | WA EC no longer contaminates physical EC/SC |
| Non-EC evidence | Generic evidence/follow-up | Reason-specific structured detail | Richer research dataset |
| BMA | Actual reason only | SKU rows + buying timing + salesman claim | Supports later DBase validation |
| Recovery | Planned follow-up only | Actual append-only recovery attempts | Measures recovery outcome/channel |
| Photos | None | Private compressed evidence | Adds visual evidence |
| Admin | Monitoring + visit capabilities | Dedicated intelligence workspace, no Visit | Lower accidental input risk and deeper analysis |
| Detail | Basic rows | Per-column filter + GPS link + rich drawer | Faster root-cause inspection |
| Map | None | GPS sequence by Visit | Spatial/sequence review |
| Analysis | Generic | Q1–Q5 rule-based research | Directly aligned to current join-visit questions |
| Export | Through sheet 10 | Adds sheets 11–14 | Full offline analysis dataset |
| IndexedDB | v1 | v2 same DB name | Existing browser data preserved |

## Business logic impact

This release changes metric interpretation by introducing explicit channel separation. Physical Visit EC/SC must only use `call_method=VISIT`. Pure WhatsApp EC and Recovered EC are additive order outcomes but do not rewrite initial physical Visit results.

## Architecture impact

The Call remains the parent event. Repeating evidence is normalized into child tables. Offline synchronization now has a dependency order so parent Visit/Call writes are processed before child evidence. Cloud refresh protects pending child records from stale inbound overwrite.

## Migration safety

Migration 008 is additive. Historical Calls are treated as VISIT through a new `NOT NULL DEFAULT 'VISIT'` column. There is deliberately **no row-level UPDATE backfill of `call_method`**, avoiding the tombstone-trigger failure pattern seen in the failed Migration 006.

## QA performed

See `QA_REPORT.md`. Automated/static/executable checks completed with 123 PASS / 0 FAIL. Production Supabase/GPS/camera/browser E2E items remain BLOCKED until deployed testing.

## Known risks

- Map runtime depends on external Leaflet/OSM network resources.
- Production Storage/RLS/photo workflow needs target-environment verification.
- Rich question schemas are config-module driven; Admin can view them but does not yet edit schema definitions from UI.
- Bombing is not inferred from salesman claim.

## Rollback

Frontend can roll back to the bundled v0.3.10 source. Migration 008 schema is additive and does not need to be dropped for frontend rollback.
