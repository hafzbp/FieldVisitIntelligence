# Patch Notes — Field Visit Intelligence v0.3.10

## Previous version
v0.3.9

## New version
v0.3.10

## Patch objective
Make the exact SFA/E-Work legacy recovery migration compatible with the v0.3.8 soft-delete/tombstone architecture without weakening delete protection or changing field data.

## Problem statement
Running v0.3.9 Migration 006 failed with PostgreSQL `42501`:

`This record was deleted by Admin and is no longer editable.`

The failure was raised by `guard_soft_delete_tombstone()` when the backfill reached an Admin-deleted historical call.

## Root cause
Migration 006 used broad statements such as `UPDATE public.calls ... WHERE result='NON_EC'` and did not exclude soft-deleted calls or calls belonging to deleted Visits. The v0.3.8 guard correctly treats tombstones as immutable for non-Admin/JWT-less update contexts, including the SQL migration execution path encountered in the real project.

The architecture therefore had a mismatch between:
- **v0.3.8 invariant:** tombstones must not be edited; and
- **v0.3.9 migration behavior:** all historical Non-EC rows were eligible for recovery backfill.

## Resolution
1. Preserve the failed Migration 006 source under `docs/failed_migrations/` for traceability.
2. Remove Migration 006 from the active migration path so a fresh migration sequence cannot hit the known defect.
3. Add standalone/idempotent Migration 007 containing the full exact-SFA schema/taxonomy setup.
4. Add a live-row predicate to every historical `calls` backfill:
   - call is not deleted; and
   - parent Visit exists and is not deleted.
5. Keep `trg_guard_calls_soft_delete` and `trg_guard_calls_visit_integrity` enabled throughout the migration.
6. Make the runtime provenance normalizer return deleted rows unchanged.
7. Add read-only post-migration verification SQL.
8. Bump frontend/version/service-worker cache to v0.3.10; no intended UI/business-logic change from v0.3.9.

## Previous vs new version

| Area | v0.3.9 | v0.3.10 | Reason | Impact |
|---|---|---|---|---|
| Active SFA migration | 006 updates all historical Non-EC calls | 007 updates live calls under live Visits only | Respect tombstone invariant | Deleted test/history records are skipped |
| Tombstone guards | Existing | Remain enabled | Do not weaken v0.3.8 protection | Cross-device delete protection retained |
| Exact SFA options | 7 exact options | Same 7 options | No business-rule change | No retraining for JOVIS |
| Legacy recovery | Stock/Financial/Closed auto-recovery | Same | Preserve conservative provenance | Expected live recovery counts unchanged |
| Existing data | Preserved | Preserved | Additive patch | No ID/GPS/evidence reset |
| Runtime normalizer | Could process deleted row before guard | Explicitly returns deleted row unchanged | Avoid incidental provenance mutation | Cleaner tombstone behavior |
| Verification | Deployment checklist only | Read-only SQL verification added | Faster diagnosis | User can validate counts/integrity |
| Frontend | v0.3.9 | v0.3.10 | Cache/version traceability | No intended business-output change |

## Exact revised locations

### `supabase/migrations/202608120007_exact_sfa_legacy_recovery_tombstone_safe.sql`
- Full idempotent exact-SFA setup.
- Three historical `public.calls` backfills now include live-call/live-parent predicates.
- `normalize_sfa_provenance_v039()` skips deleted rows.
- Tombstone and call-parent integrity triggers are intentionally not disabled.

### `docs/failed_migrations/202608120006_exact_sfa_legacy_recovery_FAILED.sql`
- Archived failed v0.3.9 migration for audit/reference only.

### `supabase/verification/202608120007_verify.sql`
- Live Non-EC recovery counts.
- Deleted-call provenance check.
- Active-call-under-deleted-visit integrity check.

### `src/config/app-config.js`
- `APP_VERSION` → `0.3.10`.

### `sw.js`
- cache key → `fvi-v0.3.10`.

### `version.json`
- version → `0.3.10`.
- schema version → `202608120007`.

### Documentation/tests
- README, deployment, QA, changelog, rollback, known limitations and readiness checklist updated.
- Added `tests/unit/test_v0310.py`.

## Business-logic impact
No intended change to the v0.3.9 exact-SFA business logic. New calls still capture the seven exact E-Work reasons. Legacy recovery remains conservative. The patch changes **which historical database rows are eligible for migration**: deleted records are excluded because they are outside the active analytical dataset and are immutable by design.

## IT/architecture impact
The migration now aligns with the existing soft-delete invariant instead of bypassing it. Migration 007 is safe after a failed 006 and idempotent if 006 had already succeeded in another environment.

## Data migration impact
Additive only. No Call ID, Visit ID, GPS, timestamp, observed reason, evidence, omzet or follow-up data is regenerated/deleted.

## QA performed
See `QA_REPORT.md` for executed results and blocked real-environment tests.

## Known limitations
Real Supabase execution cannot be performed from this container. Migration 007 must be run in the real project and verified with the included read-only query.

## Rollback
See `ROLLBACK.md`. v0.3.9 source is included under `rollback/v0.3.9/`.
