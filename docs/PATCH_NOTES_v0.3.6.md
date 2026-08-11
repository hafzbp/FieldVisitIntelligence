# Patch Notes v0.3.6

## Root cause
Admin visit deletion in v0.3.5 soft-deleted a visit **and** changed `status` to `deleted`. The Supabase `visits_status_check` constraint only accepts valid operational states, so the cloud upsert failed even though JOVIS normal sync continued to work.

## Fix
- Soft delete now only sets `is_deleted=true` and `deleted_at`.
- Existing visit status remains unchanged.
- Cloud payload sanitizer automatically repairs legacy queued `status=deleted` payloads from v0.3.5 to `active` or `completed` based on `end_time`.
- Existing Admin error queue can therefore be retried after upgrade without clearing browser/site data.
- Bulk test cleanup now refreshes the Admin dashboard once after the batch instead of re-rendering after every visit.

## Database
No SQL migration required.

## Recovery steps
1. Deploy v0.3.6.
2. Open Settings → Sync & QA Diagnostic.
3. Click **Retry All Errors**.
4. Confirm queue becomes 0 and deleted test visits disappear from active analysis.
