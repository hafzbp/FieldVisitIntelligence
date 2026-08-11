# Field Visit Intelligence v0.3.2

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


## v0.3.2 configuration
Frontend is preconfigured for Supabase project ref `gxwysmjttzqppiadryjc` using the publishable client key. No Supabase secret/service-role key is stored in this repository. Database migrations still must be executed in the target Supabase project before cloud features can function.

## v0.3.2 database hotfix
If the project previously ran migrations `202608110001` and `202608110002`, also run:

`supabase/migrations/202608110003_fix_update_triggers.sql`

This fixes profile-role updates while preserving `last_edited_by` on visits/calls.
