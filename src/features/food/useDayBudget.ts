import { emptyDay, useDaySummaries } from '@/features/dashboard/api';
import { useProfile } from '@/features/profile/api';
import { fiberTarget } from '@/lib/nutrition';
import type { Nutrients } from '@/lib/portion';

/** What's been eaten on a day and what the day allows, for previews and the logger. */
export function useDayBudget(date: string) {
  const { data: profile } = useProfile();
  const summaries = useDaySummaries(date, date);
  const day = summaries.data?.[date] ?? emptyDay(date);
  const addback = profile?.exercise_addback ? day.kcal_out : 0;
  const eaten: Nutrients = { kcal: day.kcal_in, protein_g: day.protein_g, carbs_g: day.carbs_g, fat_g: day.fat_g, fiber_g: day.fiber_g };
  const targets: Nutrients = {
    kcal: (profile?.calorie_target ?? 2000) + addback,
    protein_g: profile?.protein_g ?? 0,
    carbs_g: profile?.carbs_g ?? 0,
    fat_g: profile?.fat_g ?? 0,
    fiber_g: fiberTarget(profile?.calorie_target ?? 2000),
  };
  return { eaten, targets };
}
