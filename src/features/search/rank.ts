import type { ExternalFood } from '@/features/search/types';

const words = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

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
  return score;
}

const dedupeKey = (f: ExternalFood) => `${words(f.name).join(' ')}|${words(f.brand ?? '').join(' ')}|${Math.round(f.kcal_100g)}`;

/** Merges results from both databases: best match first, duplicates and poor matches dropped. */
export function rankResults(query: string, foods: ExternalFood[], limit = 25): ExternalFood[] {
  const seen = new Set<string>();
  return foods
    .map((f, i) => ({ f, i, score: relevance(query, f) }))
    .filter((x) => x.score > -2)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .filter(({ f }) => {
      const k = dedupeKey(f);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, limit)
    .map((x) => x.f);
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
