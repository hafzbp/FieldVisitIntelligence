# QA Report — Field Visit Intelligence v0.3.0

Date: 2026-08-11

| Test ID | Scenario | Expected | Actual | Status | Evidence / Notes |
|---|---|---|---|---|---|
| QA-001 | JavaScript syntax | All JS modules parse | All modules passed `node --check` | PASS | `src/**/*.js` |
| QA-002 | Analysis SC/EC/Non-EC | Counts reconcile | 4 SC / 1 EC / 3 Non-EC matched fixture | PASS | Node analytical fixture |
| QA-003 | EC/SC calculation | 1/4 = 25% | 25% | PASS | Node analytical fixture |
| QA-004 | Omzet calculation | EC omzet preserved | IDR 100,000 fixture preserved | PASS | Node analytical fixture |
| QA-005 | Reason Match | Exact reason maps MATCH | MATCH counted correctly | PASS | Node analytical fixture |
| QA-006 | Reason Partial | SFA reason as contributing factor maps PARTIAL | PARTIAL counted correctly | PASS | Node analytical fixture |
| QA-007 | Reason Mismatch | Different primary/SFA reason maps MISMATCH | MISMATCH counted correctly | PASS | Node analytical fixture |
| QA-008 | Custom Other discovery | Raw custom reason remains separate | `Produk slow moving` preserved | PASS | Node analytical fixture |
| QA-009 | Detailed workbook sheets | Required 9 sheets generated | All 9 sheet names present | PASS | Export builder fixture |
| QA-010 | Unmapped export evidence | Raw reason + evidence preserved | `Display penuh` + `Rak penuh` present | PASS | Export builder fixture |
| QA-011 | RLS artifact coverage | Profiles/visits/calls/taxonomy/mapping/history RLS declared | All target tables have RLS statements | PASS | Static SQL artifact validation |
| QA-012 | One active visit server rule | Partial unique index exists | `uq_one_active_visit_per_jovis` present | PASS | Static SQL artifact validation |
| QA-013 | EC omzet server rule | Database constraint exists | `ec_requires_omzet` present | PASS | Static SQL artifact validation |
| QA-014 | Audit trail | Call audit trigger exists | `trg_calls_audit` present | PASS | Static SQL artifact validation |
| QA-015 | Secret scan | No actual secret/service-role key in source | No credential value found; only warnings/placeholders | PASS | Repository grep |
| QA-016 | Static HTTP serving | index + app module are servable | HTTP 200 via local Python server | PASS | `index.html`, `src/ui/app.js` |
| QA-017 | Chromium mobile visual startup | Setup page renders at 390×844 | Environment blocks local/file navigation (`ERR_BLOCKED_BY_ADMINISTRATOR`) | BLOCKED | Runtime policy, not app assertion |
| QA-018 | Real Supabase Auth | Admin/JOVIS login works | No project URL/key supplied | BLOCKED | Requires user's Supabase project |
| QA-019 | RLS isolation | JOVIS A cannot read JOVIS B | No live Supabase project supplied | BLOCKED | Must be tested with 2 JOVIS + 1 Admin |
| QA-020 | Offline restart + sync | Offline calls survive restart and sync without duplicates | Browser E2E + live backend unavailable in environment | BLOCKED | Must be field-tested after connection |
| QA-021 | v0.2 cloud migration | v0.2 records copy to authenticated Supabase user | No live backend supplied | BLOCKED | Migration source code implemented; live reconciliation required |

## Regression assessment
Core v0.2 business fields are preserved: JKS/Off Route, EC/Non-EC, omzet, observed reason, custom reason, contributing factor, evidence, SFA reason, match status, follow-up timing, editing, bilingual labels, and detailed export.

The architecture is a major change, so v0.3 must not be declared production-ready until QA-018 through QA-021 are executed against the user's actual Supabase project and at least two mobile devices.

## Known limitations
- Supabase is not configured in the delivered package; placeholders must be replaced.
- First Admin is bootstrapped manually in Supabase Dashboard.
- No in-app account creation yet.
- No actual recovery D+1/D+2 outcome tracking yet.
- No GPT/OpenAI API integration; deeper analysis is intentionally performed from detailed export.
- Browser Supabase client is loaded from a pinned CDN version; first online load is required.
