# Rollback — v0.3.4

## Rollback target
v0.3.3

## Database
No Supabase schema migration is introduced by v0.3.4. Database schema remains `202608110003`, so no database rollback is required.

## Frontend rollback
1. Preserve/export any visible JSON backup if needed.
2. Do **not** clear browser/site data while Sync Queue contains Pending/Error rows.
3. Restore repository files from `rollback/v0.3.3/FieldVisitIntelligence_v0.3.3_source.zip` or revert the Git commit that deployed v0.3.4.
4. Commit/push to `main` and wait for GitHub Pages deployment.
5. Reload the app and verify the version badge.

## Validation after rollback
- Login Admin/JOVIS.
- Confirm local queue remains present.
- Confirm existing visits/calls remain visible locally/cloud according to RLS.
- Do not assume failed queue records were acknowledged by Supabase; inspect them before clearing browser data.
