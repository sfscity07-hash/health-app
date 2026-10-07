import { standardWord } from '@/features/search/spelling';
import type { ExternalFood } from '@/features/search/types';

const words = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(standardWord);

/** Results scoring below this don't match what you typed. */
export const MIN_RELEVANCE = -2;

/**
 * How well a result fits the search. Every word you typed should appear
 * (in the name or brand); names that start with your words and short,
 * plain names ("Bananas, raw") beat long product names, and whole foods get
 * a nudge for short searches like "banana".
 */
export function relevance(query: string, f: ExternalFood): number {
  const q = words(query);
  if (q.length === 0) return 0;
  const name = words(f.name);
  const brand = words(f.brand ?? '');
  const has = (t: string, list: string[]) => list.some((w) => w.startsWith(t) || (t.length > 3 && w.startsWith(t.replace(/s$/, ''))));
  let score = 0;
  for (const t of q) {
    if (has(t, name)) score += 2;
    else if (has(t, brand)) score += 1.5;
    else score -= 4;
  }
  if (name.slice(0, q.length).join(' ').startsWith(q.join(' '))) score += 3;
  else if (name[0] && has(q[0], [name[0]])) score += 1.5;
  score -= Math.min(3, Math.max(0, name.length - q.length) * 0.3);
  if (f.generic && q.length <= 2) score += 1;
  if (f.generic && name.includes('raw')) score += 0.5;
  // Up to +1 for products thousands of people scan.
  if (f.popularity) score += Math.min(1, Math.log10(f.popularity + 1) / 3);
  return score;
}

/** Words that don't change what a food is, including shop labels like "Fairtrade" or "Finest". */
const FILLER = new Set([
  'and', 'or', 'with', 'the', 'of', 'a', 'an', 'in', 'as', 'to', 'from', 'for', 'by', 'ns', 'nfs', 'made',
  'organic', 'fresh', 'fairtrade', 'loose', 'british', 'premium', 'finest', 'selected',
]);
/** Pack sizes and counts: "400g", "750", "x6", "6x", "pack". */
const SIZE = /^(x\d+|\d+([.,]\d+)?(g|gr|kg|mg|ml|cl|dl|l|oz|lb|lbs|x|pk|ct|pcs)?)$/;
const UNITS = new Set(['g', 'gr', 'kg', 'ml', 'cl', 'l', 'oz', 'lb', 'lbs', 'x', 'pack', 'pk', 'ct', 'pcs', 'multipack']);

/** "bananas" → "banana", "tomatoes" → "tomato", "berries" → "berry"; leaves "glass" and short words alone. */
function singular(w: string): string {
  if (w.length <= 3 || w.endsWith('ss') || w.endsWith('us')) return w;
  if (w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (/(oes|ches|shes|xes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s')) return w.slice(0, -1);
  return w;
}

/** The words that say what a food is, for telling duplicates apart. */
export function nameTokens(name: string): string[] {
  return [...new Set(words(name).filter((w) => !FILLER.has(w) && !UNITS.has(w) && !SIZE.test(w)).map(singular))];
}

/** Share of the shorter name's words that the other name also has. */
function overlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const other = new Set(b);
  return a.filter((t) => other.has(t)).length / Math.min(a.length, b.length);
}

const near = (a: number, b: number, abs: number, rel: number) => Math.abs(a - b) <= Math.max(abs, rel * Math.max(a, b));

type Comparable = Pick<ExternalFood, 'name' | 'kcal_100g' | 'protein_100g' | 'carbs_100g' | 'fat_100g'> & { brand?: string | null };

const brandKey = (b: string | null | undefined) => words(b ?? '').join('');
const sameWords = (a: string[], b: string[]) => a.length === b.length && a.every((t) => b.includes(t));

/**
 * Two results are the same food when their names overlap ("Banana, raw" and
 * "Bananas, ripe and slightly ripe, raw"; "Nutella" and "Nutella 750g") and
 * their numbers per 100 g match to within a few percent. Same name with
 * different numbers (0% vs 2% yogurt, raw vs fried) stays separate, except
 * for one brand's product listed twice under exactly the same name: that's a
 * copy with mistyped numbers (often per serving entered as per 100 g).
 */
export function sameFood(a: Comparable, b: Comparable): boolean {
  const brand = brandKey(a.brand);
  if (brand && brand === brandKey(b.brand) && sameWords(nameTokens(a.name), nameTokens(b.name))) return true;
  if (!near(a.kcal_100g, b.kcal_100g, 10, 0.08)) return false;
  const macrosMatch = (['protein_100g', 'carbs_100g', 'fat_100g'] as const).every((k) => near(a[k], b[k], 2, 0.15));
  return macrosMatch && overlap(nameTokens(a.name), nameTokens(b.name)) >= 0.75;
}

/** Keeps the better result, borrowing a serving or fibre value from its duplicate when it lacks one. */
function absorb(keep: ExternalFood, dup: ExternalFood): ExternalFood {
  let out = keep;
  if (!out.serving && dup.serving) out = { ...out, serving: dup.serving, servings: dup.servings };
  if (out.fiber_100g === null && dup.fiber_100g !== null) out = { ...out, fiber_100g: dup.fiber_100g };
  return out;
}

/**
 * Merges results from both databases: best match first, poor matches dropped,
 * each food once. A result joins a group when it matches any food already in
 * it, so "Fairtrade Bananas" finds "Bananas" even though the group shows
 * "Bananas, raw".
 */
export function rankResults(query: string, foods: ExternalFood[], limit = 25): ExternalFood[] {
  const sorted = foods
    .map((f, i) => ({ f, i, score: relevance(query, f) }))
    .filter((x) => x.score > MIN_RELEVANCE)
    .sort((a, b) => b.score - a.score || a.i - b.i);
  const groups: { shown: ExternalFood; members: ExternalFood[] }[] = [];
  for (const { f } of sorted) {
    const group = groups.find((g) => g.members.some((m) => sameFood(m, f)));
    if (group) {
      group.shown = absorb(group.shown, f);
      group.members.push(f);
    } else if (groups.length < limit) {
      groups.push({ shown: f, members: [f] });
    }
  }
  return groups.map((g) => g.shown);
}

/**
 * Drops database results you already have above them in the logger: a food
 * you've logged before (same USDA or Open Food Facts entry) or one of your
 * own foods with the same name and numbers.
 */
export function withoutLocal(results: ExternalFood[], loggedKeys: Set<string>, ownFoods: Comparable[]): ExternalFood[] {
  return results.filter((f) => !loggedKeys.has(f.key) && !ownFoods.some((o) => sameFood(o, f)));
}

/** Puts the two lists in one order before ranking, so ties alternate between sources. */
export function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}
