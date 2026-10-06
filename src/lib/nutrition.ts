import type { ActivityLevel, Goal, Sex } from '@/types/profile';

/**
 * Energy maths for the starting budget. The weekly check-in (Phase 10)
 * replaces the activity-factor estimate with your measured expenditure.
 */

/** Energy in 1 kg of body weight change, the standard rule of thumb. */
export const KCAL_PER_KG = 7700;

export const ACTIVITY_LEVELS: Record<ActivityLevel, { factor: number; label: string; description: string }> = {
  sedentary: { factor: 1.2, label: 'Mostly sitting', description: 'Desk job and little exercise' },
  light: { factor: 1.375, label: 'Lightly active', description: 'On your feet some, or 1–3 workouts a week' },
  moderate: { factor: 1.55, label: 'Moderately active', description: '3–5 workouts a week' },
  active: { factor: 1.725, label: 'Very active', description: '6–7 workouts a week, or a physical job' },
  very_active: { factor: 1.9, label: 'Extremely active', description: 'Hard daily training plus a physical job' },
};

/** Lowest daily budget Fuel will suggest without you choosing it yourself. */
export const MIN_CALORIES: Record<Sex, number> = { female: 1200, male: 1500 };

export type PaceOption = { kgPerWeek: number; label: string; note?: string };

export const PACE_OPTIONS: Record<'lose' | 'gain', PaceOption[]> = {
  lose: [
    { kgPerWeek: 0.25, label: 'Relaxed' },
    { kgPerWeek: 0.5, label: 'Steady', note: 'Recommended' },
    { kgPerWeek: 0.75, label: 'Fast' },
    { kgPerWeek: 1, label: 'Aggressive', note: 'Hard to sustain' },
  ],
  gain: [
    { kgPerWeek: 0.1, label: 'Lean', note: 'Recommended' },
    { kgPerWeek: 0.25, label: 'Steady' },
    { kgPerWeek: 0.5, label: 'Fast', note: 'More fat gain' },
  ],
};

export type BodyStats = {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
};

/** Resting energy (Mifflin-St Jeor). */
export function bmr({ sex, age, heightCm, weightKg }: BodyStats): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
}

/** Estimated total daily energy: resting energy × activity factor. */
export function maintenanceCalories(stats: BodyStats & { activity: ActivityLevel }): number {
  return bmr(stats) * ACTIVITY_LEVELS[stats.activity].factor;
}

/** Recomp eats about 10% under maintenance: enough to lose fat, not so much that muscle can't grow. */
export const RECOMP_DEFICIT = 0.1;

/** Daily surplus (+) or deficit (−) needed for a weekly rate of change. */
export function dailyDelta(goal: Goal, kgPerWeek: number): number {
  if (goal === 'maintain' || goal === 'recomp') return 0;
  const delta = (kgPerWeek * KCAL_PER_KG) / 7;
  return goal === 'lose' ? -delta : delta;
}

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

export type CalorieTarget = {
  /** The suggested daily budget, rounded to 10 kcal. */
  calories: number;
  maintenance: number;
  delta: number;
  /** True when the budget was raised to the safe minimum for your sex. */
  raisedToMinimum: boolean;
};

export function calorieTarget(
  input: BodyStats & { activity: ActivityLevel; goal: Goal; kgPerWeek: number },
): CalorieTarget {
  const maintenance = maintenanceCalories(input);
  const delta = input.goal === 'recomp' ? -RECOMP_DEFICIT * maintenance : dailyDelta(input.goal, input.kgPerWeek);
  const raw = roundTo(maintenance + delta, 10);
  const floor = MIN_CALORIES[input.sex];
  return {
    calories: Math.max(raw, floor),
    maintenance: Math.round(maintenance),
    delta: Math.round(delta),
    raisedToMinimum: raw < floor,
  };
}

export type MacroTargets = { protein_g: number; carbs_g: number; fat_g: number };

/**
 * Protein by body weight: 1.8 g/kg (capped at 35% of calories), or 2.2 g/kg for
 * recomp (capped at 40%), since building muscle in a deficit needs more.
 * Fat is 30% of calories and carbs fill the rest.
 */
export function macroTargets(calories: number, weightKg: number, goal: Goal = 'lose'): MacroTargets {
  const recomp = goal === 'recomp';
  const protein_g = Math.min(
    Math.round((recomp ? 2.2 : 1.8) * weightKg),
    Math.floor(((recomp ? 0.4 : 0.35) * calories) / 4),
  );
  const fat_g = Math.round((0.3 * calories) / 9);
  const carbs_g = Math.max(0, Math.round((calories - protein_g * 4 - fat_g * 9) / 4));
  return { protein_g, carbs_g, fat_g };
}

/**
 * Fibre: 14 g for every 1,000 kcal you eat, the amount dietary guidelines
 * recommend (about 25 g on 1,800 kcal, 35 g on 2,500 kcal).
 */
export function fiberTarget(calories: number): number {
  return Math.round((14 * calories) / 1000);
}

/** Weeks to reach a goal weight at a steady rate, or null when no change is planned. */
export function weeksToGoal(currentKg: number, goalKg: number, kgPerWeek: number): number | null {
  if (kgPerWeek <= 0 || currentKg === goalKg) return null;
  return Math.abs(currentKg - goalKg) / kgPerWeek;
}

export function projectedGoalDate(today: Date, currentKg: number, goalKg: number, kgPerWeek: number): Date | null {
  const weeks = weeksToGoal(currentKg, goalKg, kgPerWeek);
  if (weeks === null) return null;
  const d = new Date(today);
  d.setDate(d.getDate() + Math.ceil(weeks * 7));
  return d;
}
