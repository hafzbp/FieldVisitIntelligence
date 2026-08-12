# Rollback — v0.4.0

**Rollback frontend target:** v0.3.10  
**Source backup:** `rollback/v0.3.10/FieldVisitIntelligence_v0.3.10_source.zip`

## Frontend rollback

1. Confirm JOVIS sync queues are empty.
2. Replace GitHub Pages content with the archived v0.3.10 package.
3. Wait for Pages deployment.
4. Close/reopen the app and verify the v0.3.10 version header.
5. Run the v0.3.10 baseline smoke flow.

## Database rollback

Migration 008 is additive. A frontend rollback to v0.3.10 does **not** require dropping the new v0.4.0 tables or `call_method` column. Keeping additive schema objects avoids destructive rollback risk and preserves any v0.4.0 evidence already collected.

Do not delete v0.4.0 rich-evidence rows merely to roll back the frontend.

## If Migration 008 fails

The migration is transactional. Do not deploy frontend v0.4.0. Capture the full SQL error and fix forward with a new migration rather than weakening tombstone/RLS protections.
