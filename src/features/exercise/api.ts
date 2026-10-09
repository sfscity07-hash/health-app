import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { patchSummaries, useWeighIns } from '@/features/dashboard/api';
import type { Body } from '@/features/exercise/energy';
import { FALLBACK_KG, recentWorkouts, type Activity, type Workout } from '@/features/exercise/logic';
import { useProfile } from '@/features/profile/api';
import { ageOn, fromISODate } from '@/lib/dates';
import { reportFailure } from '@/lib/failure';
import { requireSupabase } from '@/lib/supabase';
import { trendSeries } from '@/lib/trend';

export const exerciseKeys = {
  activities: ['activities'] as const,
  day: (date: string) => ['workouts', date] as const,
  recent: ['workouts', 'recent'] as const,
};

// Everything, so the app still works on a database without the optional detail columns yet.
const COLUMNS = '*';

const numOrNull = (v: unknown) => (v === null || v === undefined ? null : Number(v));

const toWorkout = (r: Record<string, unknown>): Workout => ({
  id: r.id as string,
  log_date: r.log_date as string,
  exercise_id: r.exercise_id === null || r.exercise_id === undefined ? null : Number(r.exercise_id),
  name: r.name as string,
  duration_min: r.duration_min === null || r.duration_min === undefined ? null : Number(r.duration_min),
  kcal_burned: Number(r.kcal_burned ?? 0),
  created_at: r.created_at as string,
  speed_kmh: numOrNull(r.speed_kmh),
  incline_pct: numOrNull(r.incline_pct),
  effort: (r.effort as Workout['effort']) ?? null,
  avg_hr: numOrNull(r.avg_hr),
});

/** The built-in activity list. It never changes, so it's fetched once. */
export function useActivities() {
  const { session } = useAuth();
  return useQuery({
    queryKey: exerciseKeys.activities,
    enabled: Boolean(session),
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async (): Promise<Activity[]> => {
      const { data, error } = await requireSupabase().from('exercises').select('id, name, category, met').order('id');
      if (error) throw error;
      return (data ?? []).map((r) => ({ id: Number(r.id), name: r.name as string, category: r.category as string, met: Number(r.met) }));
    },
  });
}

/** Workouts logged on a day, oldest first. */
export function useWorkouts(date: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: exerciseKeys.day(date),
    enabled: Boolean(session && date),
    queryFn: async (): Promise<Workout[]> => {
      const { data, error } = await requireSupabase().from('exercise_logs').select(COLUMNS).eq('log_date', date).order('created_at');
      if (error) throw error;
      return (data ?? []).map(toWorkout);
    },
  });
}

/** Your last few different workouts, for one-tap repeats. */
export function useRecentWorkouts() {
  const { session } = useAuth();
  return useQuery({
    queryKey: exerciseKeys.recent,
    enabled: Boolean(session),
    queryFn: async (): Promise<Workout[]> => {
      const { data, error } = await requireSupabase().from('exercise_logs').select(COLUMNS).order('created_at', { ascending: false }).limit(60);
      if (error) throw error;
      return recentWorkouts((data ?? []).map(toWorkout));
    },
  });
}

/** What workout calories are worked out from: your trend weight (or the fallback) and your stats. */
export function useBody(): Body {
  const kg = useBodyWeightKg();
  const { data: profile } = useProfile();
  return useMemo(
    () => ({
      kg: kg ?? FALLBACK_KG,
      sex: profile?.sex ?? null,
      age: profile?.birth_date ? ageOn(fromISODate(profile.birth_date), new Date()) : null,
      heightCm: profile?.height_cm ?? null,
    }),
    [kg, profile],
  );
}

/** Your trend weight in kg (what calories burned are worked out from), or null before the first weigh-in. */
export function useBodyWeightKg(): number | null {
  const weighIns = useWeighIns();
  return useMemo(() => {
    const series = trendSeries(weighIns.data ?? []);
    return series.length ? series[series.length - 1].trend : null;
  }, [weighIns.data]);
}

export type NewWorkout = Pick<Workout, 'log_date' | 'exercise_id' | 'name' | 'duration_min' | 'kcal_burned' | 'speed_kmh' | 'incline_pct' | 'effort' | 'avg_hr'>;

/** Leaves out details that weren't given, so a database without those columns still accepts the workout. */
function row<T extends Partial<NewWorkout>>(w: T) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(w)) {
    const optional = k === 'speed_kmh' || k === 'incline_pct' || k === 'effort' || k === 'avg_hr';
    if (!optional || (v !== null && v !== undefined)) out[k] = v;
  }
  return out;
}

/** Re-fetches day totals and workouts (each day's list and Recent). */
function settle(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['summaries'] });
  queryClient.invalidateQueries({ queryKey: ['workouts'] });
}

const shiftBurned = (queryClient: ReturnType<typeof useQueryClient>, date: string, kcal: number) =>
  patchSummaries(queryClient, date, (d) => ({ ...d, kcal_out: Math.max(0, d.kcal_out + kcal) }));

export function useLogWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (w: NewWorkout) => {
      const { error } = await requireSupabase().from('exercise_logs').insert(row(w));
      if (error) throw error;
    },
    onMutate: (w) => {
      shiftBurned(queryClient, w.log_date, w.kcal_burned);
      const temp: Workout = { ...w, id: `temp-${Date.now()}`, created_at: new Date().toISOString() };
      queryClient.setQueryData<Workout[]>(exerciseKeys.day(w.log_date), (old) => (old ? [...old, temp] : old));
    },
    onError: (e, w) => reportFailure(`log ${w.name}`, e),
    onSettled: () => settle(queryClient),
  });
}

export function useUpdateWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    // The editor only includes details that are set, or that it is clearing on a workout that had them.
    mutationFn: async ({ id, patch }: { id: string; date: string; before: number; patch: Omit<NewWorkout, 'log_date'> }) => {
      const { error } = await requireSupabase().from('exercise_logs').update(patch).eq('id', id);
      if (error) throw error;
    },
    onMutate: ({ id, date, before, patch }) => {
      shiftBurned(queryClient, date, patch.kcal_burned - before);
      queryClient.setQueryData<Workout[]>(exerciseKeys.day(date), (old) => old?.map((w) => (w.id === id ? { ...w, ...patch } : w)));
    },
    onError: (e) => reportFailure('save that workout', e),
    onSettled: () => settle(queryClient),
  });
}

export function useDeleteWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; date: string; kcal: number }) => {
      const { error } = await requireSupabase().from('exercise_logs').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: ({ id, date, kcal }) => {
      shiftBurned(queryClient, date, -kcal);
      queryClient.setQueryData<Workout[]>(exerciseKeys.day(date), (old) => old?.filter((w) => w.id !== id));
    },
    onError: (e) => reportFailure('delete that workout', e),
    onSettled: () => settle(queryClient),
  });
}
