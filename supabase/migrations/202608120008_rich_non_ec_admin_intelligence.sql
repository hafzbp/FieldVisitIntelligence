-- Field Visit Intelligence v0.4.0
-- Migration 008: rich Non-EC evidence, recovery events, pure WhatsApp EC,
-- private photo evidence, and admin intelligence configuration.
-- Additive/backward-compatible: existing Visit/Call IDs and historical rows are preserved.

begin;

-- ---------------------------------------------------------------------------
-- 1) Call method: physical visit vs pure WhatsApp order.
-- Historical rows are physical visits by definition and are backfilled to VISIT.
-- ---------------------------------------------------------------------------
-- IMPORTANT: add the column with DEFAULT + NOT NULL in one DDL operation.
-- PostgreSQL backfills the new column without issuing row UPDATE statements, so
-- immutable soft-deleted tombstones from v0.3.8 are not touched by DML triggers.
alter table public.calls
  add column if not exists call_method text not null default 'VISIT';

alter table public.calls alter column call_method set default 'VISIT';

do $$
begin
  if not exists (select 1 from pg_constraint where conname='calls_call_method_check') then
    alter table public.calls add constraint calls_call_method_check
      check (call_method in ('VISIT','WHATSAPP'));
  end if;
end $$;

-- route_status previously only supported JKS/OFF_ROUTE. REMOTE is used only by
-- pure WhatsApp EC so it cannot be mistaken for a physical sales call.
alter table public.calls drop constraint if exists calls_route_status_check;
alter table public.calls add constraint calls_route_status_check
  check (route_status in ('JKS','OFF_ROUTE','REMOTE'));

do $$
begin
  if not exists (select 1 from pg_constraint where conname='calls_whatsapp_must_be_ec') then
    alter table public.calls add constraint calls_whatsapp_must_be_ec
      check (call_method <> 'WHATSAPP' or (result='EC' and route_status='REMOTE'));
  end if;
end $$;

comment on column public.calls.call_method is 'VISIT = physical call with mandatory GPS check-in/out. WHATSAPP = pure EC obtained without physical visit.';

create index if not exists idx_calls_method_timestamp on public.calls(call_method, call_timestamp desc);

-- ---------------------------------------------------------------------------
-- 2) Structured reason-specific evidence. One row per Non-EC call.
-- ---------------------------------------------------------------------------
create table if not exists public.call_reason_details (
  call_id uuid primary key references public.calls(id) on delete cascade,
  jovis_user_id uuid not null references public.profiles(id),
  recoverable_today text check (recoverable_today is null or recoverable_today in ('YES','NO','UNKNOWN')),
  preferred_recovery_channel text check (preferred_recovery_channel is null or preferred_recovery_channel in ('WA','PHONE','REVISIT','OTHER','UNKNOWN','NONE')),
  best_followup_time text,

  pic_status text check (pic_status is null or pic_status in ('TEMPORARY','REMOTE_ORDERABLE','UNREACHABLE','OTHER','UNKNOWN')),
  pic_expected_return text,

  closed_status text check (closed_status is null or closed_status in ('OPEN_LATER_TODAY','REMOTE_ORDERABLE','EVENT_CLOSURE','CLOSED_ALL_DAY','PERMANENT','UNKNOWN')),
  closed_expected_open text,

  financial_status text check (financial_status is null or financial_status in ('TEMPORARY','STRUCTURAL','UNKNOWN')),
  cash_available_when text,
  partial_order_possible text check (partial_order_possible is null or partial_order_possible in ('YES','NO','UNKNOWN')),

  refusal_driver text check (refusal_driver is null or refusal_driver in ('STOCK_CYCLE','PRICE','PRODUCT','SPACE','LOW_DEMAND','OTHER','UNKNOWN')),
  expected_next_order text,

  price_issue_type text check (price_issue_type is null or price_issue_type in ('RRP_TOO_HIGH','MARGIN_LOW','COMPETITOR_CHEAPER','PROMO_GAP','OTHER','UNKNOWN')),
  price_detail text,
  product_issue_type text check (product_issue_type is null or product_issue_type in ('QUALITY','ASSORTMENT','SLOW_MOVING','EXPIRED_RISK','PACK_SIZE','DAMAGED','OTHER','UNKNOWN')),
  affected_products text,

  external_supplier_name text,
  external_supplier_driver text check (external_supplier_driver is null or external_supplier_driver in ('PRICE','TOP','AVAILABILITY','MIN_ORDER','DELIVERY','OTHER','UNKNOWN')),

  normal_buying_cycle text,
  last_order_date date,
  last_delivery_date date,
  salesman_bombing_claim text check (salesman_bombing_claim is null or salesman_bombing_claim in ('YES','NO','UNKNOWN')),
  salesman_bombing_reason text,

  detail_notes text,
  source_version text not null default '0.4.0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reason_details_jovis on public.call_reason_details(jovis_user_id, updated_at desc);
create index if not exists idx_reason_details_recoverable on public.call_reason_details(recoverable_today);
create index if not exists idx_reason_details_closed on public.call_reason_details(closed_status);
create index if not exists idx_reason_details_bombing_claim on public.call_reason_details(salesman_bombing_claim);

-- ---------------------------------------------------------------------------
-- 3) BMA stock details. Multiple rows are allowed because one call can have many SKUs.
-- ---------------------------------------------------------------------------
create table if not exists public.call_stock_items (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id) on delete cascade,
  jovis_user_id uuid not null references public.profiles(id),
  product_name text not null,
  stock_level text check (stock_level is null or stock_level in ('LOT','MEDIUM','LOW','OUT','UNKNOWN')),
  qty_note text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_stock_items_call on public.call_stock_items(call_id, created_at);
create index if not exists idx_stock_items_product on public.call_stock_items(product_name);

-- ---------------------------------------------------------------------------
-- 4) Post-visit recovery events. Original Non-EC Call remains unchanged.
-- ---------------------------------------------------------------------------
create table if not exists public.call_recovery_attempts (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id) on delete cascade,
  visit_id uuid not null references public.visits(id) on delete cascade,
  jovis_user_id uuid not null references public.profiles(id),
  attempted_at timestamptz not null,
  channel text not null check (channel in ('WA','PHONE','REVISIT','OTHER')),
  outcome text not null check (outcome in ('NO_RESPONSE','STILL_NON_EC','RECOVERED_EC')),
  omzet numeric(18,2),
  notes text,
  client_created_at timestamptz not null,
  client_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recovery_ec_requires_omzet check (
    (outcome='RECOVERED_EC' and omzet is not null and omzet >= 0)
    or (outcome<>'RECOVERED_EC' and omzet is null)
  )
);
create index if not exists idx_recovery_call on public.call_recovery_attempts(call_id, attempted_at);
create index if not exists idx_recovery_jovis on public.call_recovery_attempts(jovis_user_id, attempted_at desc);
create index if not exists idx_recovery_outcome on public.call_recovery_attempts(outcome, attempted_at desc);

-- ---------------------------------------------------------------------------
-- 5) Photo evidence metadata. Binary object is stored in private Supabase Storage.
-- ---------------------------------------------------------------------------
create table if not exists public.call_photos (
  id uuid primary key,
  call_id uuid not null references public.calls(id) on delete cascade,
  jovis_user_id uuid not null references public.profiles(id),
  storage_path text not null unique,
  photo_type text not null default 'OTHER' check (photo_type in ('STOCK','STOREFRONT','OTHER')),
  caption text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);
create index if not exists idx_call_photos_call on public.call_photos(call_id, created_at);

-- ---------------------------------------------------------------------------
-- 6) Small DB-backed configuration surface for Admin settings.
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  setting_key text primary key,
  setting_value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.app_settings(setting_key,setting_value,description)
values
  ('photo_config','{"maxDimension":1280,"quality":0.78,"maxPhotosPerCall":3}'::jsonb,'Client-side evidence image compression and per-call limit.'),
  ('analysis_rules','{"minDirectionalSample":5}'::jsonb,'Minimum sample before rule-based analysis describes a directional pattern.')
on conflict (setting_key) do nothing;

-- ---------------------------------------------------------------------------
-- 7) Child integrity: a JOVIS may only write child rows for their own live Call.
-- ---------------------------------------------------------------------------
create or replace function public.guard_call_child_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  call_owner uuid;
  call_deleted boolean;
  parent_visit uuid;
begin
  select c.jovis_user_id, c.is_deleted, c.visit_id
    into call_owner, call_deleted, parent_visit
  from public.calls c
  where c.id = new.call_id;

  if call_owner is null then
    raise exception using errcode='23503', message='Parent call does not exist.';
  end if;

  if call_deleted = true then
    raise exception using errcode='42501', message='Cannot write detail to a deleted call.';
  end if;

  if new.jovis_user_id is distinct from call_owner then
    raise exception using errcode='42501', message='Child record owner must match parent call owner.';
  end if;

  if tg_table_name='call_recovery_attempts' and new.visit_id is distinct from parent_visit then
    raise exception using errcode='42501', message='Recovery visit_id must match parent call visit_id.';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_call_child_integrity() from public;
grant execute on function public.guard_call_child_integrity() to authenticated;

drop trigger if exists trg_reason_details_integrity on public.call_reason_details;
create trigger trg_reason_details_integrity before insert or update on public.call_reason_details
for each row execute function public.guard_call_child_integrity();

drop trigger if exists trg_stock_items_integrity on public.call_stock_items;
create trigger trg_stock_items_integrity before insert or update on public.call_stock_items
for each row execute function public.guard_call_child_integrity();

drop trigger if exists trg_recovery_integrity on public.call_recovery_attempts;
create trigger trg_recovery_integrity before insert or update on public.call_recovery_attempts
for each row execute function public.guard_call_child_integrity();

drop trigger if exists trg_photos_integrity on public.call_photos;
create trigger trg_photos_integrity before insert or update on public.call_photos
for each row execute function public.guard_call_child_integrity();

-- timestamps
create trigger trg_reason_details_touch before update on public.call_reason_details
for each row execute function public.touch_updated_at();
create trigger trg_stock_items_touch before update on public.call_stock_items
for each row execute function public.touch_updated_at();
create trigger trg_recovery_touch before update on public.call_recovery_attempts
for each row execute function public.touch_updated_at();

create or replace function public.touch_app_setting()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  new.updated_at=now();
  new.updated_by=auth.uid();
  return new;
end;$$;
drop trigger if exists trg_app_settings_touch on public.app_settings;
create trigger trg_app_settings_touch before update on public.app_settings
for each row execute function public.touch_app_setting();

-- ---------------------------------------------------------------------------
-- 8) RLS for new relational tables.
-- ---------------------------------------------------------------------------
alter table public.call_reason_details enable row level security;
alter table public.call_stock_items enable row level security;
alter table public.call_recovery_attempts enable row level security;
alter table public.call_photos enable row level security;
alter table public.app_settings enable row level security;

create policy "reason_details_select_owner_or_admin" on public.call_reason_details
for select to authenticated using (jovis_user_id=(select auth.uid()) or (select public.is_admin()));
create policy "reason_details_insert_owner_or_admin" on public.call_reason_details
for insert to authenticated with check (jovis_user_id=(select auth.uid()) or (select public.is_admin()));
create policy "reason_details_update_owner_or_admin" on public.call_reason_details
for update to authenticated using (jovis_user_id=(select auth.uid()) or (select public.is_admin()))
with check (jovis_user_id=(select auth.uid()) or (select public.is_admin()));

create policy "reason_details_delete_owner_or_admin" on public.call_reason_details
for delete to authenticated using (jovis_user_id=(select auth.uid()) or (select public.is_admin()));

create policy "stock_items_select_owner_or_admin" on public.call_stock_items
for select to authenticated using (jovis_user_id=(select auth.uid()) or (select public.is_admin()));
create policy "stock_items_insert_owner_or_admin" on public.call_stock_items
for insert to authenticated with check (jovis_user_id=(select auth.uid()) or (select public.is_admin()));
create policy "stock_items_update_owner_or_admin" on public.call_stock_items
for update to authenticated using (jovis_user_id=(select auth.uid()) or (select public.is_admin()))
with check (jovis_user_id=(select auth.uid()) or (select public.is_admin()));
create policy "stock_items_delete_owner_or_admin" on public.call_stock_items
for delete to authenticated using (jovis_user_id=(select auth.uid()) or (select public.is_admin()));

create policy "recovery_select_owner_or_admin" on public.call_recovery_attempts
for select to authenticated using (jovis_user_id=(select auth.uid()) or (select public.is_admin()));
create policy "recovery_insert_owner_or_admin" on public.call_recovery_attempts
for insert to authenticated with check (jovis_user_id=(select auth.uid()) or (select public.is_admin()));
create policy "recovery_update_owner_or_admin" on public.call_recovery_attempts
for update to authenticated using (jovis_user_id=(select auth.uid()) or (select public.is_admin()))
with check (jovis_user_id=(select auth.uid()) or (select public.is_admin()));

create policy "photos_select_owner_or_admin" on public.call_photos
for select to authenticated using (jovis_user_id=(select auth.uid()) or (select public.is_admin()));
create policy "photos_insert_owner_or_admin" on public.call_photos
for insert to authenticated with check (jovis_user_id=(select auth.uid()) or (select public.is_admin()));
create policy "photos_delete_owner_or_admin" on public.call_photos
for delete to authenticated using (jovis_user_id=(select auth.uid()) or (select public.is_admin()));

create policy "app_settings_authenticated_read" on public.app_settings
for select to authenticated using (true);
create policy "app_settings_admin_update" on public.app_settings
for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- 9) Private Supabase Storage bucket and policies.
-- Path convention: <auth.uid()>/<call_id>/<photo_id>.webp
-- ---------------------------------------------------------------------------
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('call-evidence','call-evidence',false,1048576,array['image/webp','image/jpeg','image/png'])
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create policy "call_evidence_insert_own_folder" on storage.objects
for insert to authenticated
with check (
  bucket_id='call-evidence'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists (
    select 1 from public.calls c
    where c.id::text=(storage.foldername(name))[2]
      and c.jovis_user_id=(select auth.uid())
      and coalesce(c.is_deleted,false)=false
  )
);

create policy "call_evidence_select_owner_or_admin" on storage.objects
for select to authenticated
using (
  bucket_id='call-evidence'
  and ((storage.foldername(name))[1]=(select auth.uid())::text or (select public.is_admin()))
);

create policy "call_evidence_delete_owner_or_admin" on storage.objects
for delete to authenticated
using (
  bucket_id='call-evidence'
  and ((storage.foldername(name))[1]=(select auth.uid())::text or (select public.is_admin()))
);

commit;
