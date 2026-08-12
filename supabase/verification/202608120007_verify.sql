-- Field Visit Intelligence v0.3.10 post-migration verification.
-- Run after Migration 007. Read-only queries only.

select
  count(*) filter (where c.result='NON_EC' and coalesce(c.is_deleted,false)=false and coalesce(v.is_deleted,false)=false) as live_non_ec,
  count(*) filter (where c.result='NON_EC' and coalesce(c.is_deleted,false)=false and coalesce(v.is_deleted,false)=false and c.sfa_recovery_status='AUTO_RECOVERED') as auto_recovered,
  count(*) filter (where c.result='NON_EC' and coalesce(c.is_deleted,false)=false and coalesce(v.is_deleted,false)=false and c.sfa_recovery_status='UNRESOLVED') as unresolved,
  count(*) filter (where c.result='NON_EC' and coalesce(c.is_deleted,false)=false and coalesce(v.is_deleted,false)=false and c.sfa_recovery_status='EXACT_CAPTURED') as exact_captured,
  count(*) filter (where c.result='NON_EC' and coalesce(c.is_deleted,false)=false and coalesce(v.is_deleted,false)=false and c.sfa_recovery_status='MANUAL_CONFIRMED') as manual_confirmed
from public.calls c
join public.visits v on v.id=c.visit_id;

-- Tombstones must remain untouched by recovery provenance.
select
  count(*) as deleted_calls_with_recovery_fields
from public.calls c
where coalesce(c.is_deleted,false)=true
  and (c.sfa_reason_exact_code is not null or c.sfa_capture_type is not null or c.sfa_recovery_status is not null);

-- Orphan/live-under-deleted-parent rows should be zero under the v0.3.8 integrity model.
select
  count(*) as active_calls_under_deleted_visit
from public.calls c
join public.visits v on v.id=c.visit_id
where coalesce(c.is_deleted,false)=false
  and coalesce(v.is_deleted,false)=true;
