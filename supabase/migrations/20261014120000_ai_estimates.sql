-- AI estimates: Claude fills in vitamins, minerals and caffeine that a food's
-- label and USDA don't give, marked AI in the app. The Claude key lives only
-- in the estimate-nutrients Edge Function's secrets. This file keeps a log of
-- AI calls and the daily limits, so a stranger with the app (or the public
-- repo's publishable key) can't run up your Claude bill. Safe to run more than once.

-- Your switch for it (on unless you turn it off in Profile).
alter table public.profiles
  add column if not exists ai_estimates boolean not null default true;

-- One row per Claude call. You can see your own; only the Edge Function
-- (with the service role) writes them, so the limit can't be dodged.
create table if not exists public.ai_calls (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  kind text not null check (char_length(kind) between 1 and 40),
  food_id uuid references public.foods (id) on delete set null,
  model text check (char_length(model) <= 60),
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0)
);

create index if not exists ai_calls_user_time_idx on public.ai_calls (user_id, created_at);
create index if not exists ai_calls_time_idx on public.ai_calls (created_at);

alter table public.ai_calls enable row level security;
drop policy if exists "Read own AI calls" on public.ai_calls;
create policy "Read own AI calls" on public.ai_calls for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.ai_calls from anon, authenticated;
grant select on public.ai_calls to authenticated;
grant select, insert, update on public.ai_calls to service_role;

-- Takes one AI call from the day's allowance: false when this user, or
-- everyone together, has used the last 24 hours' share. Locked so two calls
-- at once can't both squeeze past the limit. Returns the new row's id, or null.
create or replace function public.take_ai_call(
  for_user uuid,
  call_kind text,
  call_food uuid,
  per_user integer,
  total integer
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  mine integer;
  everyone integer;
  new_id bigint;
begin
  perform pg_advisory_xact_lock(hashtext('public.ai_calls'));
  select count(*) into mine from public.ai_calls
    where user_id = for_user and created_at > now() - interval '1 day';
  select count(*) into everyone from public.ai_calls
    where created_at > now() - interval '1 day';
  if mine >= per_user or everyone >= total then
    return null;
  end if;
  insert into public.ai_calls (user_id, kind, food_id) values (for_user, call_kind, call_food)
    returning id into new_id;
  return new_id;
end;
$$;

-- Only the Edge Function may take from the allowance.
revoke all on function public.take_ai_call(uuid, text, uuid, integer, integer) from public;
revoke all on function public.take_ai_call(uuid, text, uuid, integer, integer) from anon;
revoke all on function public.take_ai_call(uuid, text, uuid, integer, integer) from authenticated;
grant execute on function public.take_ai_call(uuid, text, uuid, integer, integer) to service_role;
