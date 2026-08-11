-- Field Visit Intelligence v0.3.7
-- Add mandatory-in-app call check-in / checkout timestamps and geolocation fields.
-- Existing historical rows remain valid with NULL values.

begin;

alter table public.calls
  add column if not exists checkin_at timestamptz,
  add column if not exists checkout_at timestamptz,
  add column if not exists checkin_latitude double precision,
  add column if not exists checkin_longitude double precision,
  add column if not exists checkin_accuracy_m double precision,
  add column if not exists checkout_latitude double precision,
  add column if not exists checkout_longitude double precision,
  add column if not exists checkout_accuracy_m double precision,
  add column if not exists duration_seconds integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'calls_checkin_latitude_range'
  ) then
    alter table public.calls add constraint calls_checkin_latitude_range
      check (checkin_latitude is null or checkin_latitude between -90 and 90);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'calls_checkin_longitude_range'
  ) then
    alter table public.calls add constraint calls_checkin_longitude_range
      check (checkin_longitude is null or checkin_longitude between -180 and 180);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'calls_checkout_latitude_range'
  ) then
    alter table public.calls add constraint calls_checkout_latitude_range
      check (checkout_latitude is null or checkout_latitude between -90 and 90);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'calls_checkout_longitude_range'
  ) then
    alter table public.calls add constraint calls_checkout_longitude_range
      check (checkout_longitude is null or checkout_longitude between -180 and 180);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'calls_checkin_accuracy_nonnegative'
  ) then
    alter table public.calls add constraint calls_checkin_accuracy_nonnegative
      check (checkin_accuracy_m is null or checkin_accuracy_m >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'calls_checkout_accuracy_nonnegative'
  ) then
    alter table public.calls add constraint calls_checkout_accuracy_nonnegative
      check (checkout_accuracy_m is null or checkout_accuracy_m >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'calls_duration_nonnegative'
  ) then
    alter table public.calls add constraint calls_duration_nonnegative
      check (duration_seconds is null or duration_seconds >= 0);
  end if;
end $$;

create index if not exists idx_calls_checkin_at on public.calls(checkin_at desc);

commit;
