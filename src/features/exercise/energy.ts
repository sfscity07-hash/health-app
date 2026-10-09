import type { Activity } from '@/features/exercise/logic';
import { bmr } from '@/lib/nutrition';
import type { Sex } from '@/types/profile';

/**
 * Workout calories that fit you, not an average person.
 *
 * Every number is *active* calories: what the workout burns on top of what
 * you'd burn resting anyway. Gross burn comes from (best first):
 *   1. your average heart rate (Keytel et al., 2005), if you enter it;
 *   2. your speed and incline, for walking and running (ACSM equations);
 *   3. the activity's MET value, scaled by how hard you went.
 * Resting burn is your own (Mifflin-St Jeor from sex, age, height and weight)
 * rather than the textbook 3.5 ml O₂/kg/min.
 */

export type Body = { kg: number; sex: Sex | null; age: number | null; heightCm: number | null };
export type Effort = 'easy' | 'moderate' | 'hard';
export type Method = 'heart-rate' | 'speed' | 'met';

/** Energy per millilitre of oxygen: about 5 kcal per litre. */
const KCAL_PER_ML_O2 = 0.005;
/** How much harder or easier than the list's typical effort. */
export const EFFORT_FACTOR: Record<Effort, number> = { easy: 0.8, moderate: 1, hard: 1.2 };
export const EFFORT_OPTIONS: { value: Effort; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'hard', label: 'Hard' },
];

/** Resting burn per minute: your own when your stats are known, otherwise the textbook 1 MET. */
export function restingPerMin(body: Body): { kcal: number; personal: boolean } {
  if (body.sex && body.age && body.heightCm) {
    return { kcal: bmr({ sex: body.sex, age: body.age, heightCm: body.heightCm, weightKg: body.kg }) / 1440, personal: true };
  }
  return { kcal: 3.5 * body.kg * KCAL_PER_ML_O2, personal: false };
}

/** Walking and running are measured by speed and incline; hiking (rough ground) isn't. */
export function gaitOf(activity: Pick<Activity, 'category' | 'name'>): 'walk' | 'run' | null {
  if (activity.category === 'Running') return 'run';
  if (activity.category === 'Walking' && !/hik/i.test(activity.name)) return 'walk';
  return null;
}

/** The speed in an activity's name ("Running (10 km/h)" → 10), or a typical one. */
export function defaultSpeed(activity: Pick<Activity, 'category' | 'name'>): number {
  const m = activity.name.match(/(\d+(?:\.\d+)?)\s*km\/h/);
  if (m) return Number(m[1]);
  return gaitOf(activity) === 'run' ? 9 : 5;
}

/** Oxygen cost of walking or running in ml/kg/min (ACSM metabolic equations; uphill only). */
export function acsmVo2(speedKmh: number, inclinePct: number, gait: 'walk' | 'run'): number {
  const v = (speedKmh * 1000) / 60; // m/min
  const grade = Math.max(0, inclinePct) / 100;
  // Above about 8 km/h even "walking" costs what running does.
  const running = gait === 'run' || speedKmh >= 8;
  return running ? 0.2 * v + 0.9 * v * grade + 3.5 : 0.1 * v + 1.8 * v * grade + 3.5;
}

/** Gross kcal per minute from average heart rate (Keytel et al., 2005). */
export function keytel(hr: number, body: Body): number | null {
  if (!body.sex || !body.age) return null;
  const kj =
    body.sex === 'male'
      ? -55.0969 + 0.6309 * hr + 0.1988 * body.kg + 0.2017 * body.age
      : -20.4022 + 0.4472 * hr - 0.1263 * body.kg + 0.074 * body.age;
  return Math.max(0, kj / 4.184);
}

export type WorkoutDetails = {
  speedKmh?: number | null;
  inclinePct?: number | null;
  effort?: Effort | null;
  avgHr?: number | null;
};

export type Estimate = {
  kcal: number;
  method: Method;
  /** Resting burn was your own, from your stats. */
  personal: boolean;
};

/** Active calories for a workout. */
export function estimateWorkout(activity: Activity, minutes: number, body: Body, d: WorkoutDetails = {}): Estimate {
  const rest = restingPerMin(body);
  const gait = gaitOf(activity);
  let gross: number;
  let method: Method;
  const fromHr = d.avgHr ? keytel(d.avgHr, body) : null;
  if (fromHr !== null) {
    gross = fromHr;
    method = 'heart-rate';
  } else if (gait) {
    gross = acsmVo2(d.speedKmh ?? defaultSpeed(activity), d.inclinePct ?? 0, gait) * body.kg * KCAL_PER_ML_O2;
    method = 'speed';
  } else {
    gross = activity.met * EFFORT_FACTOR[d.effort ?? 'moderate'] * 3.5 * body.kg * KCAL_PER_ML_O2;
    method = 'met';
  }
  return { kcal: Math.max(0, Math.round((gross - rest.kcal) * minutes)), method, personal: rest.personal };
}

/** Speed in your units, and back: km/h or mph. */
export const KM_PER_MILE = 1.609344;
export const speedToDisplay = (kmh: number, units: 'metric' | 'imperial') => (units === 'imperial' ? kmh / KM_PER_MILE : kmh);
export const speedFromDisplay = (v: number, units: 'metric' | 'imperial') => (units === 'imperial' ? v * KM_PER_MILE : v);
export const speedUnit = (units: 'metric' | 'imperial') => (units === 'imperial' ? 'mph' : 'km/h');

/** Speed limits for the stepper, in km/h. */
export const SPEED_RANGE = { walk: { min: 2, max: 9 }, run: { min: 5, max: 25 } };
export const MAX_INCLINE = 15;
