import type { FoodWithServings } from '@/features/food/api';
import type { ExternalFood } from '@/features/search/types';
import { describeLogged, nutrientsFor, WHOLE_BATCH, type FoodRecord, type Nutrients, type Serving } from '@/lib/portion';

/**
 * Recipes: a food made from other foods. You list what went in (any food,
 * database food, another recipe, or a quick ingredient with just numbers),
 * optionally weigh the finished dish, and it becomes a food you can log by the
 * gram, by the serving or as a share of the batch.
 */

export type RecipeItem = {
  /** Stable key for lists. */
  key: string;
  /** The food it's measured from: a saved food or recipe, or (with `external`) a database result shown as a food. */
  food: FoodWithServings | null;
  /** A database food not saved yet; it's saved to your foods when the recipe is saved. */
  external: ExternalFood | null;
  name: string;
  brand: string | null;
  quantity: number;
  unit: string;
  /** Null for a quick ingredient without a weight. */
  grams: number | null;
  /** What this ingredient adds to the recipe. */
  nutrients: Nutrients;
};

export type RecipeDraft = {
  /** The recipe's food id when editing; null for a new one. */
  id: string | null;
  name: string;
  items: RecipeItem[];
  /** Weighed after cooking, in grams; null means the ingredients add up. */
  finalWeight: number | null;
  /** How many servings the batch makes, if you want a "serving" unit. */
  servings: number | null;
};

export { WHOLE_BATCH };
export const ZERO: Nutrients = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };

export const emptyDraft = (): RecipeDraft => ({ id: null, name: '', items: [], finalWeight: null, servings: null });

let counter = 0;
const nextKey = () => `i${Date.now().toString(36)}${(counter++).toString(36)}`;

export function totals(items: Pick<RecipeItem, 'nutrients'>[]): Nutrients {
  return items.reduce(
    (t, i) => ({
      kcal: t.kcal + i.nutrients.kcal,
      protein_g: t.protein_g + i.nutrients.protein_g,
      carbs_g: t.carbs_g + i.nutrients.carbs_g,
      fat_g: t.fat_g + i.nutrients.fat_g,
      fiber_g: t.fiber_g + i.nutrients.fiber_g,
    }),
    ZERO,
  );
}

/** What the ingredients weigh together (quick ingredients without a weight add nothing). */
export const rawWeight = (items: Pick<RecipeItem, 'grams'>[]) => items.reduce((w, i) => w + (i.grams ?? 0), 0);

/** The finished dish: what you weighed after cooking, or what the ingredients add up to. */
export const finishedWeight = (d: Pick<RecipeDraft, 'items' | 'finalWeight'>) => d.finalWeight ?? rawWeight(d.items);

const scale = (n: Nutrients, f: number): Nutrients => ({
  kcal: n.kcal * f,
  protein_g: n.protein_g * f,
  carbs_g: n.carbs_g * f,
  fat_g: n.fat_g * f,
  fiber_g: n.fiber_g * f,
});

/** Per 100 g of the finished dish, or null before it has a weight. */
export function per100(d: Pick<RecipeDraft, 'items' | 'finalWeight'>): Nutrients | null {
  const w = finishedWeight(d);
  return w > 0 ? scale(totals(d.items), 100 / w) : null;
}

export function perServing(d: Pick<RecipeDraft, 'items' | 'servings'>): Nutrients | null {
  return d.servings && d.servings > 0 ? scale(totals(d.items), 1 / d.servings) : null;
}

/** An ingredient from a food, at an amount. */
export function itemFromFood(food: FoodWithServings, quantity: number, unit: string, grams: number, external: ExternalFood | null = null): RecipeItem {
  return { key: nextKey(), food, external, name: food.name, brand: food.brand, quantity, unit, grams, nutrients: nutrientsFor(food, grams) };
}

/** A quick ingredient: just a name and its numbers (a splash of oil, a spice mix). */
export function quickItem(name: string, nutrients: Nutrients, grams: number | null): RecipeItem {
  return { key: nextKey(), food: null, external: null, name, brand: null, quantity: grams ?? 1, unit: grams ? 'g' : 'serving', grams, nutrients };
}

/**
 * Swaps an ingredient for another food, keeping the same weight: 200 g of
 * paneer becomes 200 g of soya chaap. Without a weight, it starts at the new
 * food's usual amount.
 */
export function swapItem(item: RecipeItem, food: FoodWithServings, external: ExternalFood | null = null): RecipeItem {
  const grams = item.grams ?? food.default_serving_g ?? 100;
  return { ...itemFromFood(food, grams, 'g', grams, external), key: item.key };
}

/** "200 g", "2 tbsp · 28 g", or "Quick ingredient". */
export function describeItem(item: Pick<RecipeItem, 'food' | 'external' | 'quantity' | 'unit' | 'grams'>): string {
  if (!item.food && !item.external) return item.grams ? `${Math.round(item.grams)} g · quick ingredient` : 'Quick ingredient';
  return describeLogged(item.quantity, item.unit, item.unit === 'g' ? null : item.grams);
}

/** A sentence saying what's wrong with the recipe, or null when it can be saved. */
export function recipeProblem(d: RecipeDraft): string | null {
  if (!d.name.trim()) return 'Give the recipe a name.';
  if (d.items.length === 0) return 'Add at least one ingredient.';
  const w = finishedWeight(d);
  if (w <= 0) return 'Add ingredients by weight, or enter what the finished dish weighs.';
  const t = totals(d.items);
  if (t.protein_g + t.carbs_g + t.fat_g > w) return 'The finished weight is less than the protein, carbs and fat in it. Check the weight.';
  if (d.servings !== null && d.servings <= 0) return 'Servings should be at least one.';
  return null;
}

const cap = (v: number, max: number) => Math.round(Math.min(max, Math.max(0, v)) * 100) / 100;

/** The recipe as a food: per-100 g numbers, and one serving (or 100 g) as the usual amount. */
export function recipeFood(d: RecipeDraft): Pick<FoodRecord, 'name' | 'kcal_100g' | 'protein_100g' | 'carbs_100g' | 'fat_100g' | 'fiber_100g' | 'default_serving_g' | 'default_serving_label'> {
  const p = per100(d) ?? ZERO;
  const w = finishedWeight(d);
  const serving = d.servings ? w / d.servings : null;
  return {
    name: d.name.trim().slice(0, 200),
    kcal_100g: cap(p.kcal, 1000),
    protein_100g: cap(p.protein_g, 100),
    carbs_100g: cap(p.carbs_g, 100),
    fat_100g: cap(p.fat_g, 100),
    fiber_100g: cap(p.fiber_g, 100),
    default_serving_g: serving ? Math.round(serving * 10) / 10 : 100,
    default_serving_label: serving ? 'serving' : null,
  };
}

/** Units the recipe can be logged in besides grams: the whole batch (and a serving, via the default). */
export function recipeUnits(d: RecipeDraft): Serving[] {
  const w = finishedWeight(d);
  return w > 0 ? [{ label: WHOLE_BATCH, grams: Math.round(w * 10) / 10 }] : [];
}

/** "Paneer marinade" → "Paneer marinade (copy)". */
export const copyName = (name: string) => (/\(copy\)$/i.test(name.trim()) ? name.trim() : `${name.trim()} (copy)`);

export type Part = {
  key: string;
  name: string;
  /** Grams of it in the portion (as it went in), or null when it has no weight. */
  grams: number | null;
  /** Its share of the calories, 0–1. */
  share: number;
  /** 0 for the biggest; null for the "N more" group. */
  rank: number | null;
};

/**
 * Where a recipe's calories come from, biggest first, scaled to a portion
 * (`scale` = portion grams ÷ finished weight). Past `top` ingredients the
 * rest are grouped as "N more" (a lone extra one keeps its name).
 */
export function composition(items: Pick<RecipeItem, 'key' | 'name' | 'grams' | 'nutrients'>[], scale: number, top = 4): Part[] {
  const total = items.reduce((s, i) => s + Math.max(0, i.nutrients.kcal), 0);
  const share = (kcal: number) => (total > 0 ? Math.max(0, kcal) / total : 0);
  const sorted = [...items].sort((a, b) => b.nutrients.kcal - a.nutrients.kcal);
  const named = sorted.length <= top + 1 ? sorted : sorted.slice(0, top);
  const parts: Part[] = named.map((i, rank) => ({ key: i.key, name: i.name, grams: i.grams === null ? null : i.grams * scale, share: share(i.nutrients.kcal), rank }));
  const rest = sorted.slice(named.length);
  if (rest.length > 0) {
    const weighed = rest.filter((i) => i.grams !== null);
    parts.push({
      key: 'rest',
      name: `${rest.length} more`,
      grams: weighed.length ? weighed.reduce((s, i) => s + (i.grams ?? 0), 0) * scale : null,
      share: rest.reduce((s, i) => s + share(i.nutrients.kcal), 0),
      rank: null,
    });
  }
  return parts;
}
