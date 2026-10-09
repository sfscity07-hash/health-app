import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { foodKeys, num, numOrNull, toFood, type FoodWithServings } from '@/features/food/api';
import { recipeFood, recipeUnits, type RecipeDraft, type RecipeItem } from '@/features/recipes/logic';
import { ensureFood } from '@/features/search/api';
import { nutrientsFor, WHOLE_BATCH, type FoodRecord } from '@/lib/portion';
import { requireSupabase } from '@/lib/supabase';

export const recipeKeys = { all: ['recipes'] as const, one: (id: string) => ['recipe', id] as const };

export type RecipeSummary = { id: string; food: FoodRecord; finalWeight: number | null; servings: number | null; itemCount: number };

const one = <T>(v: unknown): T | null => ((Array.isArray(v) ? v[0] : v) as T | null) ?? null;

/** Your recipes, A to Z. */
export function useRecipes() {
  const { session } = useAuth();
  return useQuery({
    queryKey: recipeKeys.all,
    enabled: Boolean(session),
    queryFn: async (): Promise<RecipeSummary[]> => {
      const { data, error } = await requireSupabase().from('recipes').select('food_id, final_weight_g, servings, foods(*), recipe_items(count)');
      if (error) throw error;
      return (data ?? [])
        .map((r) => {
          const food = one<Record<string, unknown>>(r.foods);
          const count = one<{ count: number }>(r.recipe_items)?.count ?? 0;
          return food
            ? { id: r.food_id as string, food: toFood(food), finalWeight: numOrNull(r.final_weight_g), servings: numOrNull(r.servings), itemCount: Number(count) }
            : null;
        })
        .filter((r): r is RecipeSummary => r !== null)
        .sort((a, b) => a.food.name.localeCompare(b.food.name));
    },
  });
}

/** Ids of foods that are recipes, for tagging them in lists. Empty if recipes aren't set up yet. */
export function useRecipeIds(): Set<string> {
  const recipes = useRecipes();
  return new Set((recipes.data ?? []).map((r) => r.id));
}

const withServings = (f: Record<string, unknown>): FoodWithServings => ({
  ...toFood(f),
  servings: ((f.food_servings ?? []) as { label: string; grams: unknown }[]).map((s) => ({ label: s.label, grams: num(s.grams) })),
});

/** A saved recipe as an editable draft. Ingredients that are foods use the food's current numbers. */
export function useRecipe(id: string | undefined) {
  const { session } = useAuth();
  return useQuery({
    queryKey: recipeKeys.one(id ?? ''),
    enabled: Boolean(session && id),
    queryFn: async (): Promise<RecipeDraft> => {
      const { data, error } = await requireSupabase()
        .from('recipes')
        .select(
          'food_id, final_weight_g, servings, foods(name), recipe_items(id, position, food_id, name, quantity, unit, grams, kcal, protein_g, carbs_g, fat_g, fiber_g, foods(*, food_servings(label, grams)))',
        )
        .eq('food_id', id as string)
        .single();
      if (error) throw error;
      const rows = ((data.recipe_items ?? []) as unknown as Record<string, unknown>[]).sort((a, b) => num(a.position) - num(b.position));
      const items: RecipeItem[] = rows.map((r) => {
        const joined = one<Record<string, unknown>>(r.foods);
        const food = joined ? withServings(joined) : null;
        const grams = numOrNull(r.grams);
        const stored = { kcal: num(r.kcal), protein_g: num(r.protein_g), carbs_g: num(r.carbs_g), fat_g: num(r.fat_g), fiber_g: num(r.fiber_g) };
        return {
          key: r.id as string,
          food,
          external: null,
          name: food?.name ?? (r.name as string),
          brand: food?.brand ?? null,
          quantity: num(r.quantity),
          unit: r.unit as string,
          grams,
          nutrients: food && grams ? nutrientsFor(food, grams) : stored,
        };
      });
      return {
        id: data.food_id as string,
        name: one<{ name: string }>(data.foods)?.name ?? '',
        items,
        finalWeight: numOrNull(data.final_weight_g),
        servings: numOrNull(data.servings),
      };
    },
  });
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Saves a recipe (new or changed) and returns its food id. Database foods used in it are saved to your foods first. */
export function useSaveRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (d: RecipeDraft): Promise<string> => {
      const sb = requireSupabase();
      // Ingredients picked from USDA / Open Food Facts become your foods, so the recipe can point at them.
      const foodIds = await Promise.all(d.items.map(async (i) => (i.external ? ensureFood(i.external) : (i.food?.id ?? null))));

      const foodRow = recipeFood(d);
      let id = d.id;
      let created = false;
      if (id) {
        const { error } = await sb.from('foods').update(foodRow).eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await sb.from('foods').insert({ source: 'custom', ...foodRow }).select('id').single();
        if (error) throw error;
        id = data.id as string;
        created = true;
      }
      const recipeId = id as string;

      try {
        const saved = await sb
          .from('recipes')
          .upsert({ food_id: recipeId, final_weight_g: d.finalWeight !== null ? r1(d.finalWeight) : null, servings: d.servings }, { onConflict: 'food_id' });
        if (saved.error) throw saved.error;

        const cleared = await sb.from('recipe_items').delete().eq('recipe_id', recipeId);
        if (cleared.error) throw cleared.error;
        const items = await sb.from('recipe_items').insert(
          d.items.map((i, position) => ({
            recipe_id: recipeId,
            position,
            food_id: foodIds[position],
            name: i.name.slice(0, 200),
            quantity: Math.round(i.quantity * 100) / 100,
            unit: i.unit.slice(0, 40),
            grams: i.grams ? r1(i.grams) : null,
            kcal: r1(i.nutrients.kcal),
            protein_g: r1(i.nutrients.protein_g),
            carbs_g: r1(i.nutrients.carbs_g),
            fat_g: r1(i.nutrients.fat_g),
            fiber_g: r1(i.nutrients.fiber_g),
          })),
        );
        if (items.error) throw items.error;

        // Keep the "whole batch" unit in step with the finished weight.
        await sb.from('food_servings').delete().eq('food_id', recipeId).eq('label', WHOLE_BATCH);
        const units = recipeUnits(d);
        if (units.length) {
          const added = await sb.from('food_servings').insert(units.map((u) => ({ food_id: recipeId, label: u.label, grams: u.grams })));
          if (added.error) throw added.error;
        }
      } catch (e) {
        // Don't leave a half-made new recipe behind.
        if (created) await sb.from('foods').delete().eq('id', recipeId);
        throw e;
      }
      return recipeId;
    },
    onSuccess: (id, d) => {
      // The recipe opens straight away to log, so seed it rather than wait for a fetch.
      queryClient.setQueryData<FoodWithServings>(foodKeys.food(id), (old) => ({
        id,
        source: 'custom',
        brand: null,
        barcode: null,
        ...recipeFood(d),
        servings: [...(old?.servings ?? []).filter((s) => s.label !== WHOLE_BATCH), ...recipeUnits(d)],
      }));
      queryClient.invalidateQueries({ queryKey: recipeKeys.all });
      queryClient.invalidateQueries({ queryKey: recipeKeys.one(id) });
      queryClient.invalidateQueries({ queryKey: foodKeys.food(id) });
      queryClient.invalidateQueries({ queryKey: foodKeys.myFoods });
    },
  });
}

/** Deletes a recipe. What you already logged keeps its numbers. */
export function useDeleteRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await requireSupabase().from('foods').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: ({ id }) => queryClient.setQueryData<RecipeSummary[]>(recipeKeys.all, (old) => old?.filter((r) => r.id !== id)),
    onSettled: (_data, _error, { id }) => {
      queryClient.removeQueries({ queryKey: foodKeys.food(id) });
      queryClient.invalidateQueries({ queryKey: recipeKeys.all });
      queryClient.invalidateQueries({ queryKey: foodKeys.myFoods });
      queryClient.invalidateQueries({ queryKey: foodKeys.recentLogs });
    },
  });
}

/** Foods by id (for the ingredient picker's Recent list), keeping the order given. */
export function useFoodsByIds(ids: string[]) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['foodsByIds', ids.join(',')],
    enabled: Boolean(session) && ids.length > 0,
    queryFn: async (): Promise<FoodRecord[]> => {
      const { data, error } = await requireSupabase().from('foods').select('*').in('id', ids);
      if (error) throw error;
      const byId = new Map((data ?? []).map((r) => [r.id as string, toFood(r)]));
      return ids.map((id) => byId.get(id)).filter((f): f is FoodRecord => Boolean(f));
    },
  });
}
