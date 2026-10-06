import { calorieTarget, macroTargets, projectedGoalDate, type CalorieTarget, type MacroTargets } from '@/lib/nutrition';
import { feetInchesToCm, lbToKg } from '@/lib/units';
import type { ActivityLevel, Goal, Sex, UnitSystem } from '@/types/profile';

/** Everything the onboarding wizard collects. Text fields stay as typed until validated. */
export type OnboardingDraft = {
  goal: Goal | null;
  sex: Sex | null;
  age: string;
  units: UnitSystem;
  heightCm: string;
  heightFt: string;
  heightIn: string;
  /** Current weight in the chosen units. */
  weight: string;
  activity: ActivityLevel | null;
  /** Goal weight in the chosen units. */
  goalWeight: string;
  kgPerWeek: number | null;
};

export const emptyDraft: OnboardingDraft = {
  goal: null,
  sex: null,
  age: '',
  units: 'metric',
  heightCm: '',
  heightFt: '',
  heightIn: '',
  weight: '',
  activity: null,
  goalWeight: '',
  kgPerWeek: null,
};

export type Step = 'goal' | 'about' | 'body' | 'activity' | 'target' | 'reveal';

/** Maintainers skip the target-weight-and-pace step. */
export function stepsFor(goal: Goal | null): Step[] {
  return goal === 'maintain'
    ? ['goal', 'about', 'body', 'activity', 'reveal']
    : ['goal', 'about', 'body', 'activity', 'target', 'reveal'];
}

/** Accepts "82.5" and "82,5"; returns null for anything that isn't a plain number. */
export function parseNumber(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

const toKg = (value: number, units: UnitSystem) => (units === 'imperial' ? lbToKg(value) : value);

export function heightCmOf(d: OnboardingDraft): number | null {
  if (d.units === 'metric') return parseNumber(d.heightCm);
  const ft = parseNumber(d.heightFt);
  const inches = d.heightIn.trim() === '' ? 0 : parseNumber(d.heightIn);
  if (ft === null || inches === null || inches >= 12) return null;
  return feetInchesToCm(ft, inches);
}

export function weightKgOf(d: OnboardingDraft): number | null {
  const w = parseNumber(d.weight);
  return w === null ? null : toKg(w, d.units);
}

export function goalWeightKgOf(d: OnboardingDraft): number | null {
  const w = parseNumber(d.goalWeight);
  return w === null ? null : toKg(w, d.units);
}

/** A friendly message for what's missing on a step, or null when it's complete. */
export function stepError(step: Step, d: OnboardingDraft): string | null {
  switch (step) {
    case 'goal':
      return d.goal ? null : 'Pick the goal that fits you best.';
    case 'about': {
      if (!d.sex) return 'Choose the option used for your metabolism estimate.';
      const age = parseNumber(d.age);
      if (age === null || !Number.isInteger(age)) return 'Enter your age in whole years.';
      if (age < 16 || age > 99) return "Fuel's estimates are made for ages 16 to 99.";
      return null;
    }
    case 'body': {
      const h = heightCmOf(d);
      if (h === null) return 'Enter your height.';
      if (h < 120 || h > 230) return 'That height looks off. Check the number and units.';
      const w = weightKgOf(d);
      if (w === null) return 'Enter your current weight.';
      if (w < 35 || w > 300) return 'That weight looks off. Check the number and units.';
      return null;
    }
    case 'activity':
      return d.activity ? null : 'Pick the closest match. You can change it later.';
    case 'target': {
      const current = weightKgOf(d);
      const target = goalWeightKgOf(d);
      if (target === null) return 'Enter your goal weight.';
      if (target < 35 || target > 300) return 'That goal weight looks off. Check the number and units.';
      if (current !== null && d.goal === 'lose' && target >= current)
        return 'To lose weight, your goal needs to be below your current weight.';
      if (current !== null && d.goal === 'gain' && target <= current)
        return 'To gain weight, your goal needs to be above your current weight.';
      if (!d.kgPerWeek) return 'Choose a pace.';
      return null;
    }
    case 'reveal':
      return null;
  }
}

export type OnboardingPlan = {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: Goal;
  kgPerWeek: number;
  goalWeightKg: number | null;
  target: CalorieTarget;
  macros: MacroTargets;
  goalDate: Date | null;
};

/** Turns a complete draft into targets. Returns null if any step is still incomplete. */
export function buildPlan(d: OnboardingDraft, today: Date): OnboardingPlan | null {
  if (stepsFor(d.goal).some((s) => stepError(s, d))) return null;
  const sex = d.sex as Sex;
  const goal = d.goal as Goal;
  const activity = d.activity as ActivityLevel;
  const age = parseNumber(d.age) as number;
  const heightCm = heightCmOf(d) as number;
  const weightKg = weightKgOf(d) as number;
  const kgPerWeek = goal === 'maintain' ? 0 : (d.kgPerWeek as number);
  const goalWeightKg = goal === 'maintain' ? null : goalWeightKgOf(d);
  const target = calorieTarget({ sex, age, heightCm, weightKg, activity, goal, kgPerWeek });
  return {
    sex,
    age,
    heightCm,
    weightKg,
    activity,
    goal,
    kgPerWeek,
    goalWeightKg,
    target,
    macros: macroTargets(target.calories, weightKg),
    goalDate: goalWeightKg === null ? null : projectedGoalDate(today, weightKg, goalWeightKg, kgPerWeek),
  };
}
