import { Platform } from 'react-native';

import { budgetOn, type Checkin } from '@/features/checkin/logic';
import {
  CHECKIN_HEADERS,
  checkinRows,
  DAILY_HEADERS,
  dailyRows,
  EVERYTHING_HEADERS,
  everythingRows,
  FOOD_HEADERS,
  foodRows,
  toCsv,
} from '@/features/export/csv';
import { requireSupabase } from '@/lib/supabase';

type Row = Record<string, unknown>;
const PAGE = 1000;

/** Every row of a table you can see (only your own, by the privacy rules), a page at a time. */
async function fetchAll(table: string, select = '*', order = 'log_date'): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = requireSupabase().from(table).select(select).order(order);
    // A unique tiebreak keeps pages from skipping or repeating rows that share a date (the daily view has one row per date already).
    if (table !== 'daily_summary') query = query.order('id');
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < PAGE) return out;
  }
}

export type ExportKind = 'everything' | 'daily' | 'foods' | 'checkins';

export const EXPORTS: { kind: ExportKind; title: string; description: string }[] = [
  { kind: 'everything', title: 'Everything you logged', description: 'Every food, weigh-in, drink and workout, one row each, with the date and time.' },
  { kind: 'daily', title: 'Daily totals', description: 'One row per day: calories against that day’s budget, macros, fibre, exercise, water, and your scale and trend weight.' },
  { kind: 'foods', title: 'My foods', description: 'Foods you created or picked from a database, per 100 g, with their barcodes.' },
  { kind: 'checkins', title: 'Weekly check-ins', description: 'Each week’s expenditure estimate and the budget you chose.' },
];

/** Builds one export as CSV text, with a dated file name. */
export async function buildExport(kind: ExportKind, currentBudget: number): Promise<{ filename: string; csv: string; rows: number }> {
  const stamp = new Date().toISOString().slice(0, 10);
  const named = (name: string, headers: string[], rows: unknown[][]) => ({ filename: `fuel-${name}-${stamp}.csv`, csv: toCsv(headers, rows), rows: rows.length });

  switch (kind) {
    case 'everything': {
      const [food, weight, water, exercise] = await Promise.all([
        fetchAll('food_logs'),
        fetchAll('weight_logs'),
        fetchAll('water_logs'),
        fetchAll('exercise_logs'),
      ]);
      return named('everything', EVERYTHING_HEADERS, everythingRows({ food, weight, water, exercise }));
    }
    case 'daily': {
      const [summaries, weight, checkins] = await Promise.all([fetchAll('daily_summary'), fetchAll('weight_logs'), fetchAll('checkins', '*', 'week_start')]);
      const weighIns = weight.map((w) => ({ date: w.log_date as string, kg: Number(w.weight_kg) }));
      const list = checkins as unknown as Checkin[];
      return named('daily', DAILY_HEADERS, dailyRows(summaries, weighIns, (d) => budgetOn(d, list, currentBudget)));
    }
    case 'foods':
      return named('foods', FOOD_HEADERS, foodRows(await fetchAll('foods', '*', 'name')));
    case 'checkins':
      return named('checkins', CHECKIN_HEADERS, checkinRows(await fetchAll('checkins', '*', 'week_start')));
  }
}

/** Hands the file to Android's share sheet (save to Drive, email it…), or downloads it on the web. */
export async function shareCsv(filename: string, csv: string) {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const { File, Paths } = await import('expo-file-system');
  const Sharing = await import('expo-sharing');
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(csv);
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: filename, UTI: 'public.comma-separated-values-text' });
}
