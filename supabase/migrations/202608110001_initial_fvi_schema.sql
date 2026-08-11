-- Field Visit Intelligence v0.3.0
-- Initial Supabase schema + RLS + audit trail

begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  email text,
  role text not null default 'jovis' check (role in ('admin','jovis')),
  employee_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.visits (
  id uuid primary key,
  jovis_user_id uuid not null references public.profiles(id),
  visit_date date not null,
  depot text not null,
  salesman_name text not null,
  salesman_id text,
  route_segment text,
  notes text,
  start_time timestamptz not null,
  end_time timestamptz,
  status text not null default 'active' check (status in ('active','completed')),
  client_created_at timestamptz not null,
  client_updated_at timestamptz not null,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_edited_by uuid references auth.users(id)
);

create unique index if not exists uq_one_active_visit_per_jovis
  on public.visits(jovis_user_id)
  where status = 'active' and is_deleted = false;
create index if not exists idx_visits_jovis_date on public.visits(jovis_user_id, visit_date desc);
create index if not exists idx_visits_depot_date on public.visits(depot, visit_date desc);

create table if not exists public.calls (
  id uuid primary key,
  visit_id uuid not null references public.visits(id) on delete cascade,
  jovis_user_id uuid not null references public.profiles(id),
  outlet_id text,
  outlet_name text not null,
  route_status text not null check (route_status in ('JKS','OFF_ROUTE')),
  result text not null check (result in ('EC','NON_EC')),
  call_timestamp timestamptz not null,
  omzet numeric(18,2),
  observed_reason_code text,
  custom_real_reason text,
  contributing_factor text,
  evidence text,
  sfa_reason_code text,
  reason_match_status text check (reason_match_status is null or reason_match_status in ('MATCH','PARTIAL','MISMATCH','UNCLEAR')),
  sfa_selection_reason text,
  revisit_plan text,
  can_revisit_earlier text check (can_revisit_earlier is null or can_revisit_earlier in ('YES','NO','UNKNOWN')),
  followup_timing_reason text,
  quick_note text,
  client_created_at timestamptz not null,
  client_updated_at timestamptz not null,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_edited_by uuid references auth.users(id),
  constraint ec_requires_omzet check (
    (result = 'EC' and omzet is not null and omzet >= 0)
    or (result = 'NON_EC')
  ),
  constraint non_ec_requires_reason check (
    result = 'EC'
    or (observed_reason_code is not null and sfa_reason_code is not null)
  ),
  constraint other_requires_custom_reason check (
    observed_reason_code <> 'other'
    or nullif(btrim(custom_real_reason),'') is not null
  )
);
create index if not exists idx_calls_visit on public.calls(visit_id, call_timestamp);
create index if not exists idx_calls_jovis on public.calls(jovis_user_id, call_timestamp desc);
create index if not exists idx_calls_reason on public.calls(sfa_reason_code, observed_reason_code);

create table if not exists public.reason_taxonomy (
  reason_code text primary key,
  reason_label_id text not null,
  reason_label_en text not null,
  reason_type text not null default 'both' check (reason_type in ('observed','sfa','both')),
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reason_mapping (
  id uuid primary key default gen_random_uuid(),
  raw_reason_normalized text not null unique,
  canonical_reason_code text not null references public.reason_taxonomy(reason_code),
  mapped_by uuid references auth.users(id),
  mapped_at timestamptz not null default now(),
  active boolean not null default true
);

create table if not exists public.call_edit_history (
  id bigint generated always as identity primary key,
  call_id uuid not null,
  visit_id uuid not null,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now(),
  old_record jsonb not null,
  new_record jsonb not null
);
create index if not exists idx_call_history_call on public.call_edit_history(call_id, changed_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  new.last_edited_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
drop trigger if exists trg_visits_touch on public.visits;
create trigger trg_visits_touch before update on public.visits for each row execute function public.touch_updated_at();
drop trigger if exists trg_calls_touch on public.calls;
create trigger trg_calls_touch before update on public.calls for each row execute function public.touch_updated_at();

create or replace function public.audit_call_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (to_jsonb(old) - 'updated_at') is distinct from (to_jsonb(new) - 'updated_at') then
    insert into public.call_edit_history(call_id, visit_id, changed_by, old_record, new_record)
    values (new.id, new.visit_id, auth.uid(), to_jsonb(old), to_jsonb(new));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_calls_audit on public.calls;
create trigger trg_calls_audit after update on public.calls for each row execute function public.audit_call_update();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, display_name, email, role, active)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'display_name',''), split_part(coalesce(new.email,''),'@',1)),
    new.email,
    'jovis',
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Backfill profiles if Auth users already existed before this migration.
insert into public.profiles(id, display_name, email, role, active)
select id, coalesce(nullif(raw_user_meta_data->>'display_name',''), split_part(coalesce(email,''),'@',1)), email, 'jovis', true
from auth.users
on conflict (id) do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active = true
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.visits enable row level security;
alter table public.calls enable row level security;
alter table public.reason_taxonomy enable row level security;
alter table public.reason_mapping enable row level security;
alter table public.call_edit_history enable row level security;

-- PROFILES
create policy "profiles_select_own_or_admin" on public.profiles
for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles_admin_update" on public.profiles
for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- VISITS
create policy "visits_select_owner_or_admin" on public.visits
for select to authenticated using (jovis_user_id = (select auth.uid()) or (select public.is_admin()));
create policy "visits_insert_owner_or_admin" on public.visits
for insert to authenticated with check (jovis_user_id = (select auth.uid()) or (select public.is_admin()));
create policy "visits_update_owner_or_admin" on public.visits
for update to authenticated using (jovis_user_id = (select auth.uid()) or (select public.is_admin()))
with check (jovis_user_id = (select auth.uid()) or (select public.is_admin()));

-- CALLS
create policy "calls_select_owner_or_admin" on public.calls
for select to authenticated using (jovis_user_id = (select auth.uid()) or (select public.is_admin()));
create policy "calls_insert_owner_or_admin" on public.calls
for insert to authenticated with check (jovis_user_id = (select auth.uid()) or (select public.is_admin()));
create policy "calls_update_owner_or_admin" on public.calls
for update to authenticated using (jovis_user_id = (select auth.uid()) or (select public.is_admin()))
with check (jovis_user_id = (select auth.uid()) or (select public.is_admin()));

-- TAXONOMY
create policy "taxonomy_authenticated_read" on public.reason_taxonomy
for select to authenticated using (true);
create policy "taxonomy_admin_insert" on public.reason_taxonomy
for insert to authenticated with check ((select public.is_admin()));
create policy "taxonomy_admin_update" on public.reason_taxonomy
for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- MAPPING
create policy "reason_mapping_authenticated_read" on public.reason_mapping
for select to authenticated using (true);
create policy "reason_mapping_admin_insert" on public.reason_mapping
for insert to authenticated with check ((select public.is_admin()));
create policy "reason_mapping_admin_update" on public.reason_mapping
for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- AUDIT HISTORY
create policy "history_select_owner_or_admin" on public.call_edit_history
for select to authenticated using (
  (select public.is_admin())
  or exists (
    select 1 from public.calls c
    where c.id = call_edit_history.call_id and c.jovis_user_id = (select auth.uid())
  )
);

revoke all on public.profiles, public.visits, public.calls, public.reason_taxonomy, public.reason_mapping, public.call_edit_history from anon;
grant select on public.profiles, public.visits, public.calls, public.reason_taxonomy, public.reason_mapping, public.call_edit_history to authenticated;
grant insert, update on public.visits, public.calls to authenticated;
grant update on public.profiles to authenticated;
grant insert, update on public.reason_taxonomy, public.reason_mapping to authenticated;

insert into public.reason_taxonomy(reason_code,reason_label_id,reason_label_en,reason_type,sort_order) values
('pic','PIC Tidak Tersedia','PIC Availability','both',10),
('stock','Stok Masih Tersedia','Stock Still Available','both',20),
('financial','Kendala Keuangan / Cash','Financial / Cash','both',30),
('closed','Toko Tutup','Store Closed','both',40),
('price','Harga','Price','both',50),
('refusal','Belum Butuh / Menolak','No Need / Refusal','both',60),
('competitor','Kompetitor','Competitor','both',70),
('product','Kendala Produk','Product Issue','both',80),
('other','Lainnya','Other','both',90),
('unclear','Tidak Jelas','Unclear','both',100)
on conflict (reason_code) do update set
 reason_label_id=excluded.reason_label_id,
 reason_label_en=excluded.reason_label_en,
 reason_type=excluded.reason_type,
 sort_order=excluded.sort_order;

commit;
