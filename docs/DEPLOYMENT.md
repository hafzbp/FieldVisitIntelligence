# Deployment — Field Visit Intelligence v0.4.0

## Required order

1. Keep the current deployed v0.3.10 files available for rollback.
2. Confirm Migration 007 succeeded:
   `supabase/migrations/202608120007_exact_sfa_legacy_recovery_tombstone_safe.sql`.
3. Run Migration 008:
   `supabase/migrations/202608120008_rich_non_ec_admin_intelligence.sql`.
4. Run verification:
   `supabase/verification/202608120008_verify.sql`.
5. Only after SQL verification succeeds, replace GitHub Pages repo content with v0.4.0.
6. Wait for Pages deployment/service-worker update.
7. Execute `docs/READY_TO_USE_CHECKLIST.md` on one JOVIS device and one Admin session.

## Why migration first

The v0.4.0 frontend queries new tables and the `calls.call_method` column. Deploying frontend first will generate cloud fetch/write errors.

## Migration 008 data safety

Historical Visit/Call IDs are not replaced. The `call_method` column is added with DDL `NOT NULL DEFAULT 'VISIT'`; there is no row UPDATE backfill that would collide with immutable tombstones.

## Expected post-migration checks

Verification must confirm:

- `calls.call_method` exists and has no NULL rows;
- WhatsApp constraint exists;
- new rich-evidence tables exist;
- RLS is enabled;
- private `call-evidence` bucket exists;
- no deleted call/visit was restored;
- legacy exact-SFA fields remain present.

## GitHub Pages

Deploy repository contents at the Pages root so `index.html` is at the public root. `sw.js` cache is versioned `fvi-v0.4.0`.

## Cache update

Do not clear site data on a JOVIS device while there is a pending offline queue. First confirm sync queue is empty. Then close/reopen the site if the old service-worker UI remains visible.
