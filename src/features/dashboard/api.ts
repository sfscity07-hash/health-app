import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { requireSupabase } from '@/lib/supabase';
import type { WeighIn } from '@/lib/trend';
import type { Meal } from '@/lib/meals';

export type DaySummary = {
  log_date: string;
  kcal_in: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  food_entries: number;
  kcal_out: number;
  water_ml: number;
  closed: boolean;
  fiber_g: number;
};

export type FoodLogEntry = {
  id: string;
  logged_at: string;
  meal: Meal;
  name: string;
  brand: string | null;
  quantity: number;
  unit: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
};

export const emptyDay = (log_date: string): DaySummary => ({
  log_date,
  kcal_in: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  food_entries: 0,
  kcal_out: 0,
  water_ml: 0,
  closed: false,
  fiber_g: 0,
});

export const keys = {
  summaries: (from: string, to: string) => ['summaries', from, to] as const,
  foodLogs: (date: string) => ['foodLogs', date] as const,
  weighIns: ['weighIns'] as const,
  closures: ['closures'] as const,
};

/** PostgREST sends numeric columns as numbers, but be safe with strings. */
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0));

/** Daily totals for a date range, keyed by YYYY-MM-DD. Days with nothing logged are absent. */
export function useDaySummaries(from: string, to: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: keys.summaries(from, to),
    enabled: Boolean(session && from && to),
    queryFn: async (): Promise<Record<string, DaySummary>> => {
      const { data, error } = await requireSupabase()
        .from('daily_summary')
        .select('*')
        .gte('log_date', from)
        .lte('log_date', to);
      if (error) throw error;
      const out: Record<string, DaySummary> = {};
      for (const r of data ?? []) {
        out[r.log_date] = {
          log_date: r.log_date,
          kcal_in: num(r.kcal_in),
          protein_g: num(r.protein_g),
          carbs_g: num(r.carbs_g),
          fat_g: num(r.fat_g),
          food_entries: num(r.food_entries),
          kcal_out: num(r.kcal_out),
          water_ml: num(r.water_ml),
          closed: Boolean(r.closed),
          fiber_g: num(r.fiber_g),
        };
      }
      return out;
    },
  });
}

export function useFoodLogs(date: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: keys.foodLogs(date),
    enabled: Boolean(session),
    queryFn: async (): Promise<FoodLogEntry[]> => {
      const { data, error } = await requireSupabase()
        .from('food_logs')
        .select('id, logged_at, meal, name, brand, quantity, unit, kcal, protein_g, carbs_g, fat_g, fiber_g')
        .eq('log_date', date)
        .order('logged_at');
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        quantity: num(r.quantity),
        kcal: num(r.kcal),
        protein_g: num(r.protein_g),
        carbs_g: num(r.carbs_g),
        fat_g: num(r.fat_g),
        fiber_g: num(r.fiber_g),
      })) as FoodLogEntry[];
    },
  });
}

/** Your weigh-ins, oldest first (up to about three years of daily ones). Shared by the dashboard and Progress. */
export function useWeighIns() {
  const { session } = useAuth();
  return useQuery({
    queryKey: keys.weighIns,
    enabled: Boolean(session),
    queryFn: async (): Promise<WeighIn[]> => {
      const { data, error } = await requireSupabase()
        .from('weight_logs')
        .select('log_date, weight_kg')
        .order('log_date', { ascending: false })
        .limit(1100);
      if (error) throw error;
      return (data ?? []).map((r) => ({ date: r.log_date, kg: num(r.weight_kg) })).reverse();
    },
  });
}

/** Every finished day, as YYYY-MM-DD. One small row per day, so fetching all is cheap. */
export function useClosures() {
  const { session } = useAuth();
  return useQuery({
    queryKey: keys.closures,
    enabled: Boolean(session),
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await requireSupabase().from('day_closures').select('log_date');
      if (error) throw error;
      return (data ?? []).map((r) => r.log_date as string);
    },
  });
}

/** Applies a change to one day in every cached summary range that contains it. */
export function patchSummaries(
  queryClient: ReturnType<typeof useQueryClient>,
  date: string,
  patch: (d: DaySummary) => DaySummary,
) {
  queryClient.setQueriesData<Record<string, DaySummary>>({ queryKey: ['summaries'] }, (old) => {
    if (!old) return old;
    return { ...old, [date]: patch(old[date] ?? emptyDay(date)) };
  });
}

export function useAddWater() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ date, ml }: { date: string; ml: number }) => {
      const { error } = await requireSupabase().from('water_logs').insert({ log_date: date, amount_ml: ml });
      if (error) throw error;
    },
    onMutate: ({ date, ml }) => patchSummaries(queryClient, date, (d) => ({ ...d, water_ml: d.water_ml + ml })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['summaries'] }),
  });
}

/** Undoes the most recent glass of water on a day. */
export function useRemoveWater() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ date }: { date: string }) => {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from('water_logs')
        .select('id')
        .eq('log_date', date)
        .order('logged_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      const id = data?.[0]?.id;
      if (!id) return;
      const del = await sb.from('water_logs').delete().eq('id', id);
      if (del.error) throw del.error;
    },
    onMutate: ({ date }) =>
      patchSummaries(queryClient, date, (d) => ({ ...d, water_ml: Math.max(0, d.water_ml - 250) })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['summaries'] }),
  });
}

export function useCloseDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ date }: { date: string }) => {
      const { error } = await requireSupabase().from('day_closures').upsert({ log_date: date }, { onConflict: 'user_id,log_date' });
      if (error) throw error;
    },
    onMutate: ({ date }) => {
      queryClient.setQueryData<string[]>(keys.closures, (old) => (old?.includes(date) ? old : [...(old ?? []), date]));
      patchSummaries(queryClient, date, (d) => ({ ...d, closed: true }));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: keys.closures });
      queryClient.invalidateQueries({ queryKey: ['summaries'] });
    },
  });
}

/** Re-fetches everything the dashboard shows (pull to refresh). */
export function useRefreshDashboard() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      [['summaries'], ['foodLogs'], keys.weighIns, keys.closures, ['profile']].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    );
}
