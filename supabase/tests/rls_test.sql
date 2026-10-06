-- Checks that the schema works and that every user only sees their own data.
-- Run by scripts/verify-db.sh after the migrations. Any failed check raises
-- an exception and stops the run.
\set ON_ERROR_STOP on

-- Two accounts. The sign-up trigger should create a profile for each.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

do $$
begin
  assert (select count(*) from public.profiles) = 2, 'a profile is created for every new user';
  assert (select count(*) from public.exercises) >= 25, 'the exercise catalog is loaded';
end $$;

-- ---------------------------------------------------------------- user A
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';

update public.profiles set calorie_target = 1950, protein_g = 160, carbs_g = 181, fat_g = 65, goal = 'recomp';

insert into public.foods (id, source, external_id, name, kcal_100g, protein_100g, fat_100g, default_serving_g)
values ('10000000-0000-0000-0000-000000000001', 'usda', '175168', 'Salmon, Atlantic, cooked', 206, 22.1, 12.4, 150);

insert into public.food_servings (food_id, label, grams)
values ('10000000-0000-0000-0000-000000000001', '1 fillet', 150);

insert into public.food_logs (log_date, meal, food_id, name, quantity, unit, grams, kcal, protein_g, carbs_g, fat_g) values
  ('2026-10-06', 'breakfast', null, 'Greek yogurt, 0%', 200, 'g', 200, 118, 20.6, 7.2, 0.8),
  ('2026-10-06', 'dinner', '10000000-0000-0000-0000-000000000001', 'Salmon, Atlantic, cooked', 1, 'fillet', 150, 309, 33.2, 0, 18.6);

insert into public.water_logs (log_date, amount_ml) values ('2026-10-06', 250), ('2026-10-06', 500);
insert into public.exercise_logs (log_date, exercise_id, name, duration_min, kcal_burned)
values ('2026-10-06', (select id from public.exercises where name like 'Walking, brisk%'), 'Walking, brisk', 45, 180);
insert into public.weight_logs (log_date, weight_kg) values ('2026-10-06', 82.9);
insert into public.day_closures (log_date) values ('2026-10-06');
insert into public.favorites (food_id) values ('10000000-0000-0000-0000-000000000001');

do $$
declare
  s record;
begin
  select * into s from public.daily_summary where log_date = '2026-10-06';
  assert s.kcal_in = 427, format('daily kcal_in should be 427, got %s', s.kcal_in);
  assert s.protein_g = 53.8, format('daily protein should be 53.8, got %s', s.protein_g);
  assert s.food_entries = 2, 'two food entries';
  assert s.kcal_out = 180, 'exercise kcal';
  assert s.water_ml = 750, 'water total';
  assert s.closed, 'day is closed';
  assert (select calorie_target from public.profiles) = 1950, 'own profile is updatable';
  assert (select goal from public.profiles) = 'recomp', 'the recomp goal can be saved';
end $$;

-- A user cannot write rows for someone else.
do $$
begin
  begin
    insert into public.food_logs (user_id, log_date, meal, name, quantity, unit, kcal)
    values ('00000000-0000-0000-0000-00000000000b', '2026-10-06', 'lunch', 'Sneaky', 1, 'g', 1);
    raise exception 'inserted a food log for another user';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.exercises (name, category, met) values ('Made up', 'Test', 1);
    raise exception 'wrote to the shared exercise catalog';
  exception when insufficient_privilege then null;
  end;
end $$;
commit;

-- ---------------------------------------------------------------- user B
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';

do $$
begin
  assert (select count(*) from public.profiles) = 1, 'B sees only their own profile';
  assert (select count(*) from public.foods) = 0, 'B cannot see A''s foods';
  assert (select count(*) from public.food_servings) = 0, 'B cannot see A''s servings';
  assert (select count(*) from public.food_logs) = 0, 'B cannot see A''s food logs';
  assert (select count(*) from public.water_logs) = 0, 'B cannot see A''s water';
  assert (select count(*) from public.weight_logs) = 0, 'B cannot see A''s weight';
  assert (select count(*) from public.favorites) = 0, 'B cannot see A''s favorites';
  assert (select count(*) from public.day_closures) = 0, 'B cannot see A''s closed days';
  assert (select count(*) from public.daily_summary) = 0, 'B cannot see A''s daily summary';
  assert (select count(*) from public.exercises) >= 25, 'B can read the exercise catalog';
end $$;

-- B cannot change or delete A's rows (they are invisible, so nothing is affected).
update public.food_logs set kcal = 0;
delete from public.weight_logs;

-- B cannot log a food that belongs to A, even knowing its id.
do $$
begin
  begin
    insert into public.food_logs (log_date, meal, food_id, name, quantity, unit, kcal)
    values ('2026-10-06', 'dinner', '10000000-0000-0000-0000-000000000001', 'Salmon', 1, 'fillet', 309);
    raise exception 'logged a food owned by another user';
  exception when insufficient_privilege then null;
  end;
end $$;
commit;

-- ---------------------------------------------------------------- anonymous
begin;
set local role anon;
do $$
begin
  begin
    perform 1 from public.food_logs;
    raise exception 'anonymous users can read food logs';
  exception when insufficient_privilege then null;
  end;
end $$;
commit;

-- A's data survived B's attempts.
do $$
begin
  assert (select sum(kcal) from public.food_logs) = 427, 'A''s food logs are untouched';
  assert (select count(*) from public.weight_logs) = 1, 'A''s weight log is untouched';
end $$;

-- Deleting an account removes all of its data.
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
do $$
begin
  assert (select count(*) from public.food_logs) = 0, 'food logs are removed with the account';
  assert (select count(*) from public.foods) = 0, 'foods are removed with the account';
  assert (select count(*) from public.profiles) = 1, 'only B''s profile remains';
end $$;

\echo 'All database checks passed.'
