import type { IconName } from '@/components/ui/Icon';
import type { DaySummary } from '@/features/dashboard/api';
import { addDays, fromISODate, toISODate, weekOf } from '@/lib/dates';
import type { ColorName } from '@/theme/tokens';
import type { Goal } from '@/types/profile';

// ---------------------------------------------------------------------------
// Goal journey
// ---------------------------------------------------------------------------

export type Journey = {
  startKg: number;
  goalKg: number;
  trendKg: number;
  /** Kilograms moved the right way so far (never negative). */
  doneKg: number;
  /** 0–1 along the way from start to goal. */
  fraction: number;
  /** Every 2.5 kg between start and goal, in the order you'll pass them. */
  milestones: number[];
  /** The next milestone (or the goal itself) still ahead, or null at the goal. */
  next: number | null;
};

export const MILESTONE_STEP_KG = 2.5;

/** Where you are between your starting weight and your goal. Null when there's no distance to cover. */
export function journey(startKg: number, trendKg: number, goalKg: number): Journey | null {
  const total = Math.abs(goalKg - startKg);
  if (total < 0.5) return null;
  const down = goalKg < startKg;
  const doneKg = Math.max(0, down ? startKg - trendKg : trendKg - startKg);
  const fraction = Math.min(1, doneKg / total);
  const milestones: number[] = [];
  if (down) {
    for (let m = Math.ceil(goalKg / MILESTONE_STEP_KG) * MILESTONE_STEP_KG; m < startKg - 0.01; m += MILESTONE_STEP_KG) {
      if (m > goalKg + 0.01) milestones.unshift(m);
    }
  } else {
    for (let m = Math.ceil(startKg / MILESTONE_STEP_KG) * MILESTONE_STEP_KG; m < goalKg - 0.01; m += MILESTONE_STEP_KG) {
      if (m > startKg + 0.01) milestones.push(m);
    }
  }
  const ahead = [...milestones, goalKg].find((m) => (down ? m < trendKg - 0.05 : m > trendKg + 0.05));
  return { startKg, goalKg, trendKg, doneKg, fraction, milestones, next: fraction >= 1 ? null : (ahead ?? goalKg) };
}

/** Where a weight sits on the journey track, 0–1. */
export const positionOf = (j: Journey, kg: number) => Math.min(1, Math.max(0, Math.abs(kg - j.startKg) / Math.abs(j.goalKg - j.startKg)));

/** Days until the trend reaches a weight at the current weekly rate, or null if it's not heading there. */
export function daysTo(trendKg: number, targetKg: number, weeklyRateKg: number | null): number | null {
  if (weeklyRateKg === null || Math.abs(weeklyRateKg) < 0.02) return null;
  const needed = targetKg - trendKg;
  if (Math.sign(needed) !== Math.sign(weeklyRateKg)) return null;
  // Round up: an estimate a day late beats one a day early.
  return Math.max(1, Math.ceil((needed / weeklyRateKg) * 7 - 1e-6));
}

// ---------------------------------------------------------------------------
// Calories, macros
// ---------------------------------------------------------------------------

export type CalorieDay = { date: string; kcal: number; budget: number; over: boolean; isToday: boolean; logged: boolean };

/** The last 7 days (ending today) against the budget each day had. Over means more than 5% over. */
export function calorieWeek(today: string, summaries: Record<string, DaySummary>, budgetFor: (date: string) => number): CalorieDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = toISODate(addDays(fromISODate(today), i - 6));
    const s = summaries[date];
    const budget = budgetFor(date);
    const kcal = s?.kcal_in ?? 0;
    return { date, kcal, budget, over: kcal > budget * 1.05, isToday: date === today, logged: (s?.food_entries ?? 0) > 0 };
  });
}

export type MacroSplit = {
  days: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  /** Share of calories from each, 0–1. */
  share: { protein: number; carbs: number; fat: number };
};

/** Average macros over logged days, and each one's share of the calories. */
export function macroSplit(days: Pick<DaySummary, 'protein_g' | 'carbs_g' | 'fat_g' | 'food_entries'>[]): MacroSplit | null {
  const logged = days.filter((d) => d.food_entries > 0);
  if (logged.length === 0) return null;
  const avg = (k: 'protein_g' | 'carbs_g' | 'fat_g') => logged.reduce((s, d) => s + d[k], 0) / logged.length;
  const p = avg('protein_g');
  const c = avg('carbs_g');
  const f = avg('fat_g');
  const kcal = p * 4 + c * 4 + f * 9;
  return {
    days: logged.length,
    protein_g: Math.round(p),
    carbs_g: Math.round(c),
    fat_g: Math.round(f),
    share: kcal > 0 ? { protein: (p * 4) / kcal, carbs: (c * 4) / kcal, fat: (f * 9) / kcal } : { protein: 0, carbs: 0, fat: 0 },
  };
}

/** Logged days that reached the protein target (within 5%). */
export function proteinDays(days: Pick<DaySummary, 'protein_g' | 'food_entries'>[], target: number): number {
  if (target <= 0) return 0;
  return days.filter((d) => d.food_entries > 0 && d.protein_g >= target * 0.95).length;
}

// ---------------------------------------------------------------------------
// Consistency heatmap
// ---------------------------------------------------------------------------

export type HeatLevel = 'none' | 'logged' | 'finished' | 'future';
export type HeatWeek = { monday: string; days: { date: string; level: HeatLevel }[] };

export const HEAT_WEEKS = 13;

/** 13 weeks of days, a column per week (Monday first), ending with this week. */
export function heatmap(today: string, summaries: Record<string, DaySummary>, closed: Set<string>, weeks = HEAT_WEEKS) {
  const thisMonday = weekOf(fromISODate(today))[0];
  const columns: HeatWeek[] = [];
  let logged = 0;
  let finished = 0;
  for (let w = weeks - 1; w >= 0; w--) {
    const monday = addDays(thisMonday, -7 * w);
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = toISODate(addDays(monday, i));
      let level: HeatLevel = 'none';
      if (date > today) level = 'future';
      else if (closed.has(date)) level = 'finished';
      else if ((summaries[date]?.food_entries ?? 0) > 0) level = 'logged';
      if (level === 'finished') finished += 1;
      if (level === 'finished' || level === 'logged') logged += 1;
      return { date, level };
    });
    columns.push({ monday: toISODate(monday), days });
  }
  return { columns, logged, finished };
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

export type Badge = {
  key: string;
  title: string;
  icon: IconName;
  color: ColorName;
  /** 0–1 towards earning it (1 once earned). */
  progress: number;
  done: boolean;
  /** "23 / 30" */
  count: string;
  /** How to earn it, or that you did. */
  hint: string;
};

export type BadgeInput = {
  goal: Goal | null;
  units: 'metric' | 'imperial';
  /** Days logged this calendar week so far, and whether any full week in the last 13 was all logged. */
  loggedThisWeek: number;
  perfectWeekBefore: boolean;
  streak: { current: number; best: number };
  /** Days in the last 7 that reached the protein target. */
  proteinDays: number;
  /** Kilograms moved towards the goal since you started, and how far along the journey you are (null without a goal weight). */
  movedKg: number;
  journeyFraction: number | null;
  checkins: number;
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Milestones, each with progress you can see before you earn it. */
export function badges(i: BadgeInput): Badge[] {
  const out: Badge[] = [];
  const add = (b: Omit<Badge, 'progress' | 'done'> & { value: number; target: number; earned?: boolean }) => {
    const done = b.earned || b.value >= b.target;
    const { value, target, earned: _earned, ...rest } = b;
    out.push({ ...rest, progress: done ? 1 : clamp01(value / target), done });
  };

  const perfect = i.perfectWeekBefore || i.loggedThisWeek >= 7;
  add({
    key: 'perfect-week',
    title: 'Perfect week',
    icon: 'check',
    color: 'accent',
    value: i.loggedThisWeek,
    target: 7,
    earned: perfect,
    count: `${Math.min(7, i.loggedThisWeek)} / 7`,
    hint: perfect ? 'You logged every day of a week.' : 'Log every day this week, Monday to Sunday.',
  });
  for (const n of [7, 30]) {
    const earned = i.streak.best >= n;
    add({
      key: `streak-${n}`,
      title: `${n}-day streak`,
      icon: 'flame',
      color: 'flame',
      value: i.streak.current,
      target: n,
      earned,
      count: `${Math.min(n, earned ? n : i.streak.current)} / ${n}`,
      hint: earned ? `You finished ${n} days in a row.` : `Tap Finish today ${n - i.streak.current} more day${n - i.streak.current === 1 ? '' : 's'} in a row.`,
    });
  }
  add({
    key: 'protein-week',
    title: 'Protein week',
    icon: 'target',
    color: 'protein',
    value: i.proteinDays,
    target: 7,
    count: `${i.proteinDays} / 7`,
    hint: i.proteinDays >= 7 ? 'You hit your protein target every day for a week.' : 'Hit your protein target 7 days running.',
  });

  if (i.goal !== 'maintain' && i.journeyFraction !== null) {
    const imperial = i.units === 'imperial';
    const gaining = i.goal === 'gain';
    // A round first step in your units: 5 kg / 10 lb to lose, 2 kg / 5 lb to gain.
    const stepKg = gaining ? (imperial ? 2.268 : 2) : imperial ? 4.536 : 5;
    const stepLabel = gaining ? (imperial ? '5 lb' : '2 kg') : imperial ? '10 lb' : '5 kg';
    const shown = (kg: number) => (imperial ? (kg / 0.45359237).toFixed(1) : kg.toFixed(1));
    add({
      key: 'first-step',
      title: `First ${stepLabel}`,
      icon: gaining ? 'chart' : 'trendDown',
      color: 'good',
      value: i.movedKg,
      target: stepKg,
      count: `${shown(Math.min(i.movedKg, stepKg))} / ${shown(stepKg).replace(/\.0$/, '')}`,
      hint: i.movedKg >= stepKg ? `Your trend has moved ${stepLabel}.` : `Your trend weight moving ${stepLabel} towards your goal.`,
    });
    add({
      key: 'halfway',
      title: 'Halfway',
      icon: 'flag',
      color: 'accent',
      value: i.journeyFraction,
      target: 0.5,
      count: `${Math.round(Math.min(0.5, i.journeyFraction) * 100)} / 50%`,
      hint: i.journeyFraction >= 0.5 ? 'Halfway to your goal weight.' : 'Your trend halfway from where you started to your goal.',
    });
    add({
      key: 'goal',
      title: 'Goal weight',
      icon: 'star',
      color: 'carbs',
      value: i.journeyFraction,
      target: 1,
      count: `${Math.round(i.journeyFraction * 100)}%`,
      hint: i.journeyFraction >= 1 ? 'You reached your goal weight.' : 'Your trend weight reaching your goal.',
    });
  }
  add({
    key: 'checkins',
    title: '4 check-ins',
    icon: 'pulse',
    color: 'accent',
    value: i.checkins,
    target: 4,
    count: `${Math.min(4, i.checkins)} / 4`,
    hint: i.checkins >= 4 ? 'A month of weekly check-ins.' : 'Do your weekly check-in 4 times.',
  });
  return out;
}

/** Close enough to glow: 80% of the way and not earned yet. */
export const isNear = (b: Badge) => !b.done && b.progress >= 0.8;

/** Earned milestones (by key) you haven't seen yet. With no record (first visit), nothing is new: old ones don't celebrate. */
export function newlyEarned(earned: string[], seen: string[] | null): string[] {
  if (seen === null) return [];
  return earned.filter((k) => !seen.includes(k));
}
