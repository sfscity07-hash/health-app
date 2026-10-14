import { isDish, kindOf, mentions } from '@/features/recipes/suggest';
import { fetchOffNutriments } from '@/features/search/off';
import { fetchUsdaDetails, searchUsda } from '@/features/search/usda';
import { microsFromOff, microsFromUsda, missingKeys, NO_ESTIMATE, type MicroEstimate, type MicroFood, type Micros } from '@/features/nutrients/micros';
import type { FoodRecord } from '@/lib/portion';

/**
 * Filling in what a food's label doesn't say. Foods saved before vitamins and
 * minerals were kept are looked up again by their USDA id or barcode; then,
 * for simple foods (yoghurt, milk, paneer, oats, dal…), anything still missing
 * is borrowed from USDA's generic version of the same food, as an estimate.
 * Nothing is borrowed for a protein bar or a biscuit: there's no honest
 * generic version of those.
 */

/** Products whose nutrients depend on the recipe, not on what kind of food they are. */
const PROCESSED =
  /\b(bars?|cookies?|biscuits?|cakes?|chips|crisps|sauce|mix|candy|chocolate|ice cream|drink|shake|noodles|namkeen|bhujia|pizza|burger|sandwich|wrap|cereal|granola|muesli|spread|dressing|soup|pickle|achar|chutney|supplement|powder|flavou?red|sweetened|fortified|protein)\b/i;

/** Indian names USDA knows by other words. */
const USDA_WORDS: Record<string, string> = {
  'toned milk': 'milk',
  'double toned milk': 'milk',
  'full cream milk': 'milk',
  curd: 'yogurt',
  dahi: 'yogurt',
  atta: 'whole wheat flour',
  besan: 'chickpea flour',
  maida: 'wheat flour',
  'toor dal': 'pigeon peas',
  'moong dal': 'mung beans',
  'chana dal': 'chickpeas',
  'masoor dal': 'lentils',
  rajma: 'kidney beans',
  chana: 'chickpeas',
};

/** What to look up in USDA to borrow from ("greek yogurt", "milk" for toned milk), or null when there's no honest generic version. */
export function borrowKind(name: string): string | null {
  if (PROCESSED.test(name) || isDish(name)) return null;
  const kind = kindOf(name);
  return kind ? (USDA_WORDS[kind] ?? kind) : null;
}

export type Generic = { name: string; kcal_100g: number; micros: Micros };

/** USDA versions that aren't the plain food. */
const NOT_PLAIN = /\b(sweetened|flavou?red|chocolate|strawberry|vanilla|fruit|honey|sugar|salted|with salt)\b/i;
/** Vitamins added by the maker (US milk and cereal): don't lend those to a product that may not have them. */
const FORTIFIED = (name: string) => /\b(with added|fortified|enriched)\b/i.test(name) && !/\b(not fortified|unfortified|unenriched|without added)\b/i.test(name);

/** The generic food closest in calories, if it's close enough to stand in (yoghurt for yoghurt, not for sweetened yoghurt). Unfortified versions first. */
export function closestGeneric(kind: string, kcal: number, candidates: Generic[]): Generic | null {
  const fits = candidates.filter((c) => mentions(kind, c.name) && !NOT_PLAIN.test(c.name) && Object.keys(c.micros).length >= 6);
  const rank = (c: Generic) => [Math.round(Math.abs(c.kcal_100g - kcal) / 15), FORTIFIED(c.name) ? 1 : 0, c.name.length];
  const best = [...fits].sort((a, b) => {
    const [x, y] = [rank(a), rank(b)];
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  })[0];
  if (!best) return null;
  const gap = Math.abs(best.kcal_100g - kcal);
  return gap <= Math.max(30, 0.35 * Math.max(best.kcal_100g, kcal)) ? best : null;
}

/** What to borrow: only what the food is missing, from a generic food that fits. */
export function borrow(food: MicroFood & { kcal_100g: number }, kind: string, candidates: Generic[]): MicroEstimate {
  const generic = closestGeneric(kind, food.kcal_100g, candidates);
  if (!generic) return NO_ESTIMATE;
  const values: Micros = {};
  for (const k of missingKeys(food)) if (generic.micros[k] !== undefined) values[k] = generic.micros[k];
  return Object.keys(values).length ? { by: 'usda', from: generic.name, values } : NO_ESTIMATE;
}

export type FoodUpdate = { id: string; micros?: Micros; micros_est?: MicroEstimate };

/** USDA's generic foods per kind, fetched once a session. */
const genericCache = new Map<string, Promise<Generic[]>>();

function genericsFor(kind: string, apiKey: string): Promise<Generic[]> {
  let cached = genericCache.get(kind);
  if (!cached) {
    cached = searchUsda(kind, apiKey).then((foods) =>
      foods.filter((f) => f.micros).map((f) => ({ name: f.name, kcal_100g: f.kcal_100g, micros: f.micros as Micros })),
    );
    // A failed search is tried again next time.
    cached.catch(() => genericCache.delete(kind));
    genericCache.set(kind, cached);
  }
  return cached;
}

/**
 * Looks up and estimates what it can for these foods (not recipes, which add
 * up their ingredients). Returns the changes to save; foods it couldn't reach
 * (offline, USDA limit) are left for next time.
 */
export async function fillFoods(foods: FoodRecord[], apiKey: string): Promise<FoodUpdate[]> {
  const updates = new Map<string, FoodUpdate>();
  const current = new Map(foods.map((f) => [f.id, { ...f }]));

  // 1. Look up the label numbers again for foods saved before they were kept.
  const unknown = foods.filter((f) => f.micros === null);
  const usda = unknown.filter((f) => f.source === 'usda' && f.external_id);
  if (usda.length) {
    try {
      const details = await fetchUsdaDetails(
        usda.map((f) => f.external_id as string),
        apiKey,
      );
      for (const f of usda) {
        const d = details.find((x) => String(x.fdcId) === f.external_id);
        if (!d) continue;
        const micros = microsFromUsda(d.foodNutrients);
        updates.set(f.id, { id: f.id, micros });
        (current.get(f.id) as FoodRecord).micros = micros;
      }
    } catch {
      // Offline or over the limit: try again another time.
    }
  }
  for (const f of unknown.filter((x) => x.source === 'off' && x.external_id)) {
    try {
      const n = await fetchOffNutriments(f.external_id as string);
      const micros = n ? microsFromOff(n) : {};
      updates.set(f.id, { id: f.id, micros });
      (current.get(f.id) as FoodRecord).micros = micros;
    } catch {
      // Try again another time.
    }
  }
  // Your own foods have what you typed, and nothing more to look up.
  for (const f of unknown.filter((x) => x.source === 'custom')) {
    updates.set(f.id, { id: f.id, micros: {} });
    (current.get(f.id) as FoodRecord).micros = {};
  }

  // 2. Borrow what's still missing from USDA's generic version of the same food.
  for (const f of current.values()) {
    if (f.micros === null || f.micros === undefined || f.micros_est) continue;
    const kind = borrowKind(f.name);
    const est = await (async () => {
      if (!kind || missingKeys(f).length === 0) return NO_ESTIMATE;
      try {
        return borrow(f, kind, await genericsFor(kind, apiKey));
      } catch {
        return null;
      }
    })();
    if (!est) continue;
    updates.set(f.id, { ...(updates.get(f.id) ?? { id: f.id }), micros_est: est });
  }
  return [...updates.values()];
}

/** Whether a food could still gain something from `fillFoods`. */
export const needsFill = (f: FoodRecord) => f.micros === null || (f.micros !== undefined && f.micros_est === null);
