# Architecture

```text
GitHub Pages
  |
  |-- Supabase Auth session
  |-- IndexedDB local cache / draft / sync queue
  |-- Rule-based analytical engine
  |-- Detailed Excel export
  |
  +--> Supabase
       |-- Auth
       |-- Postgres
       |-- Row Level Security
       |-- Audit trigger
```

## Source of truth
- Cloud operational source of truth: Supabase Postgres.
- Field resilience: IndexedDB local-first copy + pending queue.
- GitHub repo: application source, configuration, migrations, documentation.

## Save flow
User Save → IndexedDB → queue → UI continues → Supabase upsert when online → queue item removed after acknowledgement.

## Sync states
- Synced
- Pending
- Offline
- Syncing
- Sync Error

## Roles
- JOVIS: RLS limits rows to `jovis_user_id = auth.uid()`.
- Admin: RLS helper grants visibility/update across all FVI records.

## External dependency
`@supabase/supabase-js` is loaded as a browser ES module. The service worker caches fetched resources after first successful online use, but first authentication/setup requires connectivity.
