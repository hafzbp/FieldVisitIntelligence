# Patch Notes — Field Visit Intelligence v0.3.9

## Previous version
v0.3.8

## New version
v0.3.9

## Patch objective
Correct the SFA/E-Work Non-EC reason capture so the app stores the exact options available in the live SFA screen while preserving and recovering field data already collected with the interpreted legacy taxonomy.

## Problem statement
v0.3.8 used one shared taxonomy for both:
- observed/actual Non-EC reason; and
- reason selected by the salesman in SFA/E-Work.

The SFA side therefore captured observer interpretation instead of exact SFA wording. This contaminated direct reason-accuracy and mismatch interpretation.

## Root cause
`reason_taxonomy.reason_type='both'` was used for the observational categories, and `reasonChips(...,'sfa')` therefore rendered the same categories as the actual-reason screen. `classifyReason()` then compared the two codes directly.

## Resolution
1. Split observational and exact-SFA taxonomies.
2. Add the exact seven SFA/E-Work options supplied by the Product Owner.
3. Preserve legacy `sfa_reason_code` rather than overwrite it.
4. Add exact-SFA provenance fields to existing calls.
5. Auto-recover only conservative one-to-one legacy mappings.
6. Add Admin manual recovery for ambiguous historical calls.
7. Derive v0.3.9 alignment from exact SFA vs actual reason instead of trusting the historical match flag; no automatic causal mapping is assumed for `Ambil dari supplier lain`.
8. Export exact reason, legacy reason, recovery status and v0.3.9 alignment separately.


## Previous vs new version

| Area | v0.3.8 | v0.3.9 | Reason | Impact |
|---|---|---|---|---|
| SFA input | Shared interpreted taxonomy | Exact seven E-Work options | Remove observer translation | New Non-EC captures are exact |
| Actual reason | Shared with SFA | Independent observed taxonomy | Preserve root-cause research | No intended loss of existing actual-reason logic |
| Historical SFA | Single legacy code | Legacy code preserved + exact recovery fields | Protect provenance | Existing Call IDs/data remain usable |
| Mismatch logic | Code equality on shared taxonomy | Derived from exact SFA + approved causal mapping | Avoid false precision | Unresolved/non-causal/taxonomy-gap rows excluded from forced mismatch |
| Admin | No SFA recovery workflow | Legacy Recovery queue | Recover ambiguous existing data | Manual confirmation on same Call ID |
| Export | One SFA reason + legacy match status | Exact + legacy + recovery + v0.3.9 alignment | Make downstream analysis auditable | Adds `10_SFA_RECOVERY` |
| Database | Schema 202608110005 | Additive migration 202608120006 | Persist provenance | No destructive migration |
| Existing GPS/delete/sync | Active | Retained | Regression safety | No intended business-output change |

## Exact revised locations

### `src/config/app-config.js`
- `APP_VERSION`
- `DEFAULT_REASONS`
- `EXACT_SFA_CODES`
- `SFA_TO_OBSERVED_REASON`
- `SAFE_LEGACY_SFA_MAP`

### `src/domain/reason-engine.js`
- `exactSfaCode()`
- `sfaLabel()`
- `legacySfaLabel()`
- `safeLegacyExactCode()`
- `normalizedRecoveryStatus()`
- `normalizedCaptureType()`
- `classifyReason()`
- `analysisReasonStatus()`
- `dbCompatibleMatchStatus()`
- `recoverySuggestion()`

### `src/domain/analysis-engine.js`
- reason quality / recovery coverage
- exact-SFA mismatch matrix
- comparable-only mismatch calculation
- `NON_CAUSAL`, `TAXONOMY_GAP`, `UNRESOLVED` findings

### `src/ui/app.js`
- exact SFA call-entry screen
- legacy-call editing behavior
- SFA data-quality KPIs
- Admin `SFA Legacy Recovery` queue
- exact/legacy/recovery/alignment fields in analysis detail

### `src/data/cloud-repository.js`
Added client-owned fields:
- `sfa_reason_exact_code`
- `sfa_capture_type`
- `sfa_recovery_status`

### `src/export/exporter.js`
- exact + legacy SFA provenance columns
- updated reason-accuracy logic
- new `10_SFA_RECOVERY` sheet

### `supabase/migrations/202608120006_exact_sfa_legacy_recovery.sql`
- taxonomy split
- exact SFA options
- additive call columns
- conservative backfill
- cutover provenance trigger
- indexes

## Business-logic impact
Reason accuracy becomes more defensible because the SFA input is no longer an observer-generated category. Ambiguous historical rows are excluded from mismatch until exact SFA choice is confirmed. `Nanti ditelpon saja` and `Lainnya` are not automatically treated as causal mismatch categories.

## Data migration impact
Additive only. No Call ID or Visit ID is regenerated. No GPS/timestamp/actual reason/evidence/omzet is deleted. Historical `sfa_reason_code` remains untouched.

## Backfill policy
Automatically recovered only:
- `stock` → `sfa_stock_available`
- `financial` → `sfa_no_cash`
- `closed` → `sfa_store_closed`

All other legacy categories remain unresolved until confirmed.

## QA performed
See `QA_REPORT.md`.

## Known limitations
- Real Supabase migration execution cannot be performed from this build environment.
- Real Admin/JOVIS authenticated workflow and mobile GPS must be smoke-tested after deployment.
- Manual recovery is only as reliable as the observer's ability to confirm the historical exact SFA choice.

## Rollback
See `ROLLBACK.md`. Frontend rollback package for v0.3.8 is included under `rollback/v0.3.8/`.
