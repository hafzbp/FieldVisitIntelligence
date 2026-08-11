# QA Report — Field Visit Intelligence v0.3.7

## Scope
Static/unit QA for mandatory call check-in, browser geolocation wiring, Kode Toko normalization, checkout duration capture, Supabase payload fields, migration presence, export fields, sync regression, and JavaScript syntax.

## Result
**41 PASS / 0 FAIL**

Executed with:

```text
python tests/unit/test_v037.py
```

## Key PASS checks
- Version and service-worker cache = v0.3.7.
- `Kode Toko` uses fixed `C` prefix and numeric-only field entry.
- New calls are gated behind `CHECK IN CALL #`.
- Check-in invokes `navigator.geolocation.getCurrentPosition` with high-accuracy request.
- Location denial / unavailable position prevents progressing into a new call.
- Check-in timestamp and coordinates are persisted in the call draft.
- Checkout timestamp and coordinates are captured before a new call can be saved.
- Duration is calculated as checkout minus check-in.
- An unfinished checked-in call prevents ending the field visit.
- New fields are whitelisted in the Supabase call payload.
- Migration `202608110004_add_call_checkin_location.sql` includes all required columns and range constraints.
- Detailed export includes check-in, checkout, duration, GPS, Kode Toko and `09_DWELL_TIME_GPS`.
- Existing sync-queue deduplication and invalid-status repair remain present.
- No Supabase secret/service-role key value exists in the repository.
- All JavaScript files pass `node --check`.

## Blocked / requires real-device verification
The following cannot be truthfully marked PASS from static/container QA and must be tested after GitHub Pages deployment:
- iOS/Android browser permission prompt behavior.
- Actual GPS acquisition and accuracy on a physical phone.
- Denied permission → retry after user changes browser/site permission.
- Successful cloud persistence after migration 004 has been run in the target Supabase project.
- Real check-in → checkout dwell-time behavior during a field call.

## Required deployment dependency
Run migration `202608110004_add_call_checkin_location.sql` in Supabase before using v0.3.7 in production.
