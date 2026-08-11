# CHANGELOG

## [0.2.0] - 2026-08-11

### Added
- Indonesian/English language mode.
- Auto-saved unfinished call draft.
- Visit start/end timestamps and per-call timestamp.
- EC omzet/order value.
- Visible edit workflow with edit timestamp.
- Mandatory custom actual-reason text for `Other`.
- Optional contributing factor.
- New / Unmapped Actual Reasons analysis.
- Visit JSON export.
- Multi-file Import & Merge.
- Combined analysis and combined Excel export.
- Device ID traceability.
- v0.1 schema/localStorage migration.

### Changed
- `Secondary Reason` -> optional `Contributing Factor`.
- `Constraint / Signal` -> `Reason for Follow-up Timing` / `Alasan Menentukan Waktu Follow-up`.
- Follow-up options use stable internal codes independent of display language.
- Recent call editing is surfaced directly in the field screen.

### Preserved
- Mobile-first static GitHub Pages deployment.
- No dummy field data.
- SFA vs actual reason Match/Partial/Mismatch/Unclear logic.
- Rule-based conclusions.
- Local-only runtime with no external API/dependency.
