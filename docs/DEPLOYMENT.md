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
