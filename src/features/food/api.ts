import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { patchSummaries, type DaySummary, type FoodLogEntry } from '@/features/dashboard/api';
import type { CustomFoodInsert } from '@/features/food/forms';
import type { LoggedRow } from '@/features/food/recents';
import { ensureFood } from '@/features/search/api';
import type { ExternalFood } from '@/features/search/types';
import type { MicroEstimate, Micros } from '@/features/nutrients/micros';
import { drinkWater, rememberedCounts } from '@/features/water/drinks';
import { addDays, toISODate } from '@/lib/dates';
import { formatInt } from '@/lib/format';
import { reportFailure } from '@/lib/failure';
import { newId } from '@/lib/id';
import { hasColumn, MICRO_COLUMNS, tolerantWrite } from '@/lib/optionalColumns';
import type { Meal } from '@/lib/meals';
import { roundNutrients, type FoodRecord, type Nutrients, type Serving } from '@/lib/portion';
import { requireSupabase } from '@/lib/supabase';
import { useToast } from '@/store/toast';

export type FoodWithServings = FoodRecord & { servings: Serving[] };

export const num = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0));
export const numOrNull = (v: unknown) => (v === null || v === undefined ? null : num(v));

export function toFood(r: Record<string, unknown>): FoodRecord {
  return {
    id: r.id as string,
    source: r.source as FoodRecord['source'],
    name: r.name as string,
    brand: (r.brand as string | null) ?? null,
    barcode: (r.barcode as string | null) ?? null,
    external_id: (r.external_id as string | null) ?? null,
    kcal_100g: num(r.kcal_100g),
    protein_100g: num(r.protein_100g),
    carbs_100g: num(r.carbs_100g),
    fat_100g: num(r.fat_100g),
    fiber_100g: numOrNull(r.fiber_100g),
    default_serving_g: numOrNull(r.default_serving_g),
    default_serving_label: (r.default_serving_label as string | null) ?? null,
    sugar_100g: numOrNull(r.sugar_100g),
    sodium_mg_100g: numOrNull(r.sodium_mg_100g),
    // Left out when the database doesn't have the columns yet, so screens can tell.
    ...('micros' in r ? { micros: (r.micros as Micros | null) ?? null, micros_est: (r.micros_est as MicroEstimate | null) ?? null } : {}),
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
        .select('*, foods(source, external_id)')
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
          water_ml: numOrNull(r.water_ml),
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
  /** Set it to be able to remove the entry again straight away (the + / − on a row). */
  id?: string;
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
  /** For a drink: whether its water counts toward the day's water. Left out, it's what you chose last time (or yes). */
  countsAsWater?: boolean;
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

/** Adds (sign 1) or removes (sign -1) an entry's nutrients, and the water in it, from a cached day total. */
function shiftDay(d: DaySummary, n: Nutrients, sign: 1 | -1, entries: number, water: number | null | undefined = 0): DaySummary {
  return {
    ...d,
    kcal_in: Math.max(0, d.kcal_in + sign * n.kcal),
    protein_g: Math.max(0, d.protein_g + sign * n.protein_g),
    carbs_g: Math.max(0, d.carbs_g + sign * n.carbs_g),
    fat_g: Math.max(0, d.fat_g + sign * n.fat_g),
    fiber_g: Math.max(0, d.fiber_g + sign * n.fiber_g),
    food_entries: Math.max(0, d.food_entries + entries),
    drink_ml: Math.max(0, d.drink_ml + sign * (water ?? 0)),
  };
}

const pickNutrients = (e: Nutrients): Nutrients => ({
  kcal: e.kcal,
  protein_g: e.protein_g,
  carbs_g: e.carbs_g,
  fat_g: e.fat_g,
  fiber_g: e.fiber_g,
});

type Recent = Parameters<typeof rememberedCounts>[0];

/** The water a new entry adds: none unless it's a drink, and none if you said (now or last time) that it doesn't count. */
const waterOf = (e: NewEntry, recent: Recent) =>
  drinkWater(e.name, e.grams, e.countsAsWater ?? rememberedCounts(recent, { foodId: e.foodId, name: e.name }, e.meal) ?? true);

const logRow = (e: NewEntry, foodId: string | null, recent: Recent) => {
  const n = roundNutrients(e.nutrients);
  return {
    // Every row gets an id from the phone, so a batch insert always sends the same columns.
    id: e.id ?? newId(),
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
    water_ml: waterOf(e, recent),
  };
};

/** Logged before the water-from-drinks SQL is run, entries go in without their water. */
const LOG_COLUMNS = ['water_ml'] as const;

/** Saves log entries in one request (search results are saved as foods first). */
async function insertEntries(entries: NewEntry[], recent: Recent) {
  const rows: ReturnType<typeof logRow>[] = [];
  for (const e of entries) rows.push(logRow(e, e.external ? await ensureFood(e.external) : e.foodId, recent));
  const { error } = await tolerantWrite(LOG_COLUMNS, (drop) => requireSupabase().from('food_logs').insert(drop(rows)));
  if (error) throw error;
}

/** Shows new entries on the dashboard and Food log straight away, before the server answers. */
function showEntries(queryClient: ReturnType<typeof useQueryClient>, entries: NewEntry[]) {
  const now = Date.now();
  const recent = recentOf(queryClient);
  entries.forEach((e, i) => {
    const n = roundNutrients(e.nutrients);
    const water = hasColumn('water_ml') ? waterOf(e, recent) : null;
    const temp: FoodLogEntry = {
      id: e.id ?? `temp-${now}-${i}`,
      logged_at: new Date(now + i).toISOString(),
      meal: e.meal,
      food_id: e.foodId,
      name: e.name,
      brand: e.brand,
      quantity: e.quantity,
      unit: e.unit,
      grams: e.grams,
      ...n,
      water_ml: water,
    };
    queryClient.setQueryData<FoodLogEntry[]>(['foodLogs', e.date], (old) => (old ? [...old, temp] : old));
    patchSummaries(queryClient, e.date, (d) => shiftDay(d, n, 1, 1, water));
  });
}

/** What you logged lately, for remembering whether a drink counts toward water. */
const recentOf = (queryClient: ReturnType<typeof useQueryClient>) => queryClient.getQueryData<LoggedRow[]>(foodKeys.recentLogs);

/**
 * Logs a food. The dashboard and Food log update before the server answers,
 * so the screen can close the moment you tap Add.
 */
/** Log writes run one after another, so removing something you just added never overtakes the add. */
const LOG_WRITES = { id: 'food-log-writes' };

export function useLogFood() {
  const queryClient = useQueryClient();
  return useMutation({
    scope: LOG_WRITES,
    mutationFn: (e: NewEntry) => insertEntries([e], recentOf(queryClient)),
    onMutate: (e) => showEntries(queryClient, [e]),
    onError: (e, v) => reportFailure(`add ${v.name}`, e),
    onSettled: (_d, _e, v) => invalidateLogs(queryClient, v.date),
  });
}

/** Logs several entries at once: a saved meal, or a meal or day you're copying. */
export function useLogEntries() {
  const queryClient = useQueryClient();
  return useMutation({
    scope: LOG_WRITES,
    mutationFn: (entries: NewEntry[]) => insertEntries(entries, recentOf(queryClient)),
    onMutate: (entries) => showEntries(queryClient, entries),
    onError: (e) => reportFailure('add those foods', e),
    onSettled: (_d, _e, entries) => {
      for (const date of new Set(entries.map((e) => e.date))) invalidateLogs(queryClient, date);
    },
  });
}

export type LogEntry = FoodLogEntry & { log_date: string };

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
        ...('water_ml' in data ? { water_ml: numOrNull(data.water_ml) } : {}),
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
      const row = {
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
        water_ml: drinkWater(e.name, e.grams, e.countsAsWater ?? true),
      };
      const { error } = await tolerantWrite(LOG_COLUMNS, (drop) => requireSupabase().from('food_logs').update(drop(row)).eq('id', id));
      if (error) throw error;
    },
    onMutate: (c) => {
      const n = roundNutrients(c.nutrients);
      const water = hasColumn('water_ml') ? drinkWater(c.name, c.grams, c.countsAsWater ?? true) : null;
      const previous = queryClient.getQueryData<FoodLogEntry[]>(['foodLogs', c.date])?.find((e) => e.id === c.id);
      queryClient.setQueryData<FoodLogEntry[]>(['foodLogs', c.date], (old) =>
        old?.map((e) => (e.id === c.id ? { ...e, meal: c.meal, name: c.name, quantity: c.quantity, unit: c.unit, grams: c.grams, ...n, water_ml: water } : e)),
      );
      if (previous) patchSummaries(queryClient, c.date, (d) => shiftDay(shiftDay(d, pickNutrients(previous), -1, 0, previous.water_ml), n, 1, 0, water));
    },
    onError: (e) => reportFailure('save your changes', e),
    onSettled: (_d, _e, v) => {
      invalidateLogs(queryClient, v.date);
      queryClient.invalidateQueries({ queryKey: foodKeys.entry(v.id) });
    },
  });
}

/** Counts a drink you logged toward the day's water, or stops counting it (milk cooked down into oats). */
export function useSetDrinkWater() {
  const queryClient = useQueryClient();
  return useMutation({
    scope: LOG_WRITES,
    mutationFn: async ({ id, ml }: { id: string; date: string; ml: number }) => {
      const { error } = await requireSupabase().from('food_logs').update({ water_ml: ml }).eq('id', id);
      if (error) throw error;
    },
    onMutate: ({ id, date, ml }) => {
      const previous = queryClient.getQueryData<FoodLogEntry[]>(['foodLogs', date])?.find((e) => e.id === id);
      queryClient.setQueryData<FoodLogEntry[]>(['foodLogs', date], (old) => old?.map((e) => (e.id === id ? { ...e, water_ml: ml } : e)));
      patchSummaries(queryClient, date, (d) => ({ ...d, drink_ml: Math.max(0, d.drink_ml - (previous?.water_ml ?? 0) + ml) }));
      // So the next time you log it, it starts the way you just set it.
      queryClient.setQueryData<LoggedRow[]>(foodKeys.recentLogs, (old) =>
        old && previous ? old.map((r) => (r.food_id === previous.food_id && r.name === previous.name && r.meal === previous.meal ? { ...r, water_ml: ml } : r)) : old,
      );
    },
    onError: (e) => reportFailure('change that drink', e),
    onSettled: (_d, _e, v) => invalidateLogs(queryClient, v.date),
  });
}

export function useDeleteEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    scope: LOG_WRITES,
    mutationFn: async ({ id }: { id: string; date: string }) => {
      const { error } = await requireSupabase().from('food_logs').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: ({ id, date }) => {
      const previous = queryClient.getQueryData<FoodLogEntry[]>(['foodLogs', date])?.find((e) => e.id === id);
      queryClient.setQueryData<FoodLogEntry[]>(['foodLogs', date], (old) => old?.filter((e) => e.id !== id));
      if (previous) patchSummaries(queryClient, date, (d) => shiftDay(d, pickNutrients(previous), -1, -1, previous.water_ml));
    },
    onError: (e) => reportFailure('delete that entry', e),
    onSettled: (_d, _e, v) => invalidateLogs(queryClient, v.date),
  });
}

/** "Added Paneer · 151 kcal", and "Added Paneer ×2 · 151 kcal each" when you tap + again. */
export const addedMessage = (name: string, kcal: number, count = 1) =>
  count > 1 ? `Added ${name} ×${count} · ${formatInt(kcal)} kcal each` : `Added ${name} · ${formatInt(kcal)} kcal`;

/** Takes back entries you've just logged (the − on a row's counter), by the ids they were logged with. */
export function useUnlog() {
  const remove = useDeleteEntry();
  const showToast = useToast((s) => s.show);
  return (date: string, ids: string[], name: string) => {
    for (const id of ids) remove.mutate({ id, date });
    showToast(`Removed ${name}`, 'info');
  };
}

/** Saves a food you created, with its extra units; returns it so it can be logged straight away. */
export function useCreateFood() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ food, servings }: { food: CustomFoodInsert; servings: Serving[] }): Promise<FoodWithServings> => {
      const sb = requireSupabase();
      const { data, error } = await tolerantWrite(MICRO_COLUMNS, (drop) => sb.from('foods').insert(drop(food)).select('*').single());
      if (error) throw error;
      const saved = toFood(data);
      if (servings.length > 0) {
        const extra = await sb.from('food_servings').insert(servings.map((s) => ({ food_id: saved.id, label: s.label, grams: s.grams })));
        if (extra.error) throw extra.error;
      }
      return { ...saved, servings };
    },
    // The new food opens straight away, so seed its cache instead of waiting for a fetch.
    onSuccess: (food) => queryClient.setQueryData<FoodWithServings>(foodKeys.food(food.id), food),
    onSettled: () => queryClient.invalidateQueries({ queryKey: foodKeys.myFoods }),
  });
}

/** Adds a unit to a saved food ("1 scoop = 30 g"). It shows up at once; the save happens in the background. */
export function useAddUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ foodId, serving }: { foodId: string; serving: Serving }) => {
      const { error } = await requireSupabase().from('food_servings').insert({ food_id: foodId, label: serving.label, grams: serving.grams });
      if (error) throw error;
    },
    onMutate: ({ foodId, serving }) =>
      queryClient.setQueryData<FoodWithServings>(foodKeys.food(foodId), (old) => (old ? { ...old, servings: [...old.servings, serving] } : old)),
    onError: (e) => reportFailure('save that unit', e),
    onSettled: (_d, _e, v) => queryClient.invalidateQueries({ queryKey: foodKeys.food(v.foodId) }),
  });
}
