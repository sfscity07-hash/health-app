import { daysBetween } from '@/lib/dates';

export type WeighIn = { date: string; kg: number };
export type TrendPoint = WeighIn & { trend: number };

/** How much each new day pulls the trend toward the scale (MacroFactor-style smoothing). */
export const TREND_ALPHA = 0.1;

/**
 * Smooths noisy daily weigh-ins into a trend line (an exponential moving
 * average). Missing days count: a weigh-in after a 3-day gap moves the
 * trend as much as 3 daily weigh-ins would have.
 */
export function trendSeries(weighIns: WeighIn[], alpha = TREND_ALPHA): TrendPoint[] {
  const sorted = [...weighIns].sort((a, b) => (a.date < b.date ? -1 : 1));
  const out: TrendPoint[] = [];
  for (const w of sorted) {
    const prev = out[out.length - 1];
    if (!prev) {
      out.push({ ...w, trend: w.kg });
      continue;
    }
    const days = Math.max(1, daysBetween(prev.date, w.date));
    const weight = 1 - Math.pow(1 - alpha, days);
    out.push({ ...w, trend: prev.trend + weight * (w.kg - prev.trend) });
  }
  return out;
}

/** Trend change over the last 7 days in kg/week, or null with less than a week of data. */
export function weeklyRate(points: TrendPoint[]): number | null {
  const last = points[points.length - 1];
  if (!last) return null;
  const weekAgo = [...points].reverse().find((p) => daysBetween(p.date, last.date) >= 7);
  if (!weekAgo) return null;
  return ((last.trend - weekAgo.trend) / daysBetween(weekAgo.date, last.date)) * 7;
}

/**
 * The next round-number milestone between the current trend and the goal,
 * every 2.5 kg (e.g. 82.5 when going from 83.1 down to 78).
 */
export function nextMilestone(trendKg: number, goalKg: number, step = 2.5): number | null {
  if (Math.abs(trendKg - goalKg) < 0.05) return null;
  const down = goalKg < trendKg;
  const m = down ? Math.floor((trendKg - 0.05) / step) * step : Math.ceil((trendKg + 0.05) / step) * step;
  return down ? Math.max(m, goalKg) : Math.min(m, goalKg);
}
