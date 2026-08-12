# QA Report — Field Visit Intelligence v0.4.1

**Build date:** 2026-08-12  
**Baseline:** v0.4.0  
**Target:** v0.4.1  
**Schema:** `202608120008` — unchanged

## Defect reproduced
The v0.4.0 application entry module failed to parse before `boot()` with fatal ES-module syntax errors. This explains the blank white GitHub Pages screen: `index.html` loaded, but JavaScript never populated `#root`.

## Root-cause QA finding
The previous v0.4.0 syntax test used `node --check`. In this runtime, `node --check src/ui/app.js` returned exit code 0 even though actual ES-module loading raised a SyntaxError. Therefore the v0.4.0 syntax PASS was not a sufficient browser-module validation.

v0.4.1 adds an executable module-load smoke test instead of relying on `node --check` for the application entry module.

## Executed QA

| Test ID | Scenario | Expected | Actual | Status |
|---|---|---|---|---|
| QA-041-001 | `visitCalls()` syntax | Application module parses | Corrected closing parenthesis | PASS |
| QA-041-002 | Admin call-detail template syntax | Recovery section parses | Corrected closing template literal | PASS |
| QA-041-003 | Full `app.js` local ES-module load | Module graph links and top-level initialization executes | `test_module_load_v041.mjs` completed | PASS |
| QA-041-004 | Existing v0.4 static/business assertions | 89 checks remain valid | 89 PASS / 0 FAIL | PASS |
| QA-041-005 | Domain executable assertions | No business-rule regression | 17 PASS | PASS |
| QA-041-006 | Detailed export integration | v0.4 export remains valid | 13 PASS | PASS |
| QA-041-007 | Exact SFA regression | Legacy/exact logic retained | PASS | PASS |
| QA-041-008 | Static HTTP serving | `index.html` and versioned `app.js` return HTTP 200 | Both fetched successfully | PASS |
| QA-041-009 | Service worker syntax | SW parses | Node syntax check passed | PASS |
| QA-041-010 | Schema change | No new migration required | Schema remains 008 | PASS |

## Regression result
No intended business-output change. Existing v0.4.0 feature tests for VISIT/BY WA, GPS, Kode Toko, exact SFA, rich reason evidence, BMA, recovery, photos, Admin intelligence, offline schema, sync ordering, RLS migration representation, and export all remain PASS.

## BLOCKED / deployment smoke tests

| Scenario | Status | Reason |
|---|---|---|
| Actual GitHub Pages render after v0.4.1 deploy | BLOCKED | Requires user deployment to public repo |
| Authenticated Admin/JOVIS cloud workflow | BLOCKED | Requires real user session |
| Mobile GPS + camera | BLOCKED | Requires physical supported device |
| Private Supabase photo upload/read | BLOCKED | Requires authenticated target environment |
| Cross-device sync | BLOCKED | Requires multiple real sessions/devices |

## Release assessment
v0.4.1 fixes the reproduced frontend boot blocker and passes the executable module-load regression guard. Production status should be confirmed by opening the deployed URL after GitHub Pages finishes publishing and performing a hard refresh once.
