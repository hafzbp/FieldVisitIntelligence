# Patch Notes — v0.3.8

## Fixed: cross-device Admin deletion
Admin soft-deleted visits/calls now propagate to every device. Supabase tombstones are fetched rather than filtered out before IndexedDB reconciliation.

## Fixed: stale local queue resurrection risk
If a device has an old pending edit for a row that Admin already deleted, the cloud tombstone wins and the stale queue item is discarded.

## Added: deletion integrity guard
Migration `202608110005_protect_soft_delete_tombstones.sql`:
- makes soft-delete state Admin-controlled;
- prevents JOVIS updates to already-deleted rows;
- requires Call ownership to match the parent Visit;
- prevents active calls being created/restored under a deleted Visit.

## Added: inbound background refresh
Outside active field capture/setup, the app pulls cloud changes every 60 seconds and when the tab/window regains focus.

## Preserved
- mandatory GPS check-in;
- checkout GPS + dwell time;
- `Kode Toko` numeric entry with fixed `C` prefix;
- Admin/JOVIS RLS architecture;
- detailed analytical export;
- sync diagnostics and retry;
- Admin test-data deletion.
