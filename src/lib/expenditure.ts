import { addDays, daysBetween, fromISODate, toISODate } from '@/lib/dates';
import { dailyDelta, KCAL_PER_KG, MIN_CALORIES, RECOMP_DEFICIT } from '@/lib/nutrition';
import { trendSeries, type TrendPoint, type WeighIn } from '@/lib/trend';
import type { Goal, Sex } from '@/types/profile';

/**
 * Adaptive expenditure: how much you really burn, worked out from what you
 * ate and what your trend weight did. Energy in − energy stored = energy out:
 *
 *   expenditure ≈ average intake − (trend change in kg × 7,700) / days
 *
 * The data estimate is blended with the previous estimate (the formula at
 * first), trusting the data more as you log more days and weigh in more.
 */

/** Days of history each estimate looks at. */
export const WINDOW_DAYS = 21;
/** The most the data is trusted in one check-in; the rest is the previous estimate, which keeps week-to-week moves calm. */
export const MAX_DATA_WEIGHT = 0.8;
/** The most an estimate moves from the previous one in a week. */
export const MAX_WEEKLY_MOVE = 300;
/** Below this many logged days or weigh-ins in the window, the data isn't used at all. */
export const MIN_LOGGED_DAYS = 7;
export const MIN_WEIGH_INS = 3;

export type DayIntake = { date: string; kcal: number; entries: number; closed: boolean };

/**
 * Whether a day counts towards your average intake. A day you finished
 * counts as logged, even a light one. Otherwise it needs food logged and at
 * least a third of your usual burn, since very low days are usually half-logged.
 */
export function countsAsLogged(day: DayIntake, typicalKcal: number): boolean {
  if (day.closed) return day.entries > 0;
  return day.entries > 0 && day.kcal >= typicalKcal / 3;
}

/** The trend on a date: the last trend point on or before it, or null before the first weigh-in. */
export function trendAt(series: TrendPoint[], date: string): number | null {
  let found: number | null = null;
  for (const p of series) {
    if (p.date > date) break;
    found = p.trend;
  }
  return found;
}

export type ExpenditureResult = {
  /** The estimate to use, kcal per day, rounded to 10. */
  kcal: number;
  /** What the data alone says, or null when there isn't enough of it. */
  fromData: number | null;
  /** 0–0.8: how much of the estimate came from your data rather than the previous estimate. */
  dataWeight: number;
  loggedDays: number;
  weighIns: number;
  /** Average intake on logged days in the window. */
  avgIntake: number | null;
  /** Trend change across the window in kg (negative is down). */
  trendChangeKg: number | null;
  windowDays: number;
};

const round10 = (n: number) => Math.round(n / 10) * 10;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * The expenditure estimate for the `windowDays` days ending on `end` (usually
 * yesterday, since today isn't finished). `previous` is the last estimate, or
 * the formula's maintenance when there isn't one; `formula` keeps the data
 * estimate within believable bounds.
 */
export function estimateExpenditure(input: {
  days: DayIntake[];
  weighIns: WeighIn[];
  end: string;
  previous: number;
  formula: number;
  windowDays?: number;
}): ExpenditureResult {
  const windowDays = input.windowDays ?? WINDOW_DAYS;
  const start = toISODate(addDays(fromISODate(input.end), -(windowDays - 1)));
  const inWindow = (d: string) => d >= start && d <= input.end;

  const logged = input.days.filter((d) => inWindow(d.date) && countsAsLogged(d, input.previous));
  const avgIntake = logged.length ? logged.reduce((s, d) => s + d.kcal, 0) / logged.length : null;

  const series = trendSeries(input.weighIns);
  const weighIns = input.weighIns.filter((w) => inWindow(w.date)).length;
  // Measure from the trend the day before the window; if your weigh-ins only
  // start inside the window, from the first of them.
  const dayBefore = toISODate(addDays(fromISODate(start), -1));
  const firstInWindow = series.find((p) => inWindow(p.date));
  const from = trendAt(series, dayBefore) !== null ? { date: dayBefore, trend: trendAt(series, dayBefore) as number } : firstInWindow;
  const end = trendAt(series, input.end);
  const span = from ? daysBetween(from.date, input.end) : 0;
  const trendChangeKg = from && end !== null && span > 0 ? end - from.trend : null;

  let fromData: number | null = null;
  let dataWeight = 0;
  if (avgIntake !== null && trendChangeKg !== null && logged.length >= MIN_LOGGED_DAYS && weighIns >= MIN_WEIGH_INS && span >= 7) {
    const raw = avgIntake - (trendChangeKg * KCAL_PER_KG) / span;
    fromData = round10(clamp(raw, input.formula * 0.6, input.formula * 1.6));
    dataWeight = MAX_DATA_WEIGHT * Math.min(1, logged.length / 14) * Math.min(1, weighIns / 8);
  }

  const blended = fromData === null ? input.previous : dataWeight * fromData + (1 - dataWeight) * input.previous;
  const kcal = round10(clamp(blended, input.previous - MAX_WEEKLY_MOVE, input.previous + MAX_WEEKLY_MOVE));
  return { kcal, fromData, dataWeight, loggedDays: logged.length, weighIns, avgIntake, trendChangeKg, windowDays };
}

/** How sure the estimate is, in words, for the dashboard and the check-in. */
export function confidenceText(r: Pick<ExpenditureResult, 'dataWeight' | 'loggedDays' | 'weighIns'>): string {
  if (r.dataWeight === 0) {
    const needs = [
      r.loggedDays < MIN_LOGGED_DAYS ? `${MIN_LOGGED_DAYS - r.loggedDays} more logged day${MIN_LOGGED_DAYS - r.loggedDays === 1 ? '' : 's'}` : null,
      r.weighIns < MIN_WEIGH_INS ? `${MIN_WEIGH_INS - r.weighIns} more weigh-in${MIN_WEIGH_INS - r.weighIns === 1 ? '' : 's'}` : null,
    ].filter(Boolean);
    return needs.length ? `Formula estimate · learns after ${needs.join(' and ')}` : 'Formula estimate · learning';
  }
  if (r.dataWeight < 0.5) return 'Learning from your logs';
  return `From your last ${WINDOW_DAYS} days`;
}

/** The budget for your goal at a given expenditure, rounded to 10 and never under the safe minimum. */
export function suggestBudget(input: { expenditure: number; goal: Goal; kgPerWeek: number; sex: Sex | null }): number {
  const delta = input.goal === 'recomp' ? -RECOMP_DEFICIT * input.expenditure : dailyDelta(input.goal, input.kgPerWeek);
  return Math.max(round10(input.expenditure + delta), MIN_CALORIES[input.sex ?? 'female']);
}

/**
 * Days until the trend reaches the goal on a budget, given the expenditure,
 * or null if that budget doesn't move you towards it.
 */
export function daysToGoal(input: { trendKg: number; goalKg: number; expenditure: number; budget: number }): number | null {
  const kgPerDay = (input.expenditure - input.budget) / KCAL_PER_KG; // positive = losing
  const needed = input.trendKg - input.goalKg; // positive = need to lose
  if (Math.abs(needed) < 0.25) return 0;
  if (Math.abs(kgPerDay) < 1e-6 || Math.sign(kgPerDay) !== Math.sign(needed)) return null;
  return Math.ceil(needed / kgPerDay);
}
