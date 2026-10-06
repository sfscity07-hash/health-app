-- Tracks fibre on everything you log and adds it to the daily totals.
-- (Foods already have fiber_100g.) Safe to run more than once.
alter table public.food_logs
  add column if not exists fiber_g numeric(6, 1) check (fiber_g >= 0);

-- Same view as before, with fibre added as the last column.
create or replace view public.daily_summary with (security_invoker = true) as
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
    count(*) as entries,
    sum(fiber_g) as fiber_g
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
  (c.log_date is not null) as closed,
  coalesce(f.fiber_g, 0)::numeric(7, 1) as fiber_g
from days d
left join food f on f.user_id = d.user_id and f.log_date = d.log_date
left join exercise e on e.user_id = d.user_id and e.log_date = d.log_date
left join water w on w.user_id = d.user_id and w.log_date = d.log_date
left join public.day_closures c on c.user_id = d.user_id and c.log_date = d.log_date;

grant select on public.daily_summary to authenticated;
