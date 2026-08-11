# Patch Notes v0.3.7 — Mandatory GPS Check-in & Dwell Time

## Business change
New call flow becomes:

`CHECK IN CALL #N` → mandatory location + check-in timestamp → call input → `Simpan & ke Call Berikutnya` → mandatory checkout location + checkout timestamp → duration calculation → next call check-in gate.

## Added
- Mandatory browser geolocation at check-in.
- Mandatory checkout geolocation for new calls.
- Check-in / checkout latitude, longitude and accuracy.
- Automatic call dwell time (`duration_seconds`).
- `Kode Toko` terminology.
- Fixed `C` prefix with numeric-only code entry.
- Dwell-time KPIs in Analysis/Admin.
- GPS/dwell-time fields in detailed export.
- New `09_DWELL_TIME_GPS` export sheet.

## Database
Run migration:

`202608110004_add_call_checkin_location.sql`

Existing historical calls remain valid; new columns are nullable at DB level for backward compatibility, while v0.3.7 enforces mandatory location in the application for new calls.

## QA
Static/unit QA: **41 PASS / 0 FAIL**.
Real-device GPS permission and physical-location behavior remain deployment QA items.
