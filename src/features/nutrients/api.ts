import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { useFoodLogs } from '@/features/dashboard/api';
import { foodKeys, numOrNull, toFood } from '@/features/food/api';
import { useDayBudget } from '@/features/food/useDayBudget';
import { fillFoods, needsFill, type FoodUpdate } from '@/features/nutrients/fill';
import { dayNutrients, nutrientTargets, recipeMicros, NO_ESTIMATE } from '@/features/nutrients/micros';
import { useProfile } from '@/features/profile/api';
import { useFoodsByIds, useRecipeIds } from '@/features/recipes/api';
import { ageOn, fromISODate } from '@/lib/dates';
import { usdaApiKey } from '@/lib/env';
import type { FoodRecord } from '@/lib/portion';
import { requireSupabase } from '@/lib/supabase';

const one = <T>(v: unknown): T | null => ((Array.isArray(v) ? v[0] : v) as T | null) ?? null;

/** A recipe saved before nutrients were kept: add them up from its ingredients (looking those up first, unless that's just been done). */
async function fillRecipe(id: string, done: ReadonlyMap<string, FoodUpdate>): Promise<FoodUpdate[]> {
  const { data, error } = await requireSupabase()
    .from('recipes')
    .select('final_weight_g, recipe_items(name, grams, food_id, foods(*))')
    .eq('food_id', id)
    .single();
  if (error) throw error;
  const rows = (data.recipe_items ?? []) as unknown as Record<string, unknown>[];
  const ingredients = rows.flatMap((r) => {
    const f = one<Record<string, unknown>>(r.foods);
    return f ? [toFood(f)] : [];
  });
  const updates = await fillFoods(
    ingredients.filter((f) => needsFill(f) && !done.has(f.id)),
    usdaApiKey,
  );
  const byId = new Map(ingredients.map((f) => [f.id, { ...f, ...done.get(f.id), ...updates.find((u) => u.id === f.id) }]));
  const parts = rows.map((r) => ({ name: r.name as string, grams: numOrNull(r.grams), food: r.food_id ? (byId.get(r.food_id as string) ?? null) : null }));
  const weight = numOrNull(data.final_weight_g) ?? parts.reduce((s, p) => s + (p.grams ?? 0), 0);
  const { micros, est } = recipeMicros(parts, weight);
  return [...updates, { id, micros, micros_est: est ?? NO_ESTIMATE }];
}

/** Looks up and estimates nutrients for these foods, saves what it found, and says how many changed. */
async function fillAndSave(foods: FoodRecord[], recipeIds: ReadonlySet<string>): Promise<number> {
  const recipes = foods.filter((f) => recipeIds.has(f.id) && f.micros === null);
  const plain = foods.filter((f) => !recipeIds.has(f.id));
  const updates = await fillFoods(plain, usdaApiKey);
  for (const r of recipes) {
    try {
      updates.push(...(await fillRecipe(r.id, new Map(updates.map((u) => [u.id, u])))));
    } catch {
      // Try again another time.
    }
  }
  const sb = requireSupabase();
  const saved = await Promise.all(
    updates.map(async ({ id, ...change }) => {
      const { error } = await sb.from('foods').update(change).eq('id', id);
      return error ? 0 : 1;
    }),
  );
  return saved.reduce<number>((s, n) => s + n, 0);
}

/**
 * A day's vitamins, minerals, salt and caffeine, from each food you logged
 * and its grams, with targets for you. Foods missing their numbers are looked
 * up (and estimated where that's honest) in the background, once.
 */
export function useDayNutrients(date: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const logs = useFoodLogs(date);
  const recipeIds = useRecipeIds();
  const { data: profile } = useProfile();
  const { targets } = useDayBudget(date);
  const ids = useMemo(() => [...new Set((logs.data ?? []).flatMap((e) => (e.food_id ? [e.food_id] : [])))], [logs.data]);
  const foods = useFoodsByIds(ids);
  // The micronutrients SQL adds `micros` to every food; before it's run there's nothing to show. Null while loading.
  const ready: boolean | null = ids.length === 0 ? (logs.isSuccess ? true : null) : foods.data ? foods.data.some((f) => f.micros !== undefined) : null;
  const toFill = (foods.data ?? []).filter(needsFill);
  const fillKey = toFill.map((f) => f.id).sort().join(',');

  const fill = useQuery({
    queryKey: ['fillNutrients', fillKey],
    enabled: Boolean(session) && ready === true && toFill.length > 0,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const changed = await fillAndSave(toFill, recipeIds);
      if (changed > 0) {
        await queryClient.invalidateQueries({ queryKey: ['foodsByIds'] });
        for (const f of toFill) queryClient.invalidateQueries({ queryKey: foodKeys.food(f.id) });
      }
      return changed;
    },
  });

  const day = useMemo(() => {
    const byId = new Map((foods.data ?? []).map((f) => [f.id, f]));
    return dayNutrients((logs.data ?? []).map((e) => ({ id: e.id, name: e.name, grams: e.grams, food: e.food_id ? (byId.get(e.food_id) ?? null) : null })));
  }, [logs.data, foods.data]);

  const age = profile?.birth_date ? ageOn(fromISODate(profile.birth_date), fromISODate(date)) : null;
  const goals = nutrientTargets({ sex: profile?.sex ?? null, age, kcal: targets.kcal || 2000 });

  return {
    day,
    goals,
    entries: (logs.data ?? []).length,
    ready,
    filling: fill.isFetching,
    pending: logs.isPending || (ids.length > 0 && foods.isPending),
    error: logs.error ?? foods.error,
  };
}
