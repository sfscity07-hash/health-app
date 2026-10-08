import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import type { FoodLogEntry } from '@/features/dashboard/api';
import { num, numOrNull, toFood } from '@/features/food/api';
import { itemNutrients, itemsFromEntries, totalOf, type SavedMeal, type SavedMealItem } from '@/features/meals/logic';
import { reportFailure } from '@/lib/failure';
import { requireSupabase } from '@/lib/supabase';

export const mealKeys = { all: ['savedMeals'] as const };

type ItemRow = Record<string, unknown> & { foods?: unknown };

function toItem(r: ItemRow): SavedMealItem {
  // A one-to-one join comes back as an object (typed as a list without generated types).
  const joined = (Array.isArray(r.foods) ? r.foods[0] : r.foods) as Record<string, unknown> | null | undefined;
  const food = joined ? toFood(joined) : null;
  const grams = numOrNull(r.grams);
  return {
    id: r.id as string,
    position: num(r.position),
    food,
    quantity: num(r.quantity),
    unit: r.unit as string,
    grams,
    name: food?.name ?? (r.name as string | null) ?? 'Food',
    brand: food?.brand ?? null,
    nutrients: itemNutrients(food, grams, {
      kcal: numOrNull(r.kcal) ?? undefined,
      protein_g: numOrNull(r.protein_g) ?? undefined,
      carbs_g: numOrNull(r.carbs_g) ?? undefined,
      fat_g: numOrNull(r.fat_g) ?? undefined,
      fiber_g: numOrNull(r.fiber_g) ?? undefined,
    }),
  };
}

/** Your saved meals, A to Z, each with its foods and totals. */
export function useSavedMeals() {
  const { session } = useAuth();
  return useQuery({
    queryKey: mealKeys.all,
    enabled: Boolean(session),
    queryFn: async (): Promise<SavedMeal[]> => {
      const { data, error } = await requireSupabase()
        .from('saved_meals')
        .select('id, name, saved_meal_items(id, position, food_id, quantity, unit, grams, name, kcal, protein_g, carbs_g, fat_g, fiber_g, foods(*))')
        .order('name');
      if (error) throw error;
      return (data ?? []).map((m) => {
        const items = ((m.saved_meal_items ?? []) as unknown as ItemRow[]).map(toItem).sort((a, b) => a.position - b.position);
        return { id: m.id as string, name: m.name as string, items, totals: totalOf(items) };
      });
    },
  });
}

/** Saves the foods of a meal you logged as a named meal. */
export function useCreateSavedMeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, entries }: { name: string; entries: FoodLogEntry[] }) => {
      const sb = requireSupabase();
      const meal = await sb.from('saved_meals').insert({ name: name.trim().slice(0, 80) }).select('id').single();
      if (meal.error) throw meal.error;
      const rows = itemsFromEntries(entries).map((r) => ({ ...r, saved_meal_id: meal.data.id }));
      const items = await sb.from('saved_meal_items').insert(rows);
      if (items.error) {
        // Don't leave an empty meal behind.
        await sb.from('saved_meals').delete().eq('id', meal.data.id);
        throw items.error;
      }
      return meal.data.id as string;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: mealKeys.all }),
  });
}

export function useRenameSavedMeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await requireSupabase().from('saved_meals').update({ name: name.trim().slice(0, 80) }).eq('id', id);
      if (error) throw error;
    },
    onMutate: ({ id, name }) =>
      queryClient.setQueryData<SavedMeal[]>(mealKeys.all, (old) => old?.map((m) => (m.id === id ? { ...m, name: name.trim() } : m))),
    onError: (e) => reportFailure('rename that meal', e),
    onSettled: () => queryClient.invalidateQueries({ queryKey: mealKeys.all }),
  });
}

export function useDeleteSavedMeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await requireSupabase().from('saved_meals').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: ({ id }) => queryClient.setQueryData<SavedMeal[]>(mealKeys.all, (old) => old?.filter((m) => m.id !== id)),
    onError: (e) => reportFailure('delete that meal', e),
    onSettled: () => queryClient.invalidateQueries({ queryKey: mealKeys.all }),
  });
}

/** Takes one food out of a saved meal. */
export function useRemoveMealItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId }: { mealId: string; itemId: string }) => {
      const { error } = await requireSupabase().from('saved_meal_items').delete().eq('id', itemId);
      if (error) throw error;
    },
    onMutate: ({ mealId, itemId }) =>
      queryClient.setQueryData<SavedMeal[]>(mealKeys.all, (old) =>
        old?.map((m) => {
          if (m.id !== mealId) return m;
          const items = m.items.filter((i) => i.id !== itemId);
          return { ...m, items, totals: totalOf(items) };
        }),
      ),
    onError: (e) => reportFailure('remove that food', e),
    onSettled: () => queryClient.invalidateQueries({ queryKey: mealKeys.all }),
  });
}
