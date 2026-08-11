# QA REPORT — v0.2.0

**Test date:** 2026-08-11  
**Previous stable baseline:** v0.1.0

| Test ID | Scenario | Expected | Actual | Status | Evidence |
|---|---|---|---|---|---|
| QA-001 | JavaScript static syntax | No syntax error | `node --check` exit 0 | PASS | Extracted inline JS |
| QA-002 | Create visit | Active visit + start timestamp | Created with `startedAt` | PASS | Node module test |
| QA-003 | EC omzet | Omzet aggregates correctly | Rp500k test aggregated | PASS | Node module test |
| QA-004 | Exact reason match | Actual PIC + SFA PIC = Match | MATCH | PASS | Node module test |
| QA-005 | Reason mismatch | Actual Financial + SFA PIC = Mismatch | MISMATCH | PASS | Node module test |
| QA-006 | Contributing factor | Primary Financial + factor Stock + SFA Stock = Partial | PARTIAL | PASS | Node module test |
| QA-007 | Custom Other reason | Raw label remains available in analysis | `Produk slow moving` retained/count=1 | PASS | Node module test |
| QA-008 | Edit call | No duplicate; original call time preserved; edit timestamp set | 5 calls remain, timestamp preserved | PASS | Node module test |
| QA-009 | Multi-observer Visit JSON merge | Imported separate Visit ID added | Observer 2 visit merged | PASS | Node module test |
| QA-010 | Combined analysis | All imported visits aggregate | 6 calls / 2 EC in fixture | PASS | Node module test |
| QA-011 | v0.1 migration | Secondary/follow-up/constraint migrate | Migrated to contributing factor, stable follow code, timing reason | PASS | Node module test |
| QA-012 | Draft serialization | Unfinished call survives state serialization | Draft outlet recovered from v0.2 storage | PASS | Regression test |
| QA-013 | 100-call scale | No hard call limit; metrics reconcile | 100 SC = 66 EC + 34 Non-EC | PASS | Regression test |
| QA-014 | Merge same Visit/Call ID | No duplicate; newer updatedAt wins | 100 calls remain, newer value retained | PASS | Regression test |
| QA-015 | SpreadsheetML generation | Excel-compatible worksheet generated | Worksheet/Row XML generated | PASS | Node module test |
| QA-016 | HTML structure | Required screens/nav/logo/version/lang toggle present | 5 screens, 4 nav, embedded logo, v0.2.0 | PASS | BeautifulSoup static check |
| QA-017 | External runtime dependency | No external JS script required | Inline JS only | PASS | HTML static check |
| QA-018 | Mobile viewport | Responsive viewport declared | `width=device-width` present | PASS | HTML static check |
| QA-019 | Headless Chromium visual/E2E | Page renders in Chromium container | Chromium hangs due DBus/zygote environment | BLOCKED | Two timed Chromium attempts; no screenshot produced |
| QA-020 | Real Android/iPhone hands-on | User can complete real field workflow | Not executable in build container | BLOCKED | Required after GitHub Pages deployment |

## Regression Results
- v0.1 core Match/Mismatch/Partial logic preserved: PASS.
- 100-call processing remains functional: PASS.
- Editing still replaces rather than duplicates a call: PASS.
- v0.1 data migration covered by automated fixture: PASS.

## Known QA Gap
Visual/responsive behavior still requires real-device verification. Do not treat QA-019/020 as PASS.
