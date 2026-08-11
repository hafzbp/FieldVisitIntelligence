# PATCH NOTES — v0.2.0

## Previous Version
v0.1.0

## New Version
v0.2.0

## Patch Objective
Convert the single-device field prototype into a safer local-first field trial tool that can be used by parallel observers and better captures real Non-EC reasons.

## Root Causes Identified from Hands-on Use
1. v0.1 data was local to one browser with no practical parallel-observer consolidation flow.
2. Saved data persisted, but unfinished draft recovery was not explicit.
3. Visit/call timestamps were stored incompletely or not visible/exported.
4. EC did not capture omzet.
5. Edit capability existed but was not discoverable enough.
6. `Secondary Reason` was cognitively ambiguous.
7. Selecting `Other` lost the actual new reason because evidence text was not a structured real-reason label.
8. UI was English-only for field users.
9. Follow-up labels `Can Revisit Earlier?` and `Constraint / Signal` were not self-explanatory.

## What Changed
- Added local-first multi-observer Visit JSON export and Import & Merge.
- Added combined analysis across all imported visits.
- Added Device ID, Visit ID, Call ID traceability.
- Added draft auto-save.
- Added visible Visit Start/End and Call Timestamp.
- Added `lastEditedAt`; original `callAt` remains unchanged after edit.
- Added optional EC omzet and omzet KPIs/export.
- Added prominent Recent Calls Edit button and completed-call editing from Call Log.
- Renamed real reason screen and made `Other` require `customObservedReason`.
- Added `New / Unmapped Actual Reasons` analysis.
- Replaced default Secondary Reason with optional `Contributing Factor`.
- Renamed `Constraint / Signal` to `Reason for Follow-up Timing` / `Alasan Menentukan Waktu Follow-up`.
- Added Indonesian/English toggle.
- Added v0.1 localStorage migration.

## Exact Revised Locations — Single HTML
### Store module
- `Store.load()`
- `Store.migrate()`
- `Store.migrateVisit()`
- `Store.migrateCall()`
- `Store.saveDraft()` / `Store.getDraft()` / `Store.clearDraft()`
- `Store.mergePayload()`

### Domain module
- `Domain.newVisit()`
- `Domain.newCall()`
- `Domain.observedKey()`
- `Domain.observedLabel()`
- `Domain.classify()`
- `Domain.saveCall()`

### Analyzer module
- `Analyzer.analyzeCalls()`
- `Analyzer.combined()`
- `Analyzer.findings()`

### Exporter module
- `Exporter.visitPackage()`
- `Exporter.backup()`
- `Exporter.callsRows()`
- `Exporter.excelForVisits()`

### UI module
- Language chrome/toggle
- Visit setup
- Mobile Call Stage 0-3
- Recent Calls
- Individual/combined Analysis
- New Reasons tab
- Call Log edit controls
- Settings > Data, Backup & Multi-Observer

## Previous vs New
| Area | v0.1.0 | v0.2.0 | Reason | Business Impact |
|---|---|---|---|---|
| Storage | One-browser local state | Local state + draft + Visit JSON | Parallel field use | Safer trial operations |
| Parallel observers | Separate data with no merge workflow | JSON import/merge + combined analysis | Two+ observers | Consolidated field evidence |
| Call time | Internal created/updated time only | Explicit callAt + lastEditedAt | Trace timing | Call sequence/time analysis possible |
| Visit time | Internal timestamp not prominent | Start/end visible and exported | Operational trace | Visit duration available |
| EC value | Not captured | Optional omzet | User request | Adds value/productivity context |
| Edit | Hidden in history flow | Visible recent/edit + completed call edit | Discoverability failure | Easier correction |
| Other reason | Generic Other + evidence only | Mandatory raw actual reason | Preserve emerging causes | New taxonomy discovery |
| Secondary reason | Always visible | Optional contributing factor | Reduced ambiguity | Faster field entry |
| Language | English | Indonesian/English | Field adoption | Easier salesman/observer use |
| Follow-up wording | Constraint / Signal | Reason for Follow-up Timing | Ambiguous term | Clearer data capture |
| Analysis | Per visit | Per visit + combined | Multi-observer need | Cross-session pattern view |

## Business Logic Impact
Reason accuracy remains based on actual primary reason vs SFA reason. New custom actual reasons are no longer collapsed into an undifferentiated `Other` count in analysis.

## IT / Architecture Impact
Storage schema changes from v0.1 to v0.2. A migration layer reads the old key and writes the migrated state under a new v0.2 key. No backend was added.

## Risks
- Manual JSON exchange can create operational discipline requirements.
- localStorage is device/browser specific and unencrypted.
- Custom free-text reasons can still fragment due synonyms/spelling; only case/whitespace normalization is automatic.
- Multiple edits on disconnected copies of the same Visit/Call resolve by latest `updatedAt`.

## Rollback
1. Keep a full v0.2 JSON backup before rollback.
2. Restore repository `index.html` from v0.1.0.
3. v0.1 will continue reading its original `nabati_fvi_v0_1` key; v0.2 does not delete it during migration.
4. Data created only in v0.2 cannot be imported directly into v0.1 without conversion.
