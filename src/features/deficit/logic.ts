import type { Checkin } from '@/features/checkin/logic';
import type { DaySummary } from '@/features/dashboard/api';
import { addDays, fromISODate, toISODate } from '@/lib/dates';
import { formatInt } from '@/lib/format';

/**
 * Your deficit for a day: what you burned (your expenditure estimate, plus
 * exercise when you add it to your budget) minus what you ate. Positive is a
 * deficit, negative a surplus.
 */

/** About 7,700 kcal of deficit for each kg of body fat lost. */
export const KCAL_PER_KG = 7700;

/** When a check-in's estimate was made: the day you did it. */
const doneOn = (c: Checkin) => (c.created_at ? toISODate(new Date(c.created_at)) : c.week_start);

/**
 * Your expenditure on a day. The check-in after it reviewed that stretch of
 * days, so its estimate is used; days since your last check-in use today's.
 */
export function expenditureOn(date: string, checkins: Checkin[], current: number): number {
  const later = checkins
    .filter((c) => doneOn(c) > date && c.expenditure_kcal !== null)
    .sort((a, b) => (doneOn(a) < doneOn(b) ? -1 : 1));
  return later[0]?.expenditure_kcal ?? current;
}

export type DeficitDay = {
  date: string;
  /** Expenditure, plus the day's exercise if you add exercise to your budget. */
  burn: number;
  eaten: number;
  /** burn − eaten, or null when nothing was logged. */
  deficit: number | null;
  /** What eating exactly your budget would have given: burn − budget. */
  planned: number;
  isToday: boolean;
  /** Today, not finished yet: the deficit is "so far" and will shrink as you eat. */
  partial: boolean;
};

export function deficitDay(input: {
  date: string;
  today: string;
  summary: Pick<DaySummary, 'kcal_in' | 'kcal_out' | 'food_entries' | 'closed'> | undefined;
  expenditure: number;
  budget: number;
  addback: boolean;
  /** Whether you've finished the day, when known apart from the summary. */
  closed?: boolean;
}): DeficitDay {
  const s = input.summary;
  const exercise = input.addback ? (s?.kcal_out ?? 0) : 0;
  const burn = input.expenditure + exercise;
  const eaten = s?.kcal_in ?? 0;
  const logged = (s?.food_entries ?? 0) > 0;
  const isToday = input.date === input.today;
  return {
    date: input.date,
    burn,
    eaten,
    deficit: logged ? burn - eaten : null,
    planned: burn - (input.budget + exercise),
    isToday,
    partial: isToday && !(input.closed ?? s?.closed),
  };
}

/** The last 7 days, ending today. */
export function deficitWeek(input: {
  today: string;
  summaries: Record<string, DaySummary>;
  expenditureFor: (date: string) => number;
  budgetFor: (date: string) => number;
  addback: boolean;
}): DeficitDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = toISODate(addDays(fromISODate(input.today), i - 6));
    return deficitDay({
      date,
      today: input.today,
      summary: input.summaries[date],
      expenditure: input.expenditureFor(date),
      budget: input.budgetFor(date),
      addback: input.addback,
    });
  });
}

export type DeficitTotal = {
  /** Sum over finished logged days (today counts once you finish it). */
  total: number;
  days: number;
  average: number;
  /** Roughly how much fat that is, in kg (negative for a surplus). */
  kg: number;
};

/** The week's total over days that are done and logged, or null when there are none. */
export function deficitTotal(days: DeficitDay[]): DeficitTotal | null {
  const done = days.filter((d): d is DeficitDay & { deficit: number } => d.deficit !== null && !d.partial);
  if (done.length === 0) return null;
  const total = done.reduce((s, d) => s + d.deficit, 0);
  return { total, days: done.length, average: total / done.length, kg: total / KCAL_PER_KG };
}

/** "Deficit", "Surplus" or "Even" for a number of kcal (within 25 kcal is even). */
export const balanceWord = (kcal: number) => (Math.abs(kcal) < 25 ? 'Even' : kcal > 0 ? 'Deficit' : 'Surplus');

/** "640 kcal deficit", "120 kcal surplus" or "about even". */
export const balanceText = (kcal: number) => (balanceWord(kcal) === 'Even' ? 'about even' : `${formatInt(Math.abs(kcal))} kcal ${balanceWord(kcal).toLowerCase()}`);
