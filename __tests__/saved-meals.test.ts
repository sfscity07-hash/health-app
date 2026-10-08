import type { FoodLogEntry } from '@/features/dashboard/api';
import {
  copyEntries,
  entriesFromMeal,
  itemNutrients,
  itemsFromEntries,
  mealSummary,
  suggestedMealName,
  totalOf,
  type SavedMeal,
} from '@/features/meals/logic';
import type { FoodRecord } from '@/lib/portion';

jest.mock('@/lib/supabase', () => ({ supabase: null, requireSupabase: jest.fn() }));

const oats: FoodRecord = {
  id: 'food-oats',
  source: 'custom',
  name: 'Rolled oats',
  brand: null,
  kcal_100g: 379,
  protein_100g: 13,
  carbs_100g: 68,
  fat_100g: 6.5,
  fiber_100g: 10,
  default_serving_g: 40,
  default_serving_label: null,
};

const entry = (over: Partial<FoodLogEntry>): FoodLogEntry => ({
  id: 'e1',
  logged_at: '2026-10-07T07:40:00Z',
  meal: 'breakfast',
  food_id: 'food-oats',
  name: 'Rolled oats',
  brand: null,
  quantity: 60,
  unit: 'g',
  grams: 60,
  kcal: 227.4,
  protein_g: 7.8,
  carbs_g: 40.8,
  fat_g: 3.9,
  fiber_g: 6,
  ...over,
});

const breakfast = [
  entry({}),
  entry({ id: 'e2', food_id: null, name: 'Flat white', quantity: 1, unit: 'serving', grams: null, kcal: 120, protein_g: 7, carbs_g: 10, fat_g: 6, fiber_g: 0 }),
];

describe('saving a meal you logged', () => {
  it('keeps foods as foods and quick adds as their numbers', () => {
    expect(itemsFromEntries(breakfast)).toEqual([
      { food_id: 'food-oats', quantity: 60, unit: 'g', grams: 60, name: 'Rolled oats', kcal: null, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null, position: 0 },
      { food_id: null, quantity: 1, unit: 'serving', grams: null, name: 'Flat white', kcal: 120, protein_g: 7, carbs_g: 10, fat_g: 6, fiber_g: 0, position: 1 },
    ]);
  });

  it('suggests a name and sums it up', () => {
    expect(suggestedMealName('breakfast')).toBe('Usual breakfast');
    expect(mealSummary(2, 347.4)).toBe('2 foods · 347 kcal');
    expect(mealSummary(1, 120)).toBe('1 food · 120 kcal');
  });
});

describe('a saved meal', () => {
  it('works out food items from the food, and quick adds from their saved numbers', () => {
    const fromFood = itemNutrients(oats, 60, {});
    expect(fromFood.kcal).toBeCloseTo(227.4);
    expect(fromFood.fiber_g).toBeCloseTo(6);
    expect(itemNutrients(null, null, { kcal: 120, protein_g: 7 })).toEqual({ kcal: 120, protein_g: 7, carbs_g: 0, fat_g: 0, fiber_g: 0 });
  });

  it('logs every item into the meal and day you choose', () => {
    const items = [
      { id: 'i1', position: 0, food: oats, quantity: 60, unit: 'g', grams: 60, name: 'Rolled oats', brand: null, nutrients: itemNutrients(oats, 60, {}) },
      { id: 'i2', position: 1, food: null, quantity: 1, unit: 'serving', grams: null, name: 'Flat white', brand: null, nutrients: itemNutrients(null, null, { kcal: 120 }) },
    ];
    const meal: SavedMeal = { id: 'm1', name: 'Usual breakfast', items, totals: totalOf(items) };
    expect(meal.totals.kcal).toBeCloseTo(347.4);
    const logged = entriesFromMeal(meal, '2026-10-08', 'lunch');
    expect(logged).toHaveLength(2);
    expect(logged[0]).toMatchObject({ date: '2026-10-08', meal: 'lunch', foodId: 'food-oats', quantity: 60, unit: 'g', grams: 60 });
    expect(logged[1]).toMatchObject({ foodId: null, name: 'Flat white', grams: null, nutrients: { kcal: 120 } });
  });
});

describe('copying', () => {
  it('copies a meal into one meal on another day, with the same amounts and numbers', () => {
    const copied = copyEntries(breakfast, '2026-10-08', 'snack');
    expect(copied.map((c) => [c.date, c.meal, c.name, c.nutrients.kcal])).toEqual([
      ['2026-10-08', 'snack', 'Rolled oats', 227.4],
      ['2026-10-08', 'snack', 'Flat white', 120],
    ]);
  });

  it('copies a whole day with each food in its own meal', () => {
    const day = [...breakfast, entry({ id: 'e3', meal: 'dinner', name: 'Salmon', food_id: 'food-salmon' })];
    expect(copyEntries(day, '2026-10-08').map((c) => c.meal)).toEqual(['breakfast', 'breakfast', 'dinner']);
  });
});
