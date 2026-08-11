# Patch Notes v0.3.5

## Scope
- Admin visit deletion / test-data cleanup
- Mobile UI polish
- Login landing branding refresh

## Changes
1. **Admin Delete Visit**
   - Added `Delete` action in Admin Visit Monitor and admin-visible visit cards.
   - Delete is implemented as **soft delete** (`is_deleted=true`, `deleted_at`) for the visit and all related calls.
   - Local draft for the deleted visit is also removed.

2. **Bulk Test Cleanup**
   - Added `Hapus Visit Testing / Delete Test Visits` button in Admin page.
   - Bulk cleanup targets visits where `depot` or `salesman_name` equals `test` or `qa`.

3. **Mobile UI fixes**
   - Bottom navigation now centers correctly based on actual item count.
   - Bottom nav icons replaced with inline SVG icons.
   - Date input constrained to prevent horizontal overflow on mobile.
   - Logout / Exit button updated to red danger style.

4. **Login page improvements**
   - Added app name and subtitle on login / setup screens.

5. **Versioning**
   - App version bumped to `0.3.5`.
   - Service worker cache bumped to `fvi-v0.3.5`.

## QA
- `tests/unit/test_v034.py` updated for v0.3.5 checks.
- Result: **19 PASS / 0 FAIL**.
