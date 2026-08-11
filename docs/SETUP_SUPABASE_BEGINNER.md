# Setup Supabase — Beginner Guide

This guide assumes you have never used Supabase before.

## What you need
- Your GitHub repository: `FieldVisitIntelligence`.
- A Supabase account.
- No API payment is required for the application architecture itself; check your Supabase plan/usage limits separately.

## Step 1 — Create a Supabase project
1. Open Supabase Dashboard.
2. Create a **New project**.
3. Choose your organization.
4. Name it, for example: `FieldVisitIntelligence`.
5. Create a strong database password and store it safely. Do **not** put it in GitHub.
6. Choose the closest suitable region for your users.
7. Wait until the project finishes provisioning.

## Step 2 — Apply the FVI database schema
For the first pilot, the simplest route is:
1. In Supabase Dashboard open **SQL Editor**.
2. Open this repository file:
   `supabase/migrations/202608110001_initial_fvi_schema.sql`
3. Copy its full contents.
4. Paste into SQL Editor.
5. Run it once.
6. Then run:
   `supabase/migrations/202608110002_admin_taxonomy_helpers.sql`

The migration creates:
- profiles
- visits
- calls
- reason_taxonomy
- reason_mapping
- call_edit_history
- RLS policies
- one-active-visit-per-JOVIS constraint
- call edit audit trigger

For later releases, keep every migration file in GitHub and apply migrations in timestamp order. When you are comfortable with Supabase CLI or GitHub integration, move to migration-based automated deployment rather than ad-hoc remote edits.

## Step 3 — Create the Admin Auth account
1. Go to **Authentication → Users**.
2. Create/Add a user with your Admin email and password.
3. Make sure the user can sign in (for pilot users created manually, use the Dashboard option appropriate for a confirmed user / no email-confirmation blockage).
4. The migration trigger automatically creates a `profiles` row with role `jovis`.
5. Open **Table Editor → profiles**.
6. Find your Admin account row.
7. Change `role` from `jovis` to `admin`.
8. Set `display_name`, for example `Hafiz`.
9. Keep `active = true`.

This manual role promotion is only for the bootstrap Admin. Future in-app account management can be added with a protected server-side function.

## Step 4 — Create JOVIS accounts
For the pilot, create users manually in **Authentication → Users**.

Recommended pattern:
- `jovis01@your-domain`
- `jovis02@your-domain`
- etc.

After each Auth user is created, the profile trigger creates a matching profile with `role = jovis`.
Then edit `display_name` in Table Editor, for example:
- JOVIS 01 — Andi
- JOVIS 02 — Budi

Do not share one account between two JOVIS if you want clean ownership/audit history.

## Step 5 — Copy Project URL + Publishable Key
In Supabase Dashboard:
1. Open the project's **Connect** dialog, or **Settings → API Keys**.
2. Copy the **Project URL**.
3. Copy the **Publishable key** beginning with `sb_publishable_...`.

Do **not** copy the Secret key / legacy service_role key into the website.

## Step 6 — Put the connection values in GitHub
Edit:

`src/config/supabase-config.js`

Replace:

```js
url: 'PASTE_YOUR_SUPABASE_PROJECT_URL_HERE',
publishableKey: 'PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE'
```

with your Project URL and Publishable Key.

These two values are designed for public client applications and are protected by RLS; the Publishable Key is not a database password.

## Step 7 — Upload v0.3 to GitHub
Replace the current repository root with the v0.3 GitHub-ready package while keeping your normal Git history.

Expected root:

```text
assets/
docs/
rollback/
src/
supabase/
.nojekyll
index.html
manifest.webmanifest
README.md
sw.js
version.json
```

Commit example:

`Release Field Visit Intelligence v0.3.0 - Supabase multi-user`

GitHub Pages will serve `index.html`.

## Step 8 — First login test
Test with:
- 1 Admin account
- 2 JOVIS accounts

Required security test:
1. JOVIS A creates a visit/call.
2. JOVIS B logs in on another device.
3. JOVIS B must **not** see JOVIS A's records.
4. Admin logs in.
5. Admin must see both JOVIS datasets.

Do not proceed to production use if RLS isolation fails.

## Step 9 — Offline test
1. Login while online.
2. Start a visit.
3. Save one call.
4. Turn airplane mode on.
5. Save additional calls.
6. Confirm Sync badge shows Offline / Pending.
7. Restart the browser and reopen the installed/cached app if available.
8. Turn internet back on.
9. Tap Sync Now or wait for automatic retry.
10. Verify pending calls appear in Supabase and are not duplicated.

## Step 10 — Admin export for ChatGPT
Admin → apply filters if needed → **Export Detail untuk Analisis**.

The workbook contains:
- `00_Summary`
- `01_RAW_CALL_LOG`
- `02_NON_EC_DETAIL`
- `03_REASON_ACCURACY`
- `04_MISMATCH_MATRIX`
- `05_UNMAPPED_REASONS`
- `06_FOLLOW_UP`
- `07_VISIT_SUMMARY`
- `08_DATA_DICTIONARY`

Upload that export to ChatGPT for deeper clustering, taxonomy-gap analysis, and proposed granular Non-EC reasons for E-Work.
