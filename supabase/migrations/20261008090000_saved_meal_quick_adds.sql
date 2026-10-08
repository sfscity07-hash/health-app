-- Saved meals can include quick adds (calories and macros with no food behind
-- them), so each item can carry its own name and numbers. Safe to run more than once.
alter table public.saved_meal_items alter column food_id drop not null;
alter table public.saved_meal_items
  add column if not exists name text check (char_length(name) between 1 and 200),
  add column if not exists kcal numeric(7, 1) check (kcal between 0 and 20000),
  add column if not exists protein_g numeric(6, 1) check (protein_g >= 0),
  add column if not exists carbs_g numeric(6, 1) check (carbs_g >= 0),
  add column if not exists fat_g numeric(6, 1) check (fat_g >= 0),
  add column if not exists fiber_g numeric(6, 1) check (fiber_g >= 0);

-- An item is either a food (with an amount) or a quick add (with a name and calories).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'saved_meal_items_food_or_numbers') then
    alter table public.saved_meal_items
      add constraint saved_meal_items_food_or_numbers check (food_id is not null or (name is not null and kcal is not null));
  end if;
end;
$$;

-- Items still have to point at your own meal, and at your own food when there is one.
drop policy if exists "Meal items reference own meals and foods" on public.saved_meal_items;
create policy "Meal items reference own meals and foods" on public.saved_meal_items
  as restrictive for all to authenticated
  using (true)
  with check (
    exists (select 1 from public.saved_meals m where m.id = saved_meal_id and m.user_id = (select auth.uid()))
    and (food_id is null or exists (select 1 from public.foods f where f.id = food_id and f.user_id = (select auth.uid())))
  );
