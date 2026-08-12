-- Field Visit Intelligence v0.3.9
-- Exact E-Work/SFA taxonomy + additive legacy recovery provenance.
-- Existing Call IDs, Visit IDs, GPS, timestamps, actual reason, evidence and legacy SFA fields are preserved.

begin;

-- 1) Separate the observational taxonomy from the exact SFA/E-Work taxonomy.
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

comment on column public.calls.sfa_reason_exact_code is 'Exact SFA/E-Work reason code introduced in v0.3.9. Legacy sfa_reason_code remains preserved.';
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

-- Preserve historical editor/audit metadata during the one-time backfill.
-- Runtime edits after migration continue to use the existing touch/audit triggers.
do $$
begin
  if exists (select 1 from pg_trigger where tgname='trg_calls_touch' and not tgisinternal) then
    execute 'alter table public.calls disable trigger trg_calls_touch';
  end if;
  if exists (select 1 from pg_trigger where tgname='trg_calls_audit' and not tgisinternal) then
    execute 'alter table public.calls disable trigger trg_calls_audit';
  end if;
end $$;

-- 3) Defensive handling for any exact-SFA rows created during the migration/deploy cutover.
update public.calls
set sfa_reason_exact_code = sfa_reason_code,
    sfa_capture_type = 'EXACT',
    sfa_recovery_status = 'EXACT_CAPTURED'
where result='NON_EC'
  and sfa_reason_code in (
    'sfa_owner_absent','sfa_call_later','sfa_stock_available','sfa_no_cash',
    'sfa_store_closed','sfa_other_supplier','sfa_other'
  )
  and (sfa_capture_type is null or sfa_reason_exact_code is null);

-- 4) Existing non-EC rows are legacy unless already identified as exact.
update public.calls
set sfa_capture_type = coalesce(sfa_capture_type,'LEGACY'),
    sfa_recovery_status = coalesce(sfa_recovery_status,'UNRESOLVED')
where result='NON_EC'
  and sfa_capture_type is null;

-- 5) Conservative auto-recovery only for one-to-one legacy categories.
-- PIC, Lainnya, Tidak Jelas, Harga, Belum Butuh/Menolak, Kendala Produk and Kompetitor
-- stay unresolved because their exact historical SFA choice cannot be proven from the legacy category alone.
update public.calls
set sfa_reason_exact_code = case sfa_reason_code
      when 'stock' then 'sfa_stock_available'
      when 'financial' then 'sfa_no_cash'
      when 'closed' then 'sfa_store_closed'
      else sfa_reason_exact_code
    end,
    sfa_recovery_status = case
      when sfa_reason_code in ('stock','financial','closed') then 'AUTO_RECOVERED'
      else sfa_recovery_status
    end
where result='NON_EC'
  and sfa_capture_type='LEGACY'
  and sfa_reason_exact_code is null
  and sfa_reason_code in ('stock','financial','closed');

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

-- 6) Cutover guard: if an older frontend writes an exact SFA code after this migration,
-- populate the v0.3.9 provenance fields automatically. Legacy writes remain legacy.
create or replace function public.normalize_sfa_provenance_v039()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
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
