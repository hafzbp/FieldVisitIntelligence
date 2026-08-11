-- Field Visit Intelligence v0.3.2
-- Fix update triggers: profiles has no last_edited_by column.

begin;

-- Tables such as profiles only require updated_at.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Visits and calls additionally track the authenticated editor.
create or replace function public.touch_updated_at_with_editor()
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

-- profiles: updated_at only
drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch
before update on public.profiles
for each row
execute function public.touch_updated_at();

-- visits: updated_at + editor
drop trigger if exists trg_visits_touch on public.visits;
create trigger trg_visits_touch
before update on public.visits
for each row
execute function public.touch_updated_at_with_editor();

-- calls: updated_at + editor
drop trigger if exists trg_calls_touch on public.calls;
create trigger trg_calls_touch
before update on public.calls
for each row
execute function public.touch_updated_at_with_editor();

commit;
