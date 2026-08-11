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


## v0.3.4 Sync Reliability
Cloud persistence now passes through an explicit client-owned-field sanitizer before UPSERT. Server-managed Postgres fields are never echoed from local cache back into database writes. The sync queue coalesces repeated record UPSERTs and retains backend error metadata until acknowledgement. Settings includes a Sync & QA Diagnostics surface; diagnostics execute under the current authenticated session and therefore respect RLS.

Service worker delivery is network-first with cache fallback so GitHub Pages releases converge to the newest code while retaining offline startup capability.
