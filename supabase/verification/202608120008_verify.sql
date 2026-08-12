-- Field Visit Intelligence v0.4.0 post-migration verification.
-- Run after Migration 008. Read-only checks only.

select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public' and table_name='calls' and column_name='call_method';

select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid='public.calls'::regclass
  and conname in ('calls_call_method_check','calls_route_status_check','calls_whatsapp_must_be_ec')
order by conname;

select table_name
from information_schema.tables
where table_schema='public'
  and table_name in ('call_reason_details','call_stock_items','call_recovery_attempts','call_photos','app_settings')
order by table_name;

select setting_key,setting_value from public.app_settings order by setting_key;

select id,name,public,file_size_limit,allowed_mime_types
from storage.buckets where id='call-evidence';

select call_method,count(*)
from public.calls
where coalesce(is_deleted,false)=false
group by call_method
order by call_method;

-- Must be zero: call_method is populated for live and tombstone history.
select count(*) as null_call_method_rows
from public.calls
where call_method is null;

-- Must be zero: pure WhatsApp is always an EC/REMOTE event.
select count(*) as invalid_whatsapp_rows
from public.calls
where call_method='WHATSAPP'
  and (result is distinct from 'EC' or route_status is distinct from 'REMOTE');

-- Must be zero: child owner must match parent Call owner.
select count(*) as child_owner_mismatch_rows
from (
  select rd.call_id,rd.jovis_user_id from public.call_reason_details rd
  union all select si.call_id,si.jovis_user_id from public.call_stock_items si
  union all select ra.call_id,ra.jovis_user_id from public.call_recovery_attempts ra
  union all select ph.call_id,ph.jovis_user_id from public.call_photos ph
) x
join public.calls c on c.id=x.call_id
where x.jovis_user_id is distinct from c.jovis_user_id;

-- Confirm RLS is active on every new public table.
select relname, relrowsecurity
from pg_class
where oid in (
  'public.call_reason_details'::regclass,
  'public.call_stock_items'::regclass,
  'public.call_recovery_attempts'::regclass,
  'public.call_photos'::regclass,
  'public.app_settings'::regclass
)
order by relname;
