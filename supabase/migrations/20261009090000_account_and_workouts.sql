-- Phase 12: delete your account from inside the app, and the details behind
-- smarter workout calories. Safe to run more than once.

-- What a workout's calories were worked out from, so editing it later starts
-- where you left off. All optional.
alter table public.exercise_logs
  add column if not exists speed_kmh numeric(4, 1) check (speed_kmh between 0.5 and 40),
  add column if not exists incline_pct numeric(4, 1) check (incline_pct between -20 and 40),
  add column if not exists effort text check (effort in ('easy', 'moderate', 'hard')),
  add column if not exists avg_hr smallint check (avg_hr between 40 and 230);

-- Deletes the signed-in user. Every table's rows go with it (on delete cascade),
-- so nothing of yours is left behind. It can only ever delete the caller.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;
