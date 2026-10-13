import { useExpenditure } from '@/features/checkin/api';
import { budgetOn } from '@/features/checkin/logic';
import { useClosures, useDaySummaries } from '@/features/dashboard/api';
import { deficitDay, expenditureOn, type DeficitDay } from '@/features/deficit/logic';
import { useProfile } from '@/features/profile/api';
import { toISODate } from '@/lib/dates';

/** A day's deficit: what you burned minus what you ate, with what your budget would have given. */
export function useDayDeficit(date: string): DeficitDay {
  const { data: profile } = useProfile();
  const expenditure = useExpenditure();
  const summaries = useDaySummaries(date, date);
  const closures = useClosures();
  return deficitDay({
    date,
    today: toISODate(new Date()),
    summary: summaries.data?.[date],
    expenditure: expenditureOn(date, expenditure.checkins, expenditure.result.kcal),
    budget: budgetOn(date, expenditure.checkins, profile?.calorie_target ?? 2000),
    addback: Boolean(profile?.exercise_addback),
    closed: closures.data?.includes(date),
  });
}
