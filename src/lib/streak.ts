import { addDays, fromISODate, toISODate } from '@/lib/dates';

export type Streaks = {
  /** Consecutive finished days up to today (or yesterday, if today isn't finished yet). */
  current: number;
  best: number;
  closedToday: boolean;
};

/** Counts "Finish today" streaks from the list of closed days (YYYY-MM-DD). */
export function streaks(closedDays: string[], today: string): Streaks {
  const closed = new Set(closedDays);
  const closedToday = closed.has(today);

  let current = 0;
  let cursor = closedToday ? fromISODate(today) : addDays(fromISODate(today), -1);
  while (closed.has(toISODate(cursor))) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  let best = 0;
  for (const day of closed) {
    // Only start counting at the first day of each run.
    if (closed.has(toISODate(addDays(fromISODate(day), -1)))) continue;
    let run = 0;
    let d = fromISODate(day);
    while (closed.has(toISODate(d))) {
      run += 1;
      d = addDays(d, 1);
    }
    best = Math.max(best, run);
  }

  return { current, best: Math.max(best, current), closedToday };
}
