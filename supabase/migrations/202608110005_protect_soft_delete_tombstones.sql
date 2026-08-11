-- Field Visit Intelligence v0.3.8
-- Protect Admin soft-delete tombstones from stale JOVIS/device updates.

begin;

create or replace function public.guard_soft_delete_tombstone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Admin controls deletion state. A JOVIS may edit their live rows, but may not
  -- delete/restore a row or modify a row that has already been soft-deleted.
  if not public.is_admin() then
    if old.is_deleted = true then
      raise exception using
        errcode = '42501',
        message = 'This record was deleted by Admin and is no longer editable.';
    end if;

    if new.is_deleted is distinct from old.is_deleted then
      raise exception using
        errcode = '42501',
        message = 'Only Admin may change soft-delete state.';
    end if;
  end if;

  if new.is_deleted = true and new.deleted_at is null then
    new.deleted_at = now();
  end if;

  if new.is_deleted = false then
    new.deleted_at = null;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_soft_delete_tombstone() from public;
grant execute on function public.guard_soft_delete_tombstone() to authenticated;

drop trigger if exists trg_guard_visits_soft_delete on public.visits;
create trigger trg_guard_visits_soft_delete
before update on public.visits
for each row
execute function public.guard_soft_delete_tombstone();

drop trigger if exists trg_guard_calls_soft_delete on public.calls;
create trigger trg_guard_calls_soft_delete
before update on public.calls
for each row
execute function public.guard_soft_delete_tombstone();

-- Enforce that every Call belongs to the same JOVIS as its parent Visit and
-- prevent stale/offline clients from adding active calls to a deleted Visit.
create or replace function public.guard_call_visit_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_jovis uuid;
  parent_deleted boolean;
begin
  select v.jovis_user_id, v.is_deleted
    into parent_jovis, parent_deleted
  from public.visits v
  where v.id = new.visit_id;

  if parent_jovis is null then
    raise exception using
      errcode = '23503',
      message = 'Parent visit does not exist.';
  end if;

  if new.jovis_user_id is distinct from parent_jovis then
    raise exception using
      errcode = '42501',
      message = 'Call owner must match parent visit owner.';
  end if;

  if parent_deleted = true and new.is_deleted <> true then
    raise exception using
      errcode = '42501',
      message = 'Cannot add or restore an active call under a deleted visit.';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_call_visit_integrity() from public;
grant execute on function public.guard_call_visit_integrity() to authenticated;

drop trigger if exists trg_guard_calls_visit_integrity on public.calls;
create trigger trg_guard_calls_visit_integrity
before insert or update on public.calls
for each row
execute function public.guard_call_visit_integrity();

commit;
