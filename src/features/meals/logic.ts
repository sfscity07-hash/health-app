import type { FoodLogEntry } from '@/features/dashboard/api';
import type { NewEntry } from '@/features/food/api';
import { formatInt } from '@/lib/format';
import { MEAL_LABEL, type Meal } from '@/lib/meals';
import { nutrientsFor, type FoodRecord, type Nutrients } from '@/lib/portion';

export type SavedMealItem = {
  id: string;
  position: number;
  /** The food it uses; null for a quick add. */
  food: FoodRecord | null;
  quantity: number;
  unit: string;
  grams: number | null;
  name: string;
  brand: string | null;
  /** For the saved amount. */
  nutrients: Nutrients;
};

export type SavedMeal = { id: string; name: string; items: SavedMealItem[]; totals: Nutrients };

/** A row ready for saved_meal_items. */
export type SavedMealItemRow = {
  food_id: string | null;
  quantity: number;
  unit: string;
  grams: number | null;
  name: string;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  position: number;
};

export const ZERO: Nutrients = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };

export function addNutrients(a: Nutrients, b: Nutrients): Nutrients {
  return {
    kcal: a.kcal + b.kcal,
    protein_g: a.protein_g + b.protein_g,
    carbs_g: a.carbs_g + b.carbs_g,
    fat_g: a.fat_g + b.fat_g,
    fiber_g: a.fiber_g + b.fiber_g,
  };
}

export const totalOf = (items: { nutrients: Nutrients }[]) => items.reduce((t, i) => addNutrients(t, i.nutrients), ZERO);

const entryNutrients = (e: Nutrients): Nutrients => ({
  kcal: e.kcal,
  protein_g: e.protein_g,
  carbs_g: e.carbs_g,
  fat_g: e.fat_g,
  fiber_g: e.fiber_g,
});

/**
 * A food item's numbers come from the food (so fixing a food fixes the meal);
 * a quick add uses the numbers saved with it.
 */
export function itemNutrients(food: FoodRecord | null, grams: number | null, saved: Partial<Nutrients>): Nutrients {
  if (food && grams !== null) return nutrientsFor(food, grams);
  return {
    kcal: saved.kcal ?? 0,
    protein_g: saved.protein_g ?? 0,
    carbs_g: saved.carbs_g ?? 0,
    fat_g: saved.fat_g ?? 0,
    fiber_g: saved.fiber_g ?? 0,
  };
}

/** Turns what you logged into saved-meal items, keeping quick adds as their numbers. */
export function itemsFromEntries(entries: FoodLogEntry[]): SavedMealItemRow[] {
  return entries.map((e, position) => {
    const quick = e.food_id === null || e.grams === null;
    return {
      food_id: quick ? null : e.food_id,
      quantity: e.quantity,
      unit: e.unit,
      grams: quick ? null : e.grams,
      name: e.name.slice(0, 200),
      kcal: quick ? Math.round(e.kcal * 10) / 10 : null,
      protein_g: quick ? Math.round(e.protein_g * 10) / 10 : null,
      carbs_g: quick ? Math.round(e.carbs_g * 10) / 10 : null,
      fat_g: quick ? Math.round(e.fat_g * 10) / 10 : null,
      fiber_g: quick ? Math.round(e.fiber_g * 10) / 10 : null,
      position,
    };
  });
}

/** Log entries for a saved meal, all into one meal of one day. */
export function entriesFromMeal(meal: SavedMeal, date: string, slot: Meal): NewEntry[] {
  return meal.items.map((i) => ({
    date,
    meal: slot,
    foodId: i.food?.id ?? null,
    name: i.name,
    brand: i.brand,
    quantity: i.quantity,
    unit: i.unit,
    grams: i.grams,
    nutrients: i.nutrients,
  }));
}

/** Copies logged entries to another day, into one meal or (when `slot` is left out) each to its own meal. */
export function copyEntries(entries: FoodLogEntry[], date: string, slot?: Meal): NewEntry[] {
  return entries.map((e) => ({
    date,
    meal: slot ?? e.meal,
    foodId: e.food_id,
    name: e.name,
    brand: e.brand,
    quantity: e.quantity,
    unit: e.unit,
    grams: e.grams,
    nutrients: entryNutrients(e),
  }));
}

/** "Usual breakfast" as a starting name for a saved meal. */
export const suggestedMealName = (meal: Meal) => `Usual ${MEAL_LABEL[meal].toLowerCase()}`;

/** "3 foods · 540 kcal". */
export function mealSummary(count: number, kcal: number): string {
  return `${count} ${count === 1 ? 'food' : 'foods'} · ${formatInt(kcal)} kcal`;
}
