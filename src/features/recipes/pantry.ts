import { isDish, kindOf, mentions } from '@/features/recipes/suggest';
import { fromISODate } from '@/lib/dates';
import type { FoodRecord } from '@/lib/portion';

/**
 * Your pantry, learned from what you use: every product you've logged or put
 * in a recipe, ranked by how often and how recently. It's how "yoghurt"
 * becomes the Great Value Greek yoghurt you actually buy.
 */

/** One time you used a food: a log entry or a recipe ingredient. */
export type Use = { foodId: string; quantity: number; unit: string; grams: number | null; date: string; inRecipe: boolean };

export type PantryFood = {
  food: FoodRecord;
  uses: number;
  /** How much you lean on it now: more uses count more, recent ones most. */
  score: number;
  lastUsed: string;
  /** The amount you usually use: your last time in a recipe, or your last log. */
  usual: { quantity: number; unit: string; grams: number } | null;
};

/** A use loses half its weight every 45 days, so a brand you switched to wins soon. */
const HALF_LIFE_DAYS = 45;
const RECIPE_WEIGHT = 1.5;

const daysBetween = (a: string, b: string) => Math.max(0, (fromISODate(b).getTime() - fromISODate(a).getTime()) / 86_400_000);

export function buildPantry(uses: Use[], foods: FoodRecord[], today: string): PantryFood[] {
  const byId = new Map(foods.map((f) => [f.id, f]));
  const out = new Map<string, PantryFood & { usualFrom: { date: string; inRecipe: boolean } | null }>();
  for (const u of uses) {
    const food = byId.get(u.foodId);
    if (!food) continue;
    const p = out.get(u.foodId) ?? { food, uses: 0, score: 0, lastUsed: u.date, usual: null, usualFrom: null };
    p.uses += 1;
    p.score += (u.inRecipe ? RECIPE_WEIGHT : 1) * 0.5 ** (daysBetween(u.date, today) / HALF_LIFE_DAYS);
    if (u.date > p.lastUsed) p.lastUsed = u.date;
    // The usual amount: recipe amounts beat log amounts, then the latest.
    const better = !p.usualFrom || (u.inRecipe && !p.usualFrom.inRecipe) || (u.inRecipe === p.usualFrom.inRecipe && u.date > p.usualFrom.date);
    if (u.grams && u.grams > 0 && better) {
      p.usual = { quantity: u.quantity, unit: u.unit, grams: u.grams };
      p.usualFrom = { date: u.date, inRecipe: u.inRecipe };
    }
    out.set(u.foodId, p);
  }
  return [...out.values()].map(({ usualFrom: _, ...p }) => p).sort((a, b) => b.score - a.score);
}

/** Your products for an idea ("yoghurt"), the one you lean on most first. */
export function usualFor(term: string, pantry: PantryFood[], limit = 3): PantryFood[] {
  const dishOk = isDish(term);
  return pantry.filter((p) => mentions(term, `${p.food.name} ${p.food.brand ?? ''}`) && (dishOk || !isDish(p.food.name))).slice(0, limit);
}

/**
 * The product you'd use for an ingredient now: your top product of the same
 * kind, when it isn't the one already there. "Greek Yoghurt" in an old recipe
 * → the Great Value Greek yoghurt you've been buying since.
 */
export function preferredFor(item: { name: string; foodId: string | null }, pantry: PantryFood[]): PantryFood | null {
  const kind = kindOf(item.name);
  // The stand-in must be that kind of food (or a more specific one), not just mention it.
  const sameKind = (p: PantryFood) => {
    // A dish that mentions it ("Paneer marinade") is never a stand-in for the ingredient.
    if (isDish(p.food.name) && !isDish(item.name)) return false;
    const theirs = kindOf(p.food.name);
    return kind ? theirs !== null && mentions(kind, theirs) : mentions(item.name, p.food.name);
  };
  const top = pantry.find((p) => (kind ? mentions(kind, `${p.food.name} ${p.food.brand ?? ''}`) : true) && sameKind(p));
  return top && top.food.id !== item.foodId ? top : null;
}
