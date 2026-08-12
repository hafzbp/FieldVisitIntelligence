# Patch Notes — Field Visit Intelligence v0.4.1

**Previous version:** v0.4.0  
**New version:** v0.4.1  
**Date:** 2026-08-12  
**Schema:** unchanged — `202608120008`

## Patch objective
Restore application boot on GitHub Pages after v0.4.0 rendered a blank white screen.

## Root cause
`src/ui/app.js` contained two fatal ES-module syntax defects introduced during the v0.4.0 Admin Intelligence expansion:

1. `visitCalls()` was missing one closing parenthesis in the `.sort(...localeCompare(...))` expression.
2. `renderSelectedCall()` was missing the closing template-literal backtick in the conditional Recovery Attempts block.

Because `app.js` is loaded as `type="module"`, either syntax defect prevents the entire module graph from evaluating. The browser therefore never reaches `boot()` and `#root` remains empty, producing a plain white page.

The v0.4.0 QA process used `node --check` as its JavaScript syntax guard. In this environment that command returned exit code 0 for `app.js` despite the ES-module parse defect. The QA guard was therefore insufficient and the previous syntax PASS claim did not prove browser-module loadability.

## What changed
- Corrected the missing parenthesis in `visitCalls()`.
- Corrected the malformed template-literal conditional in `renderSelectedCall()`.
- Bumped frontend version and service-worker cache to `0.4.1`.
- Added `?v=0.4.1` cache-busting to the primary CSS and `app.js` entrypoint.
- Added a real ES-module load smoke test that imports the application module graph with browser globals stubbed and `boot()` disabled only inside the temporary QA copy.
- Updated QA documentation to explicitly disclose the v0.4.0 validation gap.

## Exact revised locations

### `src/ui/app.js`
- `visitCalls()` near the application state helpers.
- `renderSelectedCall()` in Admin Detail call drawer rendering.

### `src/config/app-config.js`
- `APP_VERSION`: `0.4.0` → `0.4.1`.

### `index.html`
- Versioned CSS and application-module URLs.

### `sw.js`
- Cache namespace: `fvi-v0.4.1`.
- Versioned primary asset URLs.

### `tests/unit/test_module_load_v041.mjs`
- New executable module-load regression guard.

### Documentation
- `README.md`
- `docs/CHANGELOG.md`
- `docs/QA_REPORT.md`
- `docs/PATCH_NOTES_v0.4.1.md`

## Business-logic impact
No intended business-logic change. VISIT, BY WA, rich Non-EC evidence, recovery, exact SFA, BMA evidence, Admin Summary/Detail/Map/Analysis, export logic, and existing historical data rules remain unchanged from v0.4.0.

## IT / architecture impact
No database migration and no schema change. The patch only restores frontend module loadability and strengthens release QA.

## QA performed
- v0.4.0 static/business regression: 89/89 PASS.
- domain executable assertions: 17 PASS.
- export integration assertions: 13 PASS.
- exact-SFA retained regression: PASS.
- new full local ES-module load smoke test: PASS.
- static HTTP serving for `index.html` and versioned `app.js`: PASS.
- `sw.js` Node syntax check: PASS.

Production GitHub Pages authenticated/mobile smoke remains required after deployment.

## Regression risks
Low. The source corrections are narrowly scoped, but service-worker/cache behavior must be confirmed on the deployed GitHub Pages origin.

## Known limitations
- This environment could not complete a real authenticated browser E2E against the user's deployed Supabase/GitHub Pages session.
- Real GPS, camera, Storage upload, and Admin map remain device/deployment smoke tests.

## Rollback
Rollback target: v0.3.10 if v0.4.x functionality must be abandoned. No database rollback is required for this frontend hotfix because v0.4.1 adds no schema changes. Migration 008 is additive and may remain in place.
