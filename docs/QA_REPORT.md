# QA Report — Field Visit Intelligence v0.4.0

**Build date:** 2026-08-12  
**Baseline:** v0.3.10  
**Target:** v0.4.0  
**Automated evidence:** `tests/evidence/v0.4.0_final_automated_qa.txt`

## Summary

| Layer | Result |
|---|---:|
| Static HTTP serving | 2 PASS / 0 FAIL |
| JavaScript syntax | 1 PASS / 0 FAIL |
| v0.4.0 static/unit assertions | 89 PASS / 0 FAIL |
| Domain executable assertions | 17 PASS / 0 FAIL |
| Export integration assertions | 13 PASS / 0 FAIL |
| Retained exact-SFA regression group | 1 PASS / 0 FAIL |
| **Executed total** | **123 PASS / 0 FAIL** |

The 123 count represents explicit automated/static/executable checks and test groups recorded in the evidence file. It does **not** include the production tests listed as BLOCKED below.

## Executed QA

| Test ID | Scenario | Expected | Actual | Status | Evidence / notes |
|---|---|---|---|---|---|
| QA-040-001 | Static `index.html` served | HTTP 200 | HTTP 200 | PASS | curl against local HTTP server |
| QA-040-002 | Static `src/ui/app.js` served | HTTP 200 | HTTP 200 | PASS | curl against local HTTP server |
| QA-040-003 | JavaScript syntax | All JS parses | All source modules + SW parsed | PASS | Node `--check` |
| QA-040-004 | Exact SFA options | Seven exact E-Work labels retained | 7/7 asserted | PASS | `test_v040.py` |
| QA-040-005 | Call method priority | VISIT primary; WA secondary | Source assertions passed | PASS | `test_v040.py` |
| QA-040-006 | Pure WA metric isolation | WA excluded from physical SC/EC | Executable fixture: Visit SC 2, Visit EC 1, WA EC 1 | PASS | `test_v040.mjs` |
| QA-040-007 | Visit GPS guard retained | Physical new call cannot save without check-in | Validation path asserted | PASS | static assertion |
| QA-040-008 | Rich reason validation | Reason-specific mandatory fields present | PIC/closed/financial/refusal/external/price/product/unclear/BMA checks asserted | PASS | `test_v040.py` |
| QA-040-009 | BMA evidence | SKU + salesman claim required | Both validation guards asserted | PASS | `test_v040.py` |
| QA-040-010 | Photo compression cap | Compression targets under Storage max | iterative ~950KB safety logic asserted | PASS | `media-service.js` static check |
| QA-040-011 | Recovery data model | Original Non-EC preserved; recovery separate | Executable recovery fixture produced separate recovered KPI | PASS | `test_v040.mjs` |
| QA-040-012 | Admin navigation | No Admin Visit; 5 intelligence tabs | Source assertions passed | PASS | `test_v040.py` |
| QA-040-013 | Admin Detail filters | Data columns filterable | Omzet/evidence/photo + existing filters asserted | PASS | `test_v040.py` |
| QA-040-014 | GPS drill-through | Coordinates produce clickable map link | Google Maps link path asserted | PASS | `test_v040.py` |
| QA-040-015 | Join Visit map structure | GPS map + visit-grouped sequence | Map grouping/sequence source asserted | PASS | `test_v040.py` |
| QA-040-016 | Rule-based analysis | Q1–Q5 exist | 5 questions returned executable | PASS | `test_v040.mjs` |
| QA-040-017 | Offline schema upgrade | New stores created, DB name preserved | DB name `fvi_v030`, DB version 2, stores asserted | PASS | `test_v040.py` |
| QA-040-018 | Queue parent dependency | Visit/Call precede child writes | priority map asserted | PASS | `test_v040.py` |
| QA-040-019 | Pending child reconciliation | cloud refresh avoids pending local child overwrite | pending child guards asserted | PASS | `test_v040.py` |
| QA-040-020 | Tombstone-safe call_method migration | no row UPDATE backfill of calls | migration uses DDL default and no `UPDATE calls SET call_method` | PASS | `test_v040.py` |
| QA-040-021 | RLS / private Storage DDL | required tables/RLS/private bucket represented | SQL assertions passed | PASS | `test_v040.py` |
| QA-040-022 | Detailed export | new sheets + separated metrics | XML workbook fixture contains sheets 11–14 and excludes deleted amount | PASS | `test_export_v040.mjs` |
| QA-040-023 | Exact-SFA legacy logic regression | v0.3.10 exact/recovery logic remains valid | retained executable test passed | PASS | `tests/regression/test_exact_sfa_legacy.mjs` |

## Regression scope covered

Automated regression guards cover the most business-critical previous behavior:

- exact 7-option SFA taxonomy and legacy recovery logic;
- Kode Toko `C` + digits;
- physical GPS check-in/check-out and dwell fields;
- Visit-only EC/SC computation;
- soft-delete/tombstone-compatible Migration 008 design;
- IndexedDB same-name upgrade and offline queue;
- detailed export exclusion of deleted calls.

## BLOCKED / not falsely marked PASS

| Test ID | Scenario | Status | Reason |
|---|---|---|---|
| QA-040-B01 | Run Migration 008 on target Supabase | BLOCKED | Build environment does not have authenticated database execution for the user's project |
| QA-040-B02 | Run Verification 008 on target Supabase | BLOCKED | Depends on B01 |
| QA-040-B03 | Authenticated JOVIS end-to-end cloud save | BLOCKED | No user password/session supplied; passwords are intentionally not requested |
| QA-040-B04 | Real mobile GPS permission + checkout GPS | BLOCKED | Requires real supported device/browser permission flow |
| QA-040-B05 | Real mobile camera capture + Storage upload | BLOCKED | Requires deployed HTTPS app, device camera, authenticated Storage/RLS |
| QA-040-B06 | Admin signed-photo gallery in production | BLOCKED | Requires B01/B03/B05 |
| QA-040-B07 | Live Leaflet/OSM map rendering in authenticated Admin | BLOCKED | Requires authenticated production dataset/session |
| QA-040-B08 | Full headless local browser E2E | BLOCKED | Chromium in execution environment returned `ERR_BLOCKED_BY_ADMINISTRATOR` for localhost; not marked PASS |
| QA-040-B09 | Cross-device tombstone sync after v0.4.0 deployment | BLOCKED | Requires two real authenticated browser/device sessions |
| QA-040-B10 | iOS/Android service-worker upgrade from deployed v0.3.10 | BLOCKED | Requires actual deployed production URL/device cache |

## Acceptance condition before field use

v0.4.0 is a **release candidate**, not declared production-validated until Migration 008, verification, and the `READY_TO_USE_CHECKLIST.md` smoke tests are completed on the target Supabase/GitHub Pages deployment.
