import type { Goal } from '@/types/profile';

export type Macros = { protein_g: number; carbs_g: number; fat_g: number };

export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

/** Protein and fat as you set them; carbs fill whatever calories are left (never below zero). */
export function macrosFor(kcal: number, proteinG: number, fatG: number): Macros {
  return {
    protein_g: Math.round(proteinG),
    fat_g: Math.round(fatG),
    carbs_g: Math.max(0, Math.round((kcal - proteinG * KCAL_PER_G.protein - fatG * KCAL_PER_G.fat) / KCAL_PER_G.carbs)),
  };
}

/** A macro's share of the calories, in whole percent. */
export const percentOf = (kcal: number, grams: number, kcalPerG: number) => (kcal > 0 ? Math.round(((grams * kcalPerG) / kcal) * 100) : 0);

/** Grams for a share of the calories. */
export const gramsFor = (kcal: number, percent: number, kcalPerG: number) => Math.round(((percent / 100) * kcal) / kcalPerG);

/** Whether protein and fat leave room for the calories (carbs can't go negative). */
export const fits = (kcal: number, proteinG: number, fatG: number) => proteinG * KCAL_PER_G.protein + fatG * KCAL_PER_G.fat <= kcal;

/** The step a − / + moves: 5 g, or 5% of the calories. */
export function stepMacro(kcal: number, grams: number, kcalPerG: number, mode: 'grams' | 'percent', dir: 1 | -1): number {
  if (mode === 'grams') return Math.max(0, Math.round(grams / 5) * 5 + dir * 5);
  const pct = Math.round(percentOf(kcal, grams, kcalPerG) / 5) * 5 + dir * 5;
  return Math.max(0, gramsFor(kcal, pct, kcalPerG));
}

/** A sentence when the goal weight points the wrong way for the goal, or null when it's fine. */
export function goalWeightProblem(goal: Goal, trendKg: number | null, goalKg: number | null): string | null {
  if (goalKg === null || trendKg === null) return null;
  if (goal === 'lose' && goalKg >= trendKg) return 'Your goal weight is above your trend. Pick a lower one, or choose Gain.';
  if (goal === 'gain' && goalKg <= trendKg) return 'Your goal weight is below your trend. Pick a higher one, or choose Lose.';
  return null;
}
