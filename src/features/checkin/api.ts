import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { checkinWeek, previousCheckin, type Checkin } from '@/features/checkin/logic';
import { useDaySummaries, useWeighIns } from '@/features/dashboard/api';
import { profileKey, useProfile } from '@/features/profile/api';
import { addDays, ageOn, fromISODate, toISODate } from '@/lib/dates';
import { estimateExpenditure, WINDOW_DAYS, type DayIntake, type ExpenditureResult } from '@/lib/expenditure';
import { reportFailure } from '@/lib/failure';
import { maintenanceCalories } from '@/lib/nutrition';
import { requireSupabase } from '@/lib/supabase';
import { trendSeries } from '@/lib/trend';
import type { Profile } from '@/types/profile';

export const checkinKeys = { all: ['checkins'] as const };

const numOrNull = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** Every check-in, oldest first. */
export function useCheckins() {
  const { session } = useAuth();
  return useQuery({
    queryKey: checkinKeys.all,
    enabled: Boolean(session),
    queryFn: async (): Promise<Checkin[]> => {
      const { data, error } = await requireSupabase()
        .from('checkins')
        .select('week_start, days_logged, avg_intake_kcal, trend_change_kg, expenditure_kcal, old_target, suggested_target, new_target, decision, created_at')
        .order('week_start');
      if (error) throw error;
      return (data ?? []).map((r) => ({
        week_start: r.week_start as string,
        days_logged: Number(r.days_logged),
        avg_intake_kcal: numOrNull(r.avg_intake_kcal),
        trend_change_kg: numOrNull(r.trend_change_kg),
        expenditure_kcal: numOrNull(r.expenditure_kcal),
        old_target: Number(r.old_target),
        suggested_target: Number(r.suggested_target),
        new_target: Number(r.new_target),
        decision: r.decision as Checkin['decision'],
        created_at: r.created_at as string,
      }));
    },
  });
}

/** The textbook estimate from your body stats and activity level, at your current trend weight. */
export function formulaMaintenance(profile: Profile | null | undefined, trendKg: number | null, today: Date): number {
  if (profile?.sex && profile.birth_date && profile.height_cm && profile.activity_level && trendKg !== null) {
    return Math.round(
      maintenanceCalories({
        sex: profile.sex,
        age: ageOn(fromISODate(profile.birth_date), today),
        heightCm: profile.height_cm,
        weightKg: trendKg,
        activity: profile.activity_level,
      }),
    );
  }
  // Without stats, assume the budget was set about 500 under maintenance.
  return (profile?.calorie_target ?? 2000) + 500;
}

export type Expenditure = {
  result: ExpenditureResult;
  /** Where this week's estimate started: last week's, or the formula's. */
  previous: number;
  formula: number;
  trendKg: number | null;
  /** Daily intake for the last 4 weeks, for the check-in's week review. */
  days: DayIntake[];
  checkins: Checkin[];
  ready: boolean;
};

/** Your current expenditure estimate, from the last 3 weeks of logs and weigh-ins (ending yesterday). */
export function useExpenditure(): Expenditure {
  const today = new Date();
  const end = toISODate(addDays(today, -1));
  const from = toISODate(addDays(today, -(WINDOW_DAYS + 7)));
  const { data: profile } = useProfile();
  const weighIns = useWeighIns();
  const summaries = useDaySummaries(from, end);
  const checkins = useCheckins();
  const week = checkinWeek(today);

  return useMemo(() => {
    const series = trendSeries(weighIns.data ?? []);
    const trendKg = series.length ? series[series.length - 1].trend : null;
    const formula = formulaMaintenance(profile, trendKg, fromISODate(end));
    const last = previousCheckin(checkins.data ?? [], week);
    const previous = last?.expenditure_kcal ?? formula;
    const days: DayIntake[] = Object.values(summaries.data ?? {}).map((d) => ({
      date: d.log_date,
      kcal: d.kcal_in,
      entries: d.food_entries,
      closed: d.closed,
    }));
    const result = estimateExpenditure({ days, weighIns: weighIns.data ?? [], end, previous, formula });
    return {
      result,
      previous,
      formula,
      trendKg,
      days,
      checkins: checkins.data ?? [],
      ready: Boolean(profile) && weighIns.isSuccess && summaries.isSuccess && checkins.isSuccess,
    };
    // `end` and `week` change once a day, with the data.
  }, [profile, weighIns.data, weighIns.isSuccess, summaries.data, summaries.isSuccess, checkins.data, checkins.isSuccess, end, week]);
}

/** Saves this week's check-in and, unless you kept your budget, your new targets. */
export function useSaveCheckin() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: async ({ checkin, targets }: { checkin: Checkin; targets: Pick<Profile, 'calorie_target' | 'protein_g' | 'carbs_g' | 'fat_g'> | null }) => {
      const sb = requireSupabase();
      // created_at is the database's; a redo keeps the original day.
      const { created_at: _createdAt, ...row } = checkin;
      const saved = await sb.from('checkins').upsert(row, { onConflict: 'user_id,week_start' });
      if (saved.error) throw saved.error;
      if (targets) {
        const { error } = await sb.from('profiles').update(targets).eq('id', userId as string);
        if (error) throw error;
      }
    },
    onMutate: ({ checkin, targets }) => {
      queryClient.setQueryData<Checkin[]>(checkinKeys.all, (old) => {
        const previous = old?.find((c) => c.week_start === checkin.week_start);
        const next = { ...checkin, created_at: previous?.created_at ?? new Date().toISOString() };
        return [...(old ?? []).filter((c) => c.week_start !== checkin.week_start), next].sort((a, b) => (a.week_start < b.week_start ? -1 : 1));
      });
      if (targets) queryClient.setQueryData<Profile | null>(profileKey(userId), (old) => (old ? { ...old, ...targets } : old));
    },
    onError: (e) => reportFailure('save your check-in', e),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: checkinKeys.all });
      queryClient.invalidateQueries({ queryKey: profileKey(userId) });
    },
  });
}
