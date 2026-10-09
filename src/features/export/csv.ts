import type { WeighIn } from '@/lib/trend';
import { trendSeries } from '@/lib/trend';

/** One cell: quoted when it holds a comma, quote or line break; text that a spreadsheet would run as a formula is defused. */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(Math.round(v * 100) / 100) : '';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** A whole file. Starts with a byte-order mark so Excel reads accents and symbols correctly. */
export function toCsv(headers: string[], rows: unknown[][]): string {
  return '﻿' + [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

type Row = Record<string, unknown>;
const time = (iso: unknown) => (typeof iso === 'string' && iso.length >= 16 ? new Date(iso).toTimeString().slice(0, 5) : '');

export const EVERYTHING_HEADERS = [
  'date', 'time', 'type', 'meal', 'name', 'brand', 'amount', 'unit', 'grams',
  'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'weight_kg', 'water_ml', 'minutes', 'kcal_burned',
];

/** Every food, weigh-in, drink and workout as one list, oldest first: filter by `type` in a spreadsheet. */
export function everythingRows(input: { food: Row[]; weight: Row[]; water: Row[]; exercise: Row[] }): unknown[][] {
  const rows: { sort: string; cells: unknown[] }[] = [];
  for (const f of input.food) {
    rows.push({
      sort: `${f.log_date} ${time(f.logged_at)} 1`,
      cells: [f.log_date, time(f.logged_at), 'food', f.meal, f.name, f.brand, f.quantity, f.unit, f.grams, f.kcal, f.protein_g, f.carbs_g, f.fat_g, f.fiber_g, null, null, null, null],
    });
  }
  for (const w of input.weight) rows.push({ sort: `${w.log_date} 00:00 0`, cells: [w.log_date, '', 'weight', '', '', '', '', '', '', '', '', '', '', '', w.weight_kg, '', '', ''] });
  for (const w of input.water) {
    rows.push({ sort: `${w.log_date} ${time(w.logged_at)} 2`, cells: [w.log_date, time(w.logged_at), 'water', '', '', '', '', '', '', '', '', '', '', '', '', w.amount_ml, '', ''] });
  }
  for (const e of input.exercise) {
    rows.push({
      sort: `${e.log_date} ${time(e.created_at)} 3`,
      cells: [e.log_date, time(e.created_at), 'exercise', '', e.name, '', '', '', '', '', '', '', '', '', '', '', e.duration_min, e.kcal_burned],
    });
  }
  return rows.sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0)).map((r) => r.cells);
}

export const DAILY_HEADERS = [
  'date', 'kcal_in', 'budget', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'food_entries', 'kcal_burned', 'water_ml', 'finished', 'weight_kg', 'trend_kg',
];

/** One row per day you logged anything or weighed in, with your trend weight and that day's budget. */
export function dailyRows(summaries: Row[], weighIns: WeighIn[], budgetOn: (date: string) => number): unknown[][] {
  const trend = new Map(trendSeries(weighIns).map((p) => [p.date, p]));
  const dates = new Set<string>([...summaries.map((s) => s.log_date as string), ...weighIns.map((w) => w.date)]);
  const byDate = new Map(summaries.map((s) => [s.log_date as string, s]));
  return [...dates].sort().map((date) => {
    const s = byDate.get(date);
    const w = trend.get(date);
    return [
      date,
      s?.kcal_in ?? 0,
      budgetOn(date),
      s?.protein_g ?? 0,
      s?.carbs_g ?? 0,
      s?.fat_g ?? 0,
      s?.fiber_g ?? 0,
      s?.food_entries ?? 0,
      s?.kcal_out ?? 0,
      s?.water_ml ?? 0,
      Boolean(s?.closed),
      w?.kg ?? null,
      w ? Math.round(w.trend * 100) / 100 : null,
    ];
  });
}

export const FOOD_HEADERS = ['name', 'brand', 'source', 'barcode', 'kcal_100g', 'protein_100g', 'carbs_100g', 'fat_100g', 'fiber_100g', 'serving', 'serving_g'];

export function foodRows(foods: Row[]): unknown[][] {
  return [...foods]
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    .map((f) => [f.name, f.brand, f.source, f.barcode, f.kcal_100g, f.protein_100g, f.carbs_100g, f.fat_100g, f.fiber_100g, f.default_serving_label, f.default_serving_g]);
}

export const CHECKIN_HEADERS = ['week_start', 'days_logged', 'avg_intake_kcal', 'trend_change_kg', 'expenditure_kcal', 'old_budget', 'suggested_budget', 'new_budget', 'decision'];

export function checkinRows(checkins: Row[]): unknown[][] {
  return [...checkins]
    .sort((a, b) => (String(a.week_start) < String(b.week_start) ? -1 : 1))
    .map((c) => [c.week_start, c.days_logged, c.avg_intake_kcal, c.trend_change_kg, c.expenditure_kcal, c.old_target, c.suggested_target, c.new_target, c.decision]);
}
