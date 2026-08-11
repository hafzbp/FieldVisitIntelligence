# Deployment

## Frontend
GitHub Pages serves the repository root.
`index.html` is the entry point.

## Database
Every schema change must be committed as a new timestamped file under `supabase/migrations/`.
Do not rewrite old migrations after production data exists.

Recommended future workflow:
1. create migration file
2. test
3. commit
4. deploy migration
5. deploy frontend
6. run regression QA

Supabase GitHub integration or Supabase CLI can automate migration deployment later.

## v0.3.7 required migration
Before field use of v0.3.7, run in Supabase SQL Editor:

`supabase/migrations/202608110004_add_call_checkin_location.sql`

Target result: `Success. No rows returned`.

Then upload the v0.3.7 repository files to GitHub Pages. Verify the header shows `v0.3.7` before testing GPS check-in.


## v0.3.8 required migration
Before using v0.3.8, confirm migration 004 has already been run, then run:

`supabase/migrations/202608110005_protect_soft_delete_tombstones.sql`

Target result: `Success. No rows returned`.

Then upload the v0.3.8 repository files to GitHub Pages and verify the header shows `v0.3.8`.

Final smoke test: Admin deletes one test Visit, then the JOVIS account/device must stop showing it after refocus/refresh without clearing browser data.
