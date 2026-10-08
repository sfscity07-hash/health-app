import { parseNumber } from '@/features/onboarding/draft';
import { addDays, daysBetween, toISODate } from '@/lib/dates';
import { projectedGoalDate } from '@/lib/nutrition';
import type { TrendPoint } from '@/lib/trend';
import { kgToLb, lbToKg } from '@/lib/units';
import type { Goal } from '@/types/profile';

export type Units = 'metric' | 'imperial';

/** What the database accepts. */
export const MIN_KG = 20;
export const MAX_KG = 400;

export const toDisplay = (kg: number, units: Units) => (units === 'imperial' ? kgToLb(kg) : kg);
export const fromDisplay = (value: number, units: Units) => (units === 'imperial' ? lbToKg(value) : value);
export const unitLabel = (units: Units) => (units === 'imperial' ? 'lb' : 'kg');

/** A typed weight in your units → kg, or a sentence saying what's wrong. */
export function parseWeight(text: string, units: Units): { ok: true; kg: number } | { ok: false; error: string } {
  const value = parseNumber(text);
  if (value === null) return { ok: false, error: 'Enter your weight as a number.' };
  const kg = fromDisplay(value, units);
  if (kg < MIN_KG || kg > MAX_KG) {
    const lo = Math.round(toDisplay(MIN_KG, units));
    const hi = Math.round(toDisplay(MAX_KG, units));
    return { ok: false, error: `That’s outside ${lo}–${hi} ${unitLabel(units)}. Check the number.` };
  }
  return { ok: true, kg: Math.round(kg * 100) / 100 };
}

/** The scale on the weigh-in ruler: 0.1 kg or 0.2 lb steps, a window around where you are. */
export function weightRuler(centerDisplay: number, units: Units) {
  const step = units === 'imperial' ? 0.2 : 0.1;
  const half = units === 'imperial' ? 40 : 20;
  const lo = Math.max(Math.floor(toDisplay(MIN_KG, units)), Math.floor(centerDisplay - half));
  const hi = Math.min(Math.ceil(toDisplay(MAX_KG, units)), Math.ceil(centerDisplay + half));
  // A labelled tick every 1 kg or 2 lb.
  return { label: unitLabel(units), step, min: lo, max: hi, spacing: 10, major: 10 };
}

export const RANGES = [
  { key: '2w', label: '2W', days: 14, phrase: 'in 2 weeks' },
  { key: '1m', label: '1M', days: 30, phrase: 'in a month' },
  { key: '3m', label: '3M', days: 91, phrase: 'in 3 months' },
  { key: '6m', label: '6M', days: 182, phrase: 'in 6 months' },
  { key: '1y', label: '1Y', days: 365, phrase: 'in a year' },
  { key: 'all', label: 'All', days: Infinity, phrase: 'in total' },
] as const;

export type RangeKey = (typeof RANGES)[number]['key'];

/** The trend points inside a range ending today. The trend itself is worked out on all your history first. */
export function pointsInRange(points: TrendPoint[], range: RangeKey, today: Date): TrendPoint[] {
  const days = RANGES.find((r) => r.key === range)?.days ?? Infinity;
  if (!Number.isFinite(days)) return points;
  const from = toISODate(addDays(today, -days));
  return points.filter((p) => p.date >= from);
}

/** Whether going up or down is the direction you want, for colouring changes. */
export function goodDirection(goal: Goal | null): 'down' | 'up' | null {
  if (goal === 'lose' || goal === 'recomp') return 'down';
  if (goal === 'gain') return 'up';
  return null;
}

export type GoalProjection =
  | { kind: 'reached' }
  | { kind: 'date'; date: Date; basis: 'trend' | 'plan'; kgPerWeek: number }
  | { kind: 'away' }
  | { kind: 'none' };

/**
 * When you'll reach your goal weight: at your real pace when the trend is
 * heading the right way (and a week of data shows it), otherwise at the pace
 * you planned. "away" means the trend is moving the other way.
 */
export function goalProjection(input: {
  trendKg: number | null;
  goalKg: number | null;
  weeklyRateKg: number | null;
  planKgPerWeek: number | null;
  today: Date;
}): GoalProjection {
  const { trendKg, goalKg, weeklyRateKg, planKgPerWeek, today } = input;
  if (trendKg === null || goalKg === null) return { kind: 'none' };
  if (Math.abs(trendKg - goalKg) < 0.25) return { kind: 'reached' };
  const towards = goalKg < trendKg ? -1 : 1;
  if (weeklyRateKg !== null && Math.abs(weeklyRateKg) >= 0.05) {
    if (Math.sign(weeklyRateKg) === towards) {
      const date = projectedGoalDate(today, trendKg, goalKg, Math.abs(weeklyRateKg));
      if (date) return { kind: 'date', date, basis: 'trend', kgPerWeek: Math.abs(weeklyRateKg) };
    } else {
      return { kind: 'away' };
    }
  }
  if (planKgPerWeek && planKgPerWeek > 0) {
    const date = projectedGoalDate(today, trendKg, goalKg, planKgPerWeek);
    if (date) return { kind: 'date', date, basis: 'plan', kgPerWeek: planKgPerWeek };
  }
  return { kind: 'none' };
}

/** "today", "yesterday", "3 days ago", "2 weeks ago". */
export function agoText(date: string, today: string): string {
  const d = daysBetween(date, today);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 14) return `${d} days ago`;
  if (d < 60) return `${Math.round(d / 7)} weeks ago`;
  return `${Math.round(d / 30)} months ago`;
}
