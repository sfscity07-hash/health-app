import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { create } from 'zustand';

import { searchOff } from '@/features/search/off';
import { interleave, rankResults } from '@/features/search/rank';
import { usSpelling } from '@/features/search/spelling';
import type { ExternalFood } from '@/features/search/types';
import { SearchLimitError, searchUsda } from '@/features/search/usda';
import { useDebounced } from '@/hooks/useDebounced';
import { usdaApiKey } from '@/lib/env';
import { requireSupabase } from '@/lib/supabase';

export type SourceStatus = 'ok' | 'failed' | 'limited';

export type SearchOutcome = {
  results: ExternalFood[];
  usda: SourceStatus;
  off: SourceStatus;
};

const status = (r: PromiseSettledResult<unknown>): SourceStatus =>
  r.status === 'fulfilled' ? 'ok' : r.reason instanceof SearchLimitError ? 'limited' : 'failed';

/** Searches both databases at once. One failing doesn't hide the other's results. */
export async function searchFoodDatabases(query: string, signal?: AbortSignal): Promise<SearchOutcome> {
  // USDA spells the American way; Open Food Facts has products from everywhere, so it gets what you typed.
  const [usda, off] = await Promise.allSettled([searchUsda(usSpelling(query), usdaApiKey, signal), searchOff(query, signal)]);
  const usdaFoods = usda.status === 'fulfilled' ? usda.value : [];
  const offFoods = off.status === 'fulfilled' ? off.value : [];
  return { results: rankResults(query, interleave(usdaFoods, offFoods)), usda: status(usda), off: status(off) };
}

export const MIN_SEARCH_LENGTH = 2;

/**
 * Database results for what's typed in the logger. Waits for a short pause in
 * typing, keeps the previous results on screen while new ones load, and
 * remembers searches for ten minutes.
 */
export function useFoodSearch(query: string) {
  const settled = useDebounced(query.trim(), 400);
  const enabled = settled.length >= MIN_SEARCH_LENGTH;
  const search = useQuery({
    queryKey: ['foodSearch', settled.toLowerCase()],
    enabled,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: 0,
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => searchFoodDatabases(settled, signal),
  });
  const typing = query.trim() !== settled;
  return { ...search, enabled, typing, searching: enabled && (typing || search.isFetching) };
}

type FoundFoods = { foods: Record<string, ExternalFood>; keep: (f: ExternalFood) => void };

/** Search results you've opened, so the food screen can show one without saving it first. */
export const useFoundFoods = create<FoundFoods>((set) => ({
  foods: {},
  keep: (f) => set((s) => ({ foods: { ...s.foods, [f.key]: f } })),
}));

const cap = (v: number | null, max: number) => (v === null ? null : Math.min(max, Math.max(0, v)));

/**
 * Makes sure a database food is saved to your account (logs point at a saved
 * food) and returns its id. Picking the same food again reuses the first copy.
 */
export async function ensureFood(f: ExternalFood): Promise<string> {
  const sb = requireSupabase();
  const find = () => sb.from('foods').select('id').eq('source', f.source).eq('external_id', f.externalId).limit(1);
  const existing = await find();
  if (existing.error) throw existing.error;
  if (existing.data?.[0]) return existing.data[0].id as string;

  const inserted = await sb
    .from('foods')
    .insert({
      source: f.source,
      external_id: f.externalId,
      barcode: f.barcode,
      name: f.name,
      brand: f.brand,
      kcal_100g: cap(f.kcal_100g, 1000),
      protein_100g: cap(f.protein_100g, 100),
      carbs_100g: cap(f.carbs_100g, 100),
      fat_100g: cap(f.fat_100g, 100),
      fiber_100g: cap(f.fiber_100g, 100),
      sugar_100g: cap(f.sugar_100g, 100),
      sodium_mg_100g: cap(f.sodium_mg_100g, 100000),
      default_serving_g: f.serving?.grams ?? null,
      default_serving_label: f.serving?.label ?? null,
    })
    .select('id')
    .single();
  if (inserted.error) {
    // Saved a moment ago by another tap: use that one.
    if (inserted.error.code === '23505') {
      const again = await find();
      if (again.data?.[0]) return again.data[0].id as string;
    }
    throw inserted.error;
  }
  const id = inserted.data.id as string;
  if (f.servings.length > 0) {
    // Extra measures are a nice-to-have; the food is usable without them.
    await sb.from('food_servings').insert(f.servings.map((s) => ({ food_id: id, label: s.label, grams: s.grams })));
  }
  return id;
}
