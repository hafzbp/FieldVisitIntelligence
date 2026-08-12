-- Field Visit Intelligence v0.3.10
-- Migration 007: tombstone-safe exact SFA/E-Work recovery.
--
-- Why this migration exists:
-- Migration 006 attempted to backfill every NON_EC call. In databases containing
-- Admin soft-delete tombstones, v0.3.8's guard_soft_delete_tombstone() correctly
-- rejected UPDATEs against deleted calls. Because migration 006 is transactional,
-- a failed execution did not commit its schema/backfill changes.
--
-- This migration is intentionally standalone and idempotent:
-- - it can be run after a failed 006;
-- - it can also be run on an environment where 006 happened to succeed;
-- - it never edits soft-deleted calls or calls whose parent Visit is deleted;
-- - it preserves existing Call/Visit IDs and legacy SFA values.

begin;

-- 1) Separate observed/actual taxonomy from exact SFA/E-Work taxonomy.
update public.reason_taxonomy
set reason_type = 'observed', updated_at = now()
where reason_code in ('pic','stock','financial','closed','price','refusal','competitor','product','other','unclear');

insert into public.reason_taxonomy(reason_code, reason_label_id, reason_label_en, reason_type, sort_order, active)
values
  ('sfa_owner_absent',     'Pemilik tidak ada ditempat', 'Owner not present',            'sfa', 210, true),
  ('sfa_call_later',       'Nanti ditelpon saja',        'Call later',                   'sfa', 220, true),
  ('sfa_stock_available',  'Barang masih ada',           'Stock still available',        'sfa', 230, true),
  ('sfa_no_cash',          'Toko tidak ada uang',        'Store has no cash',             'sfa', 240, true),
  ('sfa_store_closed',     'Toko Tutup',                 'Store closed',                  'sfa', 250, true),
  ('sfa_other_supplier',   'Ambil dari supplier lain',   'Buy from another supplier',     'sfa', 260, true),
  ('sfa_other',            'Lainnya',                    'Other',                         'sfa', 270, true)
on conflict (reason_code) do update set
  reason_label_id = excluded.reason_label_id,
  reason_label_en = excluded.reason_label_en,
  reason_type = excluded.reason_type,
  sort_order = excluded.sort_order,
  active = excluded.active,
  updated_at = now();

-- 2) Add provenance fields. Legacy sfa_reason_code is intentionally retained unchanged.
alter table public.calls add column if not exists sfa_reason_exact_code text;
alter table public.calls add column if not exists sfa_capture_type text;
alter table public.calls add column if not exists sfa_recovery_status text;

comment on column public.calls.sfa_reason_exact_code is 'Exact SFA/E-Work reason code introduced in v0.3.9; tombstone-safe migration corrected in v0.3.10. Legacy sfa_reason_code remains preserved.';
comment on column public.calls.sfa_capture_type is 'EXACT for direct exact capture; LEGACY for records created before exact SFA taxonomy.';
comment on column public.calls.sfa_recovery_status is 'EXACT_CAPTURED, AUTO_RECOVERED, MANUAL_CONFIRMED, or UNRESOLVED.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname='calls_sfa_capture_type_check') then
    alter table public.calls add constraint calls_sfa_capture_type_check
      check (sfa_capture_type is null or sfa_capture_type in ('EXACT','LEGACY'));
  end if;
  if not exists (select 1 from pg_constraint where conname='calls_sfa_recovery_status_check') then
    alter table public.calls add constraint calls_sfa_recovery_status_check
      check (sfa_recovery_status is null or sfa_recovery_status in ('EXACT_CAPTURED','AUTO_RECOVERED','MANUAL_CONFIRMED','UNRESOLVED'));
  end if;
  if not exists (select 1 from pg_constraint where conname='calls_sfa_exact_code_check') then
    alter table public.calls add constraint calls_sfa_exact_code_check
      check (sfa_reason_exact_code is null or sfa_reason_exact_code in (
        'sfa_owner_absent','sfa_call_later','sfa_stock_available','sfa_no_cash',
        'sfa_store_closed','sfa_other_supplier','sfa_other'
      ));
  end if;
end $$;

-- Preserve historical editor/audit metadata during the one-time live-row backfill.
-- Tombstone and parent-integrity guards intentionally stay ENABLED.
do $$
begin
  if exists (select 1 from pg_trigger where tgname='trg_calls_touch' and not tgisinternal) then
    execute 'alter table public.calls disable trigger trg_calls_touch';
  end if;
  if exists (select 1 from pg_trigger where tgname='trg_calls_audit' and not tgisinternal) then
    execute 'alter table public.calls disable trigger trg_calls_audit';
  end if;
end $$;

-- LIVE ROW PREDICATE used by every historical call backfill below:
--   coalesce(c.is_deleted,false)=false
--   AND parent Visit exists and is not deleted.
-- This is the regression guard for the Migration-006 failure.

-- 3) Defensive handling for exact-SFA rows written during a deploy cutover.
update public.calls c
set sfa_reason_exact_code = c.sfa_reason_code,
    sfa_capture_type = 'EXACT',
    sfa_recovery_status = 'EXACT_CAPTURED'
where c.result='NON_EC'
  and coalesce(c.is_deleted,false)=false
  and exists (
    select 1 from public.visits v
    where v.id=c.visit_id and coalesce(v.is_deleted,false)=false
  )
  and c.sfa_reason_code in (
    'sfa_owner_absent','sfa_call_later','sfa_stock_available','sfa_no_cash',
    'sfa_store_closed','sfa_other_supplier','sfa_other'
  )
  and (c.sfa_capture_type is null or c.sfa_reason_exact_code is null);

-- 4) Existing live NON_EC rows are legacy unless already identified as exact.
update public.calls c
set sfa_capture_type = coalesce(c.sfa_capture_type,'LEGACY'),
    sfa_recovery_status = coalesce(c.sfa_recovery_status,'UNRESOLVED')
where c.result='NON_EC'
  and coalesce(c.is_deleted,false)=false
  and exists (
    select 1 from public.visits v
    where v.id=c.visit_id and coalesce(v.is_deleted,false)=false
  )
  and c.sfa_capture_type is null;

-- 5) Conservative one-to-one recovery for live legacy rows only.
-- PIC, Lainnya, Tidak Jelas, Harga, Belum Butuh/Menolak, Kendala Produk and Kompetitor
-- remain unresolved because their historical exact SFA option cannot be proven from
-- the old interpreted category alone.
update public.calls c
set sfa_reason_exact_code = case c.sfa_reason_code
      when 'stock' then 'sfa_stock_available'
      when 'financial' then 'sfa_no_cash'
      when 'closed' then 'sfa_store_closed'
      else c.sfa_reason_exact_code
    end,
    sfa_recovery_status = case
      when c.sfa_reason_code in ('stock','financial','closed') then 'AUTO_RECOVERED'
      else c.sfa_recovery_status
    end
where c.result='NON_EC'
  and coalesce(c.is_deleted,false)=false
  and exists (
    select 1 from public.visits v
    where v.id=c.visit_id and coalesce(v.is_deleted,false)=false
  )
  and c.sfa_capture_type='LEGACY'
  and c.sfa_reason_exact_code is null
  and c.sfa_reason_code in ('stock','financial','closed');

do $$
begin
  if exists (select 1 from pg_trigger where tgname='trg_calls_touch' and not tgisinternal) then
    execute 'alter table public.calls enable trigger trg_calls_touch';
  end if;
  if exists (select 1 from pg_trigger where tgname='trg_calls_audit' and not tgisinternal) then
    execute 'alter table public.calls enable trigger trg_calls_audit';
  end if;
end $$;

create index if not exists idx_calls_sfa_exact on public.calls(sfa_reason_exact_code, call_timestamp desc);
create index if not exists idx_calls_sfa_recovery on public.calls(sfa_recovery_status, call_timestamp desc);

-- 6) Runtime provenance normalizer.
-- Deleted rows are returned untouched. The v0.3.8 tombstone guard remains the authority
-- for whether a user is allowed to modify/delete/restore a row.
create or replace function public.normalize_sfa_provenance_v039()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if coalesce(new.is_deleted,false)=true then
    return new;
  end if;

  if new.result <> 'NON_EC' then
    return new;
  end if;

  if new.sfa_reason_code in (
    'sfa_owner_absent','sfa_call_later','sfa_stock_available','sfa_no_cash',
    'sfa_store_closed','sfa_other_supplier','sfa_other'
  ) then
    new.sfa_reason_exact_code := coalesce(new.sfa_reason_exact_code,new.sfa_reason_code);
    new.sfa_capture_type := coalesce(new.sfa_capture_type,'EXACT');
    new.sfa_recovery_status := coalesce(new.sfa_recovery_status,'EXACT_CAPTURED');
    return new;
  end if;

  new.sfa_capture_type := coalesce(new.sfa_capture_type,'LEGACY');
  if new.sfa_reason_exact_code is null then
    if new.sfa_reason_code='stock' then
      new.sfa_reason_exact_code := 'sfa_stock_available';
      new.sfa_recovery_status := coalesce(new.sfa_recovery_status,'AUTO_RECOVERED');
    elsif new.sfa_reason_code='financial' then
      new.sfa_reason_exact_code := 'sfa_no_cash';
      new.sfa_recovery_status := coalesce(new.sfa_recovery_status,'AUTO_RECOVERED');
    elsif new.sfa_reason_code='closed' then
      new.sfa_reason_exact_code := 'sfa_store_closed';
      new.sfa_recovery_status := coalesce(new.sfa_recovery_status,'AUTO_RECOVERED');
    else
      new.sfa_recovery_status := coalesce(new.sfa_recovery_status,'UNRESOLVED');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_calls_sfa_provenance_v039 on public.calls;
create trigger trg_calls_sfa_provenance_v039
before insert or update on public.calls
for each row execute function public.normalize_sfa_provenance_v039();

commit;
