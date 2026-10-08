import { addDays, toISODate, weekOf } from '@/lib/dates';
import { countsAsLogged, type DayIntake } from '@/lib/expenditure';
import type { Goal } from '@/types/profile';

export type CheckinDecision = 'accepted' | 'adjusted' | 'kept';

/** One weekly check-in (a row of `checkins`). `week_start` is the Monday of the week the new budget is for. */
export type Checkin = {
  week_start: string;
  days_logged: number;
  avg_intake_kcal: number | null;
  trend_change_kg: number | null;
  expenditure_kcal: number | null;
  old_target: number;
  suggested_target: number;
  new_target: number;
  decision: CheckinDecision;
  /** When you did it; the new budget applies from that day. */
  created_at?: string;
};

/** The day a check-in's budget started: the day you did it. */
const startedOn = (c: Checkin) => (c.created_at ? toISODate(new Date(c.created_at)) : c.week_start);

/**
 * The calorie budget that applied on a day. Budgets change at check-ins, so
 * an old day is judged against the budget you had then, not today's.
 */
export function budgetOn(date: string, checkins: Checkin[], current: number): number {
  const later = checkins.filter((c) => startedOn(c) > date).sort((a, b) => (startedOn(a) < startedOn(b) ? -1 : 1));
  return later.length ? later[0].old_target : current;
}

/** The Monday of this week, which keys this week's check-in. */
export const checkinWeek = (today: Date) => toISODate(weekOf(today)[0]);

/** The 7 days a check-in looks back on: the week ending yesterday. */
export function reviewDates(today: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => toISODate(addDays(today, i - 7)));
}

/**
 * A check-in is due once a week: from Monday, until you've done this week's.
 * Not in your first (part) week, since there's nothing to look back on yet.
 */
export function isCheckinDue(input: { today: Date; onboardedAt: string | null; checkins: Pick<Checkin, 'week_start'>[] }): boolean {
  const week = checkinWeek(input.today);
  if (input.checkins.some((c) => c.week_start === week)) return false;
  if (!input.onboardedAt) return false;
  return toISODate(new Date(input.onboardedAt)) < week;
}

/** The last check-in before this week's: its expenditure is where the new estimate starts from. */
export function previousCheckin(checkins: Checkin[], week: string): Checkin | null {
  const before = checkins.filter((c) => c.week_start < week).sort((a, b) => (a.week_start < b.week_start ? -1 : 1));
  return before[before.length - 1] ?? null;
}

export type WeekReview = {
  /** For each of the 7 days, oldest first: whether it counts as logged. */
  logged: { date: string; logged: boolean; kcal: number }[];
  daysLogged: number;
  avgIntake: number | null;
};

export function reviewWeek(dates: string[], days: DayIntake[], typicalKcal: number): WeekReview {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const logged = dates.map((date) => {
    const d = byDate.get(date);
    return { date, logged: d ? countsAsLogged(d, typicalKcal) : false, kcal: d?.kcal ?? 0 };
  });
  const counted = logged.filter((d) => d.logged);
  return {
    logged,
    daysLogged: counted.length,
    avgIntake: counted.length ? Math.round(counted.reduce((s, d) => s + d.kcal, 0) / counted.length) : null,
  };
}

/** A sentence about your logging week. Never a telling-off. */
export function consistencyText(daysLogged: number): string {
  if (daysLogged === 7) return 'A perfect week. Every logged day makes your numbers sharper.';
  if (daysLogged >= 5) return 'A solid week. Fuel works around the odd missing day.';
  if (daysLogged >= 1) return 'A few days are missing. Fuel only uses the days you logged, so the estimate is still fair, just slower to learn.';
  return 'Nothing logged this week. Your budget stays on the estimate until you log a few days.';
}

/** How the week's trend compares with your plan, in a sentence. */
export function paceText(input: { goal: Goal | null; changeKg: number | null; planKgPerWeek: number | null; weight: (kg: number) => string }): string {
  const { goal, changeKg, planKgPerWeek, weight } = input;
  if (changeKg === null) return 'Weigh in a few mornings this week to see your trend.';
  const moved = Math.abs(changeKg);
  if (goal === 'maintain') return moved < 0.25 ? 'Holding steady, right where you want it.' : 'A small drift. Your new budget below allows for it.';
  const wantDown = goal === 'lose' || goal === 'recomp';
  const rightWay = wantDown ? changeKg < 0 : changeKg > 0;
  if (moved < 0.05) return 'Flat this week. One week can hide progress in water; the budget below allows for it.';
  if (!rightWay) return 'The trend moved the other way this week. The budget below adjusts for it.';
  if (!planKgPerWeek || goal === 'recomp') return 'Moving the right way.';
  const ratio = moved / planKgPerWeek;
  if (ratio > 1.3) return `Faster than your ${weight(planKgPerWeek)}/week plan.`;
  if (ratio < 0.7) return `A bit slower than your ${weight(planKgPerWeek)}/week plan. The budget below catches up.`;
  return `Right on your ${weight(planKgPerWeek)}/week plan.`;
}
