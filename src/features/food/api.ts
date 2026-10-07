import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { DB_UPDATE_NEEDED, isDatabaseBehind } from '@/features/auth/errors';
import { patchSummaries, type DaySummary, type FoodLogEntry } from '@/features/dashboard/api';
import type { CustomFoodInsert } from '@/features/food/forms';
import type { LoggedRow } from '@/features/food/recents';
import { ensureFood } from '@/features/search/api';
import type { ExternalFood } from '@/features/search/types';
import { addDays, toISODate } from '@/lib/dates';
import type { Meal } from '@/lib/meals';
import { roundNutrients, type FoodRecord, type Nutrients, type Serving } from '@/lib/portion';
import { requireSupabase } from '@/lib/supabase';
import { useToast } from '@/store/toast';

/** Screens close as soon as you save, so failures are reported here rather than on the screen. */
const reportFailure = (what: string, error: unknown) =>
  useToast
    .getState()
    .show(isDatabaseBehind(error) ? DB_UPDATE_NEEDED : `Couldn’t ${what}. Check your connection and try again.`, 'warn');

export type FoodWithServings = FoodRecord & { servings: Serving[] };

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0));
const numOrNull = (v: unknown) => (v === null || v === undefined ? null : num(v));

function toFood(r: Record<string, unknown>): FoodRecord {
  return {
    id: r.id as string,
    source: r.source as FoodRecord['source'],
    name: r.name as string,
    brand: (r.brand as string | null) ?? null,
    barcode: (r.barcode as string | null) ?? null,
    kcal_100g: num(r.kcal_100g),
    protein_100g: num(r.protein_100g),
    carbs_100g: num(r.carbs_100g),
    fat_100g: num(r.fat_100g),
    fiber_100g: numOrNull(r.fiber_100g),
    default_serving_g: numOrNull(r.default_serving_g),
    default_serving_label: (r.default_serving_label as string | null) ?? null,
  };
}

export const foodKeys = {
  food: (id: string) => ['food', id] as const,
  myFoods: ['myFoods'] as const,
  recentLogs: ['recentLogs'] as const,
  favorites: ['favorites'] as const,
  entry: (id: string) => ['entry', id] as const,
};

export function useFood(id: string | undefined) {
  const { session } = useAuth();
  return useQuery({
    queryKey: foodKeys.food(id ?? ''),
    enabled: Boolean(session && id),
    queryFn: async (): Promise<FoodWithServings> => {
      const { data, error } = await requireSupabase()
        .from('foods')
        .select('*, food_servings(label, grams)')
        .eq('id', id as string)
        .single();
      if (error) throw error;
      const servings = ((data.food_servings ?? []) as { label: string; grams: unknown }[]).map((s) => ({
        label: s.label,
        grams: num(s.grams),
      }));
      return { ...toFood(data), servings };
    },
  });
}

/** Foods you created yourself, A to Z. */
export function useMyFoods() {
  const { session } = useAuth();
  return useQuery({
    queryKey: foodKeys.myFoods,
    enabled: Boolean(session),
    queryFn: async (): Promise<FoodRecord[]> => {
      const { data, error } = await requireSupabase().from('foods').select('*').eq('source', 'custom').order('name');
      if (error) throw error;
      return (data ?? []).map(toFood);
    },
  });
}

/** What you've logged in the last 60 days, newest first, for the Recent list. */
export function useRecentLogs() {
  const { session } = useAuth();
  return useQuery({
    queryKey: foodKeys.recentLogs,
    enabled: Boolean(session),
    queryFn: async (): Promise<LoggedRow[]> => {
      const since = toISODate(addDays(new Date(), -60));
      const { data, error } = await requireSupabase()
        .from('food_logs')
        .select('food_id, name, brand, quantity, unit, grams, kcal, protein_g, carbs_g, fat_g, fiber_g, meal, log_date, foods(source, external_id)')
        .gte('log_date', since)
        .order('logged_at', { ascending: false })
        .limit(400);
      if (error) throw error;
      return (data ?? []).map(({ foods, ...r }) => {
        // Which USDA / Open Food Facts entry it came from, so search can skip it.
        const food = (Array.isArray(foods) ? foods[0] : foods) as { source?: string; external_id?: string | null } | null;
        return {
          ...r,
          quantity: num(r.quantity),
          grams: numOrNull(r.grams),
          kcal: num(r.kcal),
          protein_g: num(r.protein_g),
          carbs_g: num(r.carbs_g),
          fat_g: num(r.fat_g),
          fiber_g: num(r.fiber_g),
          external_key: food?.external_id ? `${food.source}:${food.external_id}` : null,
        };
      }) as LoggedRow[];
    },
  });
}

export function useFavorites() {
  const { session } = useAuth();
  return useQuery({
    queryKey: foodKeys.favorites,
    enabled: Boolean(session),
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await requireSupabase().from('favorites').select('food_id');
      if (error) throw error;
      return (data ?? []).map((r) => r.food_id as string);
    },
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ foodId, on }: { foodId: string; on: boolean }) => {
      const sb = requireSupabase();
      const { error } = on
        ? await sb.from('favorites').upsert({ food_id: foodId }, { onConflict: 'user_id,food_id' })
        : await sb.from('favorites').delete().eq('food_id', foodId);
      if (error) throw error;
    },
    onMutate: ({ foodId, on }) =>
      queryClient.setQueryData<string[]>(foodKeys.favorites, (old = []) =>
        on ? [...new Set([...old, foodId])] : old.filter((id) => id !== foodId),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: foodKeys.favorites }),
  });
}

export type NewEntry = {
  date: string;
  meal: Meal;
  foodId: string | null;
  name: string;
  brand: string | null;
  quantity: number;
  unit: string;
  grams: number | null;
  nutrients: Nutrients;
  /** A search result that isn't saved yet: it's saved first, then logged. */
  external?: ExternalFood;
};

/**
 * Everything a log change can affect on screen. The Recent list is left
 * alone on purpose: it refreshes each time the logger opens, so rows don't
 * jump around under your finger while you're adding several foods.
 */
function invalidateLogs(queryClient: ReturnType<typeof useQueryClient>, date?: string) {
  queryClient.invalidateQueries({ queryKey: ['summaries'] });
  queryClient.invalidateQueries({ queryKey: date ? ['foodLogs', date] : ['foodLogs'] });
}

/** Adds (sign 1) or removes (sign -1) an entry's nutrients from a cached day total. */
function shiftDay(d: DaySummary, n: Nutrients, sign: 1 | -1, entries: number): DaySummary {
  return {
    ...d,
    kcal_in: Math.max(0, d.kcal_in + sign * n.kcal),
    protein_g: Math.max(0, d.protein_g + sign * n.protein_g),
    carbs_g: Math.max(0, d.carbs_g + sign * n.carbs_g),
    fat_g: Math.max(0, d.fat_g + sign * n.fat_g),
    fiber_g: Math.max(0, d.fiber_g + sign * n.fiber_g),
    food_entries: Math.max(0, d.food_entries + entries),
  };
}

const pickNutrients = (e: Nutrients): Nutrients => ({
  kcal: e.kcal,
  protein_g: e.protein_g,
  carbs_g: e.carbs_g,
  fat_g: e.fat_g,
  fiber_g: e.fiber_g,
});

/**
 * Logs a food. The dashboard and Food log update before the server answers,
 * so the screen can close the moment you tap Add.
 */
export function useLogFood() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (e: NewEntry) => {
      const n = roundNutrients(e.nutrients);
      const foodId = e.external ? await ensureFood(e.external) : e.foodId;
      const { error } = await requireSupabase()
        .from('food_logs')
        .insert({
          log_date: e.date,
          meal: e.meal,
          food_id: foodId,
          name: e.name,
          brand: e.brand,
          quantity: Math.round(e.quantity * 100) / 100,
          unit: e.unit,
          grams: e.grams === null ? null : Math.round(e.grams * 100) / 100,
          kcal: n.kcal,
          protein_g: n.protein_g,
          carbs_g: n.carbs_g,
          fat_g: n.fat_g,
          fiber_g: n.fiber_g,
        });
      if (error) throw error;
    },
    onMutate: (e) => {
      const n = roundNutrients(e.nutrients);
      const temp: FoodLogEntry = {
        id: `temp-${Date.now()}`,
        logged_at: new Date().toISOString(),
        meal: e.meal,
        name: e.name,
        brand: e.brand,
        quantity: e.quantity,
        unit: e.unit,
        ...n,
      };
      queryClient.setQueryData<FoodLogEntry[]>(['foodLogs', e.date], (old) => (old ? [...old, temp] : old));
      patchSummaries(queryClient, e.date, (d) => shiftDay(d, n, 1, 1));
    },
    onError: (e, v) => reportFailure(`add ${v.name}`, e),
    onSettled: (_d, _e, v) => invalidateLogs(queryClient, v.date),
  });
}

export type LogEntry = FoodLogEntry & { food_id: string | null; grams: number | null; log_date: string };

export function useEntry(id: string | undefined) {
  const { session } = useAuth();
  return useQuery({
    queryKey: foodKeys.entry(id ?? ''),
    enabled: Boolean(session && id),
    queryFn: async (): Promise<LogEntry> => {
      const { data, error } = await requireSupabase().from('food_logs').select('*').eq('id', id as string).single();
      if (error) throw error;
      return {
        ...data,
        quantity: num(data.quantity),
        grams: numOrNull(data.grams),
        kcal: num(data.kcal),
        protein_g: num(data.protein_g),
        carbs_g: num(data.carbs_g),
        fat_g: num(data.fat_g),
        fiber_g: num(data.fiber_g),
      } as LogEntry;
    },
  });
}

export type EntryChange = Omit<NewEntry, 'foodId' | 'brand'> & { id: string };

export function useUpdateEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...e }: EntryChange) => {
      const n = roundNutrients(e.nutrients);
      const { error } = await requireSupabase()
        .from('food_logs')
        .update({
          meal: e.meal,
          name: e.name,
          quantity: Math.round(e.quantity * 100) / 100,
          unit: e.unit,
          grams: e.grams === null ? null : Math.round(e.grams * 100) / 100,
          kcal: n.kcal,
          protein_g: n.protein_g,
          carbs_g: n.carbs_g,
          fat_g: n.fat_g,
          fiber_g: n.fiber_g,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: (c) => {
      const n = roundNutrients(c.nutrients);
      const previous = queryClient.getQueryData<FoodLogEntry[]>(['foodLogs', c.date])?.find((e) => e.id === c.id);
      queryClient.setQueryData<FoodLogEntry[]>(['foodLogs', c.date], (old) =>
        old?.map((e) => (e.id === c.id ? { ...e, meal: c.meal, name: c.name, quantity: c.quantity, unit: c.unit, ...n } : e)),
      );
      if (previous) patchSummaries(queryClient, c.date, (d) => shiftDay(shiftDay(d, pickNutrients(previous), -1, 0), n, 1, 0));
    },
    onError: (e) => reportFailure('save your changes', e),
    onSettled: (_d, _e, v) => {
      invalidateLogs(queryClient, v.date);
      queryClient.invalidateQueries({ queryKey: foodKeys.entry(v.id) });
    },
  });
}

export function useDeleteEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; date: string }) => {
      const { error } = await requireSupabase().from('food_logs').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: ({ id, date }) => {
      const previous = queryClient.getQueryData<FoodLogEntry[]>(['foodLogs', date])?.find((e) => e.id === id);
      queryClient.setQueryData<FoodLogEntry[]>(['foodLogs', date], (old) => old?.filter((e) => e.id !== id));
      if (previous) patchSummaries(queryClient, date, (d) => shiftDay(d, pickNutrients(previous), -1, -1));
    },
    onError: (e) => reportFailure('delete that entry', e),
    onSettled: (_d, _e, v) => invalidateLogs(queryClient, v.date),
  });
}

/** Saves a food you created; returns it so it can be logged straight away. */
export function useCreateFood() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (food: CustomFoodInsert): Promise<FoodRecord> => {
      const { data, error } = await requireSupabase().from('foods').insert(food).select('*').single();
      if (error) throw error;
      return toFood(data);
    },
    // The new food opens straight away, so seed its cache instead of waiting for a fetch.
    onSuccess: (food) => queryClient.setQueryData<FoodWithServings>(foodKeys.food(food.id), { ...food, servings: [] }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: foodKeys.myFoods }),
  });
}
