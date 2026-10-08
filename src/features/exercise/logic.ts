import type { RulerScale } from '@/components/food/PortionRuler';
import { parseNumber } from '@/features/onboarding/draft';

/** One activity from the built-in list (the `exercises` table). */
export type Activity = { id: number; name: string; category: string; met: number };

/** One logged workout (a row of `exercise_logs`). */
export type Workout = {
  id: string;
  log_date: string;
  exercise_id: number | null;
  name: string;
  duration_min: number | null;
  kcal_burned: number;
  created_at: string;
};

/** What the database accepts. */
export const MAX_MINUTES = 1440;
export const MAX_KCAL = 10000;
export const DEFAULT_MINUTES = 30;
/** Used for calories until there's a weigh-in. */
export const FALLBACK_KG = 70;

/**
 * Active calories: what the activity burns on top of what you'd burn resting
 * anyway, (MET − 1) × kg × hours. This is the number watches call "active
 * calories", and the right one to add to a budget that already covers resting.
 */
export function activeKcal(met: number, kg: number, minutes: number): number {
  return Math.max(0, Math.round((met - 1) * kg * (minutes / 60)));
}

/** How hard an activity is, in words, from its MET value. */
export function intensity(met: number): string {
  if (met < 3) return 'Light';
  if (met < 6) return 'Moderate';
  if (met < 9) return 'Hard';
  return 'Very hard';
}

/** "45 min", "1 h", "1 h 30 min". */
export function describeDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** The second line under a workout: how long, or that only the calories were typed in. */
export function workoutDetail(w: Pick<Workout, 'duration_min'>): string {
  return w.duration_min ? describeDuration(w.duration_min) : 'Calories typed in';
}

export function workoutTotals(workouts: Pick<Workout, 'kcal_burned' | 'duration_min'>[]) {
  return {
    kcal: workouts.reduce((s, w) => s + w.kcal_burned, 0),
    minutes: workouts.reduce((s, w) => s + (w.duration_min ?? 0), 0),
    count: workouts.length,
  };
}

/** "2 workouts · 1 h 15 min", or "1 workout" when there are no minutes. */
export function workoutSummary(workouts: Pick<Workout, 'kcal_burned' | 'duration_min'>[]): string {
  const t = workoutTotals(workouts);
  const count = `${t.count} workout${t.count === 1 ? '' : 's'}`;
  return t.minutes ? `${count} · ${describeDuration(t.minutes)}` : count;
}

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** Everyday words for activities on the list. */
const SYNONYMS: Record<string, string[]> = {
  gym: ['weight', 'strength'],
  lift: ['weight'],
  lifting: ['weight'],
  jog: ['running'],
  jogging: ['running'],
  spin: ['stationary'],
  bike: ['cycling'],
  biking: ['cycling'],
  walk: ['hiking'],
  soccer: ['football'],
};

/** Ways a typed word can match: itself, without a plural "s", and its everyday synonyms. */
const forms = (w: string) => [w, ...(w.length > 3 && w.endsWith('s') ? [w.slice(0, -1)] : []), ...(SYNONYMS[w] ?? [])];

/** Every word you typed starts a word in the name or category ("run" finds "Running", "weights" finds "Weight training"). */
export function activityMatches(query: string, a: Pick<Activity, 'name' | 'category'>): boolean {
  const q = words(query);
  if (q.length === 0) return true;
  const have = words(`${a.name} ${a.category}`);
  return q.every((w) => forms(w).some((f) => have.some((h) => h.startsWith(f))));
}

/** The list grouped by category, in the list's own order, keeping only matches. */
export function groupActivities(list: Activity[], query = ''): { category: string; items: Activity[] }[] {
  const groups: { category: string; items: Activity[] }[] = [];
  for (const a of list) {
    if (!activityMatches(query, a)) continue;
    let g = groups.find((x) => x.category === a.category);
    if (!g) groups.push((g = { category: a.category, items: [] }));
    g.items.push(a);
  }
  return groups;
}

/** Your last few different workouts, newest first, for one-tap repeats. */
export function recentWorkouts(history: Workout[], limit = 5): Workout[] {
  const seen = new Set<string>();
  const out: Workout[] = [];
  const newest = [...history].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  for (const w of newest) {
    const key = w.exercise_id !== null ? `a${w.exercise_id}` : `n${w.name.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
    if (out.length === limit) break;
  }
  return out;
}

/** The add-back setting, worded the same in Profile and the exercise sheet. */
export const ADDBACK = {
  label: 'Add exercise to my budget',
  on: 'What you burn is added to that day’s budget, so you can eat it back.',
  off: 'Your budget stays the same on workout days. It already includes your usual activity, and watch numbers often run high.',
};

/** The duration ruler: 5-minute steps, labelled every half hour, up to 4 hours (type anything longer). */
export const DURATION_RULER: RulerScale = { label: 'min', step: 5, min: 0, max: 240, spacing: 12, major: 6 };

export function parseMinutes(text: string): { ok: true; minutes: number } | { ok: false; error: string } {
  const v = parseNumber(text);
  if (v === null || v < 1) return { ok: false, error: 'Type how many minutes, e.g. 45.' };
  const minutes = Math.round(v);
  if (minutes > MAX_MINUTES) return { ok: false, error: 'That’s more than a whole day. Check the number.' };
  return { ok: true, minutes };
}

export function parseKcal(text: string): { ok: true; kcal: number } | { ok: false; error: string } {
  const v = parseNumber(text);
  if (v === null) return { ok: false, error: 'Type the calories your watch or machine shows.' };
  const kcal = Math.round(v);
  if (kcal > MAX_KCAL) return { ok: false, error: `That’s over ${MAX_KCAL.toLocaleString('en-US')} kcal. Check the number.` };
  return { ok: true, kcal };
}
