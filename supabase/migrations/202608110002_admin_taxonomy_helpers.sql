-- v0.3.0 helper RPC for admin taxonomy discovery counts.
-- This is optional for the frontend; raw export remains the analytical source of truth.

create or replace function public.normalize_reason_text(input_text text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(btrim(coalesce(input_text,'')), '\\s+', ' ', 'g'));
$$;
