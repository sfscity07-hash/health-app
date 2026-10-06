-- Fuel: initial schema.
-- Every user-owned table carries user_id and a row-level security policy that
-- limits reads and writes to the signed-in user (auth.uid()).

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.meal_type as enum ('breakfast', 'lunch', 'dinner', 'snack');
create type public.food_source as enum ('custom', 'usda', 'off');
create type public.sex_type as enum ('female', 'male');
create type public.goal_type as enum ('lose', 'maintain', 'gain');
create type public.activity_level as enum ('sedentary', 'light', 'moderate', 'active', 'very_active');
create type public.unit_system as enum ('metric', 'imperial');
create type public.checkin_decision as enum ('accepted', 'adjusted', 'kept');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles: one row per account, created automatically on sign-up.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  sex public.sex_type,
  birth_date date check (birth_date > date '1900-01-01'),
  height_cm numeric(5, 1) check (height_cm between 50 and 272),
  activity_level public.activity_level,
  goal public.goal_type,
  goal_rate_kg_week numeric(3, 2) check (goal_rate_kg_week between 0 and 1.5),
  goal_weight_kg numeric(5, 1) check (goal_weight_kg between 20 and 400),
  calorie_target integer check (calorie_target between 800 and 6000),
  protein_g integer check (protein_g between 0 and 600),
  carbs_g integer check (carbs_g between 0 and 1000),
  fat_g integer check (fat_g between 0 and 400),
  water_goal_ml integer not null default 2500 check (water_goal_ml between 0 and 10000),
  units public.unit_system not null default 'metric',
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  exercise_addback boolean not null default false,
  reminders jsonb not null default '{}'::jsonb,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Foods: custom foods plus your own cached copies of USDA / Open Food Facts
-- items. Nutrients are per 100 g.
-- ---------------------------------------------------------------------------
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source public.food_source not null,
  external_id text,
  barcode text check (barcode ~ '^[0-9]{6,14}$'),
  name text not null check (char_length(name) between 1 and 200),
  brand text check (char_length(brand) <= 120),
  kcal_100g numeric(7, 2) not null check (kcal_100g between 0 and 1000),
  protein_100g numeric(6, 2) not null default 0 check (protein_100g between 0 and 100),
  carbs_100g numeric(6, 2) not null default 0 check (carbs_100g between 0 and 100),
  fat_100g numeric(6, 2) not null default 0 check (fat_100g between 0 and 100),
  fiber_100g numeric(6, 2) check (fiber_100g between 0 and 100),
  sugar_100g numeric(6, 2) check (sugar_100g between 0 and 100),
  sodium_mg_100g numeric(8, 2) check (sodium_mg_100g between 0 and 100000),
  default_serving_g numeric(7, 2) check (default_serving_g > 0),
  default_serving_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_foods_have_id check (source = 'custom' or external_id is not null)
);

create unique index foods_external_unique on public.foods (user_id, source, external_id)
  where external_id is not null;
create index foods_user_barcode_idx on public.foods (user_id, barcode) where barcode is not null;
create index foods_user_name_idx on public.foods (user_id, lower(name));

create trigger foods_updated_at before update on public.foods
  for each row execute function public.set_updated_at();

-- Named portions for a food, e.g. "1 fillet" = 150 g.
create table public.food_servings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 40),
  grams numeric(7, 2) not null check (grams > 0)
);

create index food_servings_food_idx on public.food_servings (food_id);

-- ---------------------------------------------------------------------------
-- Food log: each entry keeps a copy of the nutrients at the moment it was
-- logged, so editing or deleting a food never changes your history.
-- ---------------------------------------------------------------------------
create table public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date date not null,
  logged_at timestamptz not null default now(),
  meal public.meal_type not null,
  food_id uuid references public.foods (id) on delete set null,
  name text not null check (char_length(name) between 1 and 200),
  brand text,
  quantity numeric(8, 2) not null check (quantity > 0),
  unit text not null check (char_length(unit) between 1 and 40),
  grams numeric(8, 2) check (grams >= 0),
  kcal numeric(7, 1) not null check (kcal between 0 and 20000),
  protein_g numeric(6, 1) not null default 0 check (protein_g >= 0),
  carbs_g numeric(6, 1) not null default 0 check (carbs_g >= 0),
  fat_g numeric(6, 1) not null default 0 check (fat_g >= 0),
  created_at timestamptz not null default now()
);

create index food_logs_user_date_idx on public.food_logs (user_id, log_date);
create index food_logs_user_food_idx on public.food_logs (user_id, food_id);

-- ---------------------------------------------------------------------------
-- Saved meals and favorites
-- ---------------------------------------------------------------------------
create table public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.saved_meal_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  saved_meal_id uuid not null references public.saved_meals (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete cascade,
  quantity numeric(8, 2) not null check (quantity > 0),
  unit text not null,
  grams numeric(8, 2) check (grams >= 0),
  position smallint not null default 0
);

create index saved_meal_items_meal_idx on public.saved_meal_items (saved_meal_id);

create table public.favorites (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, food_id)
);

-- ---------------------------------------------------------------------------
-- Body weight, water, exercise
-- ---------------------------------------------------------------------------
create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date date not null,
  weight_kg numeric(5, 2) not null check (weight_kg between 20 and 400),
  created_at timestamptz not null default now(),
  unique (user_id, log_date)
);

create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date date not null,
  amount_ml integer not null check (amount_ml between 1 and 5000),
  logged_at timestamptz not null default now()
);

create index water_logs_user_date_idx on public.water_logs (user_id, log_date);

-- Reference list of activities with MET values (shared, read-only).
create table public.exercises (
  id smallint generated always as identity primary key,
  name text not null unique,
  category text not null,
  met numeric(4, 1) not null check (met > 0)
);

create table public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date date not null,
  exercise_id smallint references public.exercises (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  duration_min integer check (duration_min between 1 and 1440),
  kcal_burned integer not null check (kcal_burned between 0 and 10000),
  created_at timestamptz not null default now()
);

create index exercise_logs_user_date_idx on public.exercise_logs (user_id, log_date);

-- ---------------------------------------------------------------------------
-- Habit loop: weekly check-ins and "Finish today"
-- ---------------------------------------------------------------------------
create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  days_logged smallint not null check (days_logged between 0 and 7),
  avg_intake_kcal integer,
  trend_change_kg numeric(4, 2),
  expenditure_kcal integer,
  old_target integer not null,
  suggested_target integer not null,
  new_target integer not null,
  decision public.checkin_decision not null,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create table public.day_closures (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date date not null,
  closed_at timestamptz not null default now(),
  primary key (user_id, log_date)
);

-- ---------------------------------------------------------------------------
-- Daily totals for the dashboard and charts. security_invoker makes the view
-- respect the row-level security of the tables underneath it.
-- ---------------------------------------------------------------------------
create view public.daily_summary with (security_invoker = true) as
with days as (
  select user_id, log_date from public.food_logs
  union
  select user_id, log_date from public.water_logs
  union
  select user_id, log_date from public.exercise_logs
  union
  select user_id, log_date from public.day_closures
),
food as (
  select user_id, log_date,
    sum(kcal) as kcal,
    sum(protein_g) as protein_g,
    sum(carbs_g) as carbs_g,
    sum(fat_g) as fat_g,
    count(*) as entries
  from public.food_logs
  group by user_id, log_date
),
exercise as (
  select user_id, log_date, sum(kcal_burned) as kcal
  from public.exercise_logs
  group by user_id, log_date
),
water as (
  select user_id, log_date, sum(amount_ml) as ml
  from public.water_logs
  group by user_id, log_date
)
select
  d.user_id,
  d.log_date,
  coalesce(f.kcal, 0)::numeric(8, 1) as kcal_in,
  coalesce(f.protein_g, 0)::numeric(7, 1) as protein_g,
  coalesce(f.carbs_g, 0)::numeric(7, 1) as carbs_g,
  coalesce(f.fat_g, 0)::numeric(7, 1) as fat_g,
  coalesce(f.entries, 0)::integer as food_entries,
  coalesce(e.kcal, 0)::integer as kcal_out,
  coalesce(w.ml, 0)::integer as water_ml,
  (c.log_date is not null) as closed
from days d
left join food f on f.user_id = d.user_id and f.log_date = d.log_date
left join exercise e on e.user_id = d.user_id and e.log_date = d.log_date
left join water w on w.user_id = d.user_id and w.log_date = d.log_date
left join public.day_closures c on c.user_id = d.user_id and c.log_date = d.log_date;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.foods enable row level security;
alter table public.food_servings enable row level security;
alter table public.food_logs enable row level security;
alter table public.saved_meals enable row level security;
alter table public.saved_meal_items enable row level security;
alter table public.favorites enable row level security;
alter table public.weight_logs enable row level security;
alter table public.water_logs enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_logs enable row level security;
alter table public.checkins enable row level security;
alter table public.day_closures enable row level security;

create policy "Read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "Update own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "Everyone signed in can read exercises" on public.exercises
  for select to authenticated using (true);

do $$
declare
  t text;
begin
  foreach t in array array[
    'foods', 'food_servings', 'food_logs', 'saved_meals', 'saved_meal_items', 'favorites',
    'weight_logs', 'water_logs', 'exercise_logs', 'checkins', 'day_closures'
  ]
  loop
    execute format(
      'create policy "Own rows only" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
  end loop;
end;
$$;

-- Child rows must point at parents you own, on insert and on update.
create policy "Servings reference own foods" on public.food_servings
  as restrictive for all to authenticated
  using (true)
  with check (exists (select 1 from public.foods f where f.id = food_id and f.user_id = (select auth.uid())));
create policy "Meal items reference own meals and foods" on public.saved_meal_items
  as restrictive for all to authenticated
  using (true)
  with check (
    exists (select 1 from public.saved_meals m where m.id = saved_meal_id and m.user_id = (select auth.uid()))
    and exists (select 1 from public.foods f where f.id = food_id and f.user_id = (select auth.uid()))
  );
create policy "Logs reference own foods" on public.food_logs
  as restrictive for all to authenticated
  using (true)
  with check (food_id is null or exists (select 1 from public.foods f where f.id = food_id and f.user_id = (select auth.uid())));
create policy "Favorites reference own foods" on public.favorites
  as restrictive for all to authenticated
  using (true)
  with check (exists (select 1 from public.foods f where f.id = food_id and f.user_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- Privileges: signed-in users go through RLS; anonymous users get nothing.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on public.exercises from authenticated;
revoke insert, delete on public.profiles from authenticated;
grant select on public.daily_summary to authenticated;
