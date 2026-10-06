-- Minimal stand-in for the parts of Supabase that the migrations rely on,
-- so they can be tested on a plain local Postgres (see scripts/verify-db.sh).
-- Never run this against a real Supabase project.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique
);

-- Supabase reads the user id from the request's JWT; tests set it with
-- `set local request.jwt.claim.sub = '<uuid>'`.
create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;
