# ARCHITECTURE — v0.2.0

## Deployment Model
Static single-page application optimized for GitHub Pages. All code and Nabati logo are embedded in one HTML. No runtime external dependency is required.

## Logical Modules
### Store
Responsibilities:
- localStorage load/save
- v0.1 -> v0.2 migration
- active-visit isolation by device ID
- draft persistence
- JSON import/merge

Key functions:
- `Store.load()`
- `Store.migrate()`
- `Store.migrateVisit()`
- `Store.migrateCall()`
- `Store.saveDraft()` / `Store.getDraft()` / `Store.clearDraft()`
- `Store.mergePayload()`

### Domain
Responsibilities:
- Visit and Call entities
- reason label resolution
- custom actual-reason handling
- Match/Partial/Mismatch/Unclear classification
- call update semantics

Key functions:
- `Domain.newVisit()`
- `Domain.newCall()`
- `Domain.observedKey()` / `Domain.observedLabel()`
- `Domain.classify()`
- `Domain.saveCall()`

### Analyzer
Responsibilities:
- SC / EC / Non-EC
- EC/SC
- omzet
- reason accuracy
- mismatch matrix
- custom/unmapped actual reasons
- follow-up distribution
- rule-based findings
- combined analysis across visits

Key functions:
- `Analyzer.analyzeCalls()`
- `Analyzer.visit()`
- `Analyzer.combined()`
- `Analyzer.findings()`

### Exporter
Responsibilities:
- single Visit JSON package
- full JSON backup
- single/combined SpreadsheetML Excel-compatible export
- print/PDF

### UI
Responsibilities:
- bilingual rendering
- mobile call wizard
- recent-call edit controls
- individual / combined analysis
- settings and import controls

## Canonical Data Flow
```text
Mobile input
-> Input validation
-> Auto-saved Draft
-> Domain record
-> localStorage canonical state
-> Analyzer
-> UI / JSON / Excel / Print
```

## Multi-Observer Flow
```text
Device A localStorage --Visit JSON--\
Device B localStorage --Visit JSON----> Coordinator localStorage -> Combined Analyzer -> Excel/PDF
Device C localStorage --Visit JSON--/
```

## Source of Truth
Within one device: localStorage key `nabati_fvi_v0_2`.

Across devices: exported Visit JSON is the portable source-of-truth. Excel is a reporting derivative, not the canonical re-import format.

## Migration
On first v0.2 load:
1. Read `nabati_fvi_v0_2` if present.
2. Otherwise read legacy `nabati_fvi_v0_1`.
3. Convert old `observedSecondaryId` -> `contributingFactorId`.
4. Convert old `constraint` -> `followupTimingReason`.
5. Convert legacy follow-up strings to stable codes.
6. Add timestamps/custom-reason/order-value fields where absent.
7. Save migrated state under `nabati_fvi_v0_2`.
8. Legacy key is retained as a rollback safeguard.

## Security
- No external transmission by application code.
- No API keys.
- User content is escaped before HTML rendering.
- JSON/Excel exports may contain confidential outlet/salesman information and must be handled accordingly.
- localStorage is not encrypted.
- Public GitHub Pages URL does not itself expose localStorage data from another user's browser; however, do not embed confidential master data in source code.

## Performance
Module QA processed 100 calls with no hard call cap. localStorage remains suitable for trial-scale datasets. A central database is recommended before larger team-scale/longitudinal rollout.
