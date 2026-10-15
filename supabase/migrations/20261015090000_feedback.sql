-- Feedback and bug reports sent from inside the app.
-- Everyone can send feedback and see what they sent; accounts listed in
-- feedback_readers (added by you in the SQL Editor) can read everyone's.
-- Safe to run again.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Filled in by the database from the sender's account, never by the app.
  email text,
  kind text not null default 'bug' check (kind in ('bug', 'idea', 'other')),
  message text not null check (char_length(btrim(message)) between 1 and 4000),
  -- Where it was sent from and on what, so a bug can be reproduced.
  screen text check (char_length(screen) <= 60),
  app_version text check (char_length(app_version) <= 120),
  device text check (char_length(device) <= 200),
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_at_idx on public.feedback (created_at desc);
create index if not exists feedback_user_idx on public.feedback (user_id, created_at desc);

-- Who can read everyone's feedback. No policies: only the SQL Editor (or the
-- dashboard) can add or remove someone, never the app.
create table if not exists public.feedback_readers (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.feedback_readers enable row level security;
revoke all on public.feedback_readers from anon, authenticated;

create or replace function public.can_read_all_feedback()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.feedback_readers where user_id = auth.uid());
$$;

revoke all on function public.can_read_all_feedback() from public;
revoke all on function public.can_read_all_feedback() from anon;
grant execute on function public.can_read_all_feedback() to authenticated;

-- Stamps every message with its sender (whatever the app sent), and keeps it
-- to 20 a day per account so nobody can flood it.
create or replace function public.feedback_stamp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.user_id := auth.uid();
  if new.user_id is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  new.email := (select u.email from auth.users u where u.id = new.user_id);
  new.created_at := now();
  if (select count(*) from public.feedback f
      where f.user_id = new.user_id and f.created_at > now() - interval '1 day') >= 20 then
    raise exception 'feedback_limit: 20 messages a day' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.feedback_stamp() from public;

drop trigger if exists feedback_stamp on public.feedback;
create trigger feedback_stamp
  before insert on public.feedback
  for each row execute function public.feedback_stamp();

alter table public.feedback enable row level security;

drop policy if exists "Send feedback" on public.feedback;
create policy "Send feedback" on public.feedback
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Read your feedback, or everyone's if you're a reader" on public.feedback;
create policy "Read your feedback, or everyone's if you're a reader" on public.feedback
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.can_read_all_feedback()));

-- Sending and reading only: nobody changes or deletes feedback from the app.
revoke all on public.feedback from anon, authenticated;
grant select, insert on public.feedback to authenticated;
