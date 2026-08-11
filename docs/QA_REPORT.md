# QA Report — Field Visit Intelligence v0.3.8

## Release purpose
Release-candidate hardening for cross-device soft-delete reconciliation and data-integrity protection before field use.

## Automated/static result
**90 PASS / 0 FAIL** across the retained regression suites:

- `tests/unit/test_v034.py` → 21 PASS / 0 FAIL
- `tests/unit/test_v037.py` → 41 PASS / 0 FAIL
- `tests/unit/test_v038.py` → 28 PASS / 0 FAIL

## v0.3.8 checks
- Supabase fetch includes `is_deleted=true` Visit and Call tombstones.
- Remote Admin deletion overwrites stale local cache even when a stale local queue item exists.
- Stale pending UPSERT queue items are removed when the same record is already tombstoned in cloud.
- Draft calls belonging to a deleted Visit are removed locally.
- A deleted Visit cannot continue rendering in Field or Analysis screens.
- Admin-deleted rows remain excluded from active analysis/export/UI.
- Background inbound refresh runs every 60 seconds outside active call capture/setup.
- App pulls updates again when the browser/tab regains focus or visibility.
- Background pull is disabled while the JOVIS is actively in `field` or `setup`, preventing form disruption.
- Migration 005 prevents non-Admin clients from changing soft-delete state or editing a tombstoned row.
- Migration 005 enforces Call owner = parent Visit owner.
- Migration 005 blocks active Call insert/restore under a deleted Visit.
- Existing GPS check-in, mandatory location, Kode Toko C-prefix, dwell-time capture, sync diagnostics, export, and queue deduplication remain present.
- All JavaScript passes `node --check`.
- Repository contains no Supabase secret/service-role key value.

## Remaining real-environment verification
The following cannot be truthfully marked PASS from container/static QA and should be checked once after deployment:

1. Run migration `202608110005_protect_soft_delete_tombstones.sql` successfully in the target Supabase project.
2. Admin deletes a test Visit → JOVIS account/device no longer shows it after refresh/refocus/background pull.
3. JOVIS GPS permission prompt works on the actual iOS/Android browser.
4. Check-in and checkout GPS/timestamp persist to Supabase.
5. One test consolidated export opens correctly after real field rows exist.

## Release assessment
**Code/static regression status: PASS.**
Production readiness remains conditional only on the five real-environment verification items above.
