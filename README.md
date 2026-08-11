# Field Visit Intelligence v0.3.4

Mobile-first field visit application for EC/SC 90% Non-EC validation.

## v0.3.x adds
- Supabase Auth (Admin / JOVIS).
- Central Postgres storage with Row Level Security.
- Local IndexedDB cache + offline sync queue.
- One active visit per JOVIS account.
- Mandatory omzet for EC.
- Visit/call timestamps.
- Editing of completed visits/calls.
- Admin consolidated dashboard.
- Detailed analytical export designed for downstream ChatGPT analysis.
- Unmapped actual-reason discovery for future E-Work Non-EC taxonomy design.
- v0.2 local-data migration.

## Repository layout

```text
index.html
assets/
src/
supabase/migrations/
docs/
rollback/v0.2.0/
version.json
sw.js
manifest.webmanifest
```

## First-time setup
Read `docs/SETUP_SUPABASE_BEGINNER.md`.

## Security rule
Only the Supabase Project URL and Publishable Key may be stored in the frontend repository.
Never store a Supabase Secret key, service_role key, database password, or user password in GitHub.


## v0.3.4 configuration
Frontend is preconfigured for Supabase project ref `gxwysmjttzqppiadryjc` using the publishable client key. No Supabase secret/service-role key is stored in this repository. Database migrations still must be executed in the target Supabase project before cloud features can function.

## v0.3.2 database hotfix (retained)
If the project previously ran migrations `202608110001` and `202608110002`, also run:

`supabase/migrations/202608110003_fix_update_triggers.sql`

This fixes profile-role updates while preserving `last_edited_by` on visits/calls.

## v0.3.4 Sync Reliability & QA Diagnostic
- Cloud UPSERT payloads now whitelist client-owned fields; PostgreSQL audit/default columns are no longer echoed back from cached rows.
- Sync queue coalesces repeated edits for the same record.
- Failed queue rows expose the original Supabase error and can be retried individually or in bulk.
- The Sync badge is clickable and opens Sync & QA Diagnostics.
- Diagnostic checks cover local IndexedDB, authenticated session, profile, database visibility/RLS behavior, and queue state.
- Service worker now uses network-first fetch with cache fallback to reduce stale GitHub Pages deployments.
