# QA Report — Field Visit Intelligence v0.3.4

| Test ID | Scenario | Expected Result | Actual Result | Status | Evidence / Notes |
|---|---|---|---|---|---|
| QA-340 | JavaScript syntax | All application JS parses | `node --check` passed for all source JS + service worker | PASS | Executed locally |
| QA-341 | Visit cloud whitelist | Server audit/default fields excluded | `created_at`, `updated_at`, `last_edited_by` absent from Visit whitelist | PASS | Automated source assertion |
| QA-342 | Call cloud whitelist | Server audit/default fields excluded | Same fields absent from Call whitelist | PASS | Automated source assertion |
| QA-343 | Sanitizer enforced | UPSERT uses sanitized payload | Both Visit and Call UPSERT paths call sanitizer | PASS | Automated source assertion |
| QA-344 | Queue deduplication | Same record does not accumulate redundant UPSERT queue rows | Coalescing logic found by entity/operation/record ID | PASS | Automated source assertion |
| QA-345 | Failed sync retry | Queue exposes per-row and bulk retry APIs | `retryItem()` and `retryAllErrors()` implemented | PASS | Automated source assertion |
| QA-346 | Error observability | Original backend error is visible in app | Diagnostics table includes Last Error + attempt count | PASS | Static UI assertion |
| QA-347 | Diagnostic panel | Auth/local/cloud/RLS diagnostics callable | Diagnostic panel and `diagnosticSnapshot()` wired | PASS | Static UI assertion |
| QA-348 | Stale release mitigation | Updated assets prefer network | Service worker uses network-first with cache fallback | PASS | Automated source assertion |
| QA-349 | Secret exposure | No Supabase secret value is committed | No `sb_secret_...` value detected | PASS | Automated repository scan |
| QA-350 | Existing IndexedDB compatibility | Local DB is not renamed/reset | DB remains `fvi_v030`, DB_VERSION 1 | PASS | Config inspection |
| QA-351 | Supabase schema | Patch requires no DB migration | Schema version remains `202608110003` | PASS | version.json / migration review |
| QA-352 | Real cloud recovery of the user's existing failed queue | Existing error items clear after retry | Not executable in this environment because authenticated browser session is unavailable | BLOCKED | Must verify after GitHub Pages redeploy |
| QA-353 | Admin/JOVIS RLS end-to-end | JOVIS sees own rows only; Admin sees all | Not executable without authenticated real-user sessions | BLOCKED | In-app diagnostic added to assist real-device QA |

## Automated QA Result
`tests/unit/test_v034.py`: **19 PASS / 0 FAIL**.

## Regression Result
No intended change to business calculation or Supabase schema. Sync, diagnostics, caching, and observability are the affected workflows.

## Known limitations
- Browser/cloud E2E requires the deployed GitHub Pages application and real Admin/JOVIS credentials.
- Diagnostic RLS check verifies only rows visible to the current session; it does not bypass RLS to inspect forbidden rows.
- Do not clear browser data while pending/error queue rows remain.
