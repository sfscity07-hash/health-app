import { daysBetween } from '@/lib/dates';
import type { Meal } from '@/lib/meals';

export type LoggedRow = {
  food_id: string | null;
  name: string;
  brand: string | null;
  quantity: number;
  unit: string;
  grams: number | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meal: Meal;
  log_date: string;
};

export type RecentFood = {
  key: string;
  foodId: string | null;
  name: string;
  brand: string | null;
  /** The amount you logged most recently, reused for one-tap logging. */
  last: LoggedRow;
  count: number;
};

/**
 * Foods you log often float up, especially ones you've had at this meal and
 * recently. Quick-add entries count as their own "food" by name and calories.
 */
export function rankRecents(rows: LoggedRow[], meal: Meal, today: string, limit = 12): RecentFood[] {
  const groups = new Map<string, { recent: RecentFood; score: number }>();
  // Rows come newest first, so the first row in each group is the latest amount.
  for (const r of rows) {
    const key = r.food_id ?? `quick:${r.name.toLowerCase()}|${Math.round(r.kcal)}`;
    const age = daysBetween(r.log_date, today);
    const weight = 1 + (r.meal === meal ? 2 : 0) + (age <= 3 ? 1 : 0);
    const g = groups.get(key);
    if (g) {
      g.recent.count += 1;
      g.score += weight;
    } else {
      groups.set(key, {
        recent: { key, foodId: r.food_id, name: r.name, brand: r.brand, last: r, count: 1 },
        score: weight,
      });
    }
  }
  return [...groups.values()]
    .sort((a, b) => b.score - a.score || (a.recent.last.log_date < b.recent.last.log_date ? 1 : -1))
    .slice(0, limit)
    .map((g) => g.recent);
}

/** Case-insensitive match on name and brand. */
export function matches(query: string, name: string, brand?: string | null): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${name} ${brand ?? ''}`.toLowerCase().includes(q);
}
