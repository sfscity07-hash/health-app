-- Recipes: a food made from other foods (a marinade, a curry, a taco).
-- The recipe itself is a row in `foods` (so it logs, searches and favorites
-- like any food); these tables hold how it's made. Safe to run more than once.

create table if not exists public.recipes (
  food_id uuid primary key references public.foods (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The finished weight, if you weighed it after cooking (otherwise the ingredients add up).
  final_weight_g numeric(8, 1) check (final_weight_g > 0 and final_weight_g <= 100000),
  servings numeric(6, 2) check (servings > 0 and servings <= 1000),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (food_id) on delete cascade,
  position smallint not null default 0,
  -- The food it came from (null for a quick ingredient, or if that food was deleted).
  food_id uuid references public.foods (id) on delete set null,
  name text not null check (char_length(name) between 1 and 200),
  quantity numeric(9, 2) not null check (quantity > 0),
  unit text not null check (char_length(unit) between 1 and 40),
  grams numeric(8, 1) check (grams > 0),
  -- What this ingredient adds, as made: kept so the recipe still adds up if the food changes or goes.
  kcal numeric(8, 1) not null check (kcal between 0 and 100000),
  protein_g numeric(7, 1) not null default 0 check (protein_g >= 0),
  carbs_g numeric(7, 1) not null default 0 check (carbs_g >= 0),
  fat_g numeric(7, 1) not null default 0 check (fat_g >= 0),
  fiber_g numeric(7, 1) check (fiber_g >= 0)
);

create index if not exists recipe_items_recipe_idx on public.recipe_items (recipe_id, position);

drop trigger if exists recipes_updated_at on public.recipes;
create trigger recipes_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();

alter table public.recipes enable row level security;
alter table public.recipe_items enable row level security;

drop policy if exists "Own rows only" on public.recipes;
create policy "Own rows only" on public.recipes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "Own rows only" on public.recipe_items;
create policy "Own rows only" on public.recipe_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- A recipe is one of your foods; its ingredients point at your recipe and your foods.
drop policy if exists "Recipes are own foods" on public.recipes;
create policy "Recipes are own foods" on public.recipes
  as restrictive for all to authenticated
  using (true)
  with check (exists (select 1 from public.foods f where f.id = food_id and f.user_id = (select auth.uid())));
drop policy if exists "Recipe items reference own recipes and foods" on public.recipe_items;
create policy "Recipe items reference own recipes and foods" on public.recipe_items
  as restrictive for all to authenticated
  using (true)
  with check (
    exists (select 1 from public.recipes r where r.food_id = recipe_id and r.user_id = (select auth.uid()))
    and (food_id is null or exists (select 1 from public.foods f where f.id = food_id and f.user_id = (select auth.uid())))
  );

revoke all on public.recipes, public.recipe_items from anon;
grant select, insert, update, delete on public.recipes, public.recipe_items to authenticated;
