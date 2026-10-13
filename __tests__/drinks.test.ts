import { copyEntries } from '@/features/meals/logic';
import { drinkWater, isDrink, rememberedCounts, waterShare, waterTotal, type DrinkMemory } from '@/features/water/drinks';
import type { FoodLogEntry } from '@/features/dashboard/api';

jest.mock('@/lib/supabase', () => ({ supabase: null, requireSupabase: jest.fn() }));

describe('what counts as a drink', () => {
  it('knows milk, tea, coffee, juice, buttermilk and soup, however they are named', () => {
    for (const name of [
      'Milk',
      'Milk, whole, 3.25% milkfat, with added vitamin D',
      'Great Value 2% Reduced Fat Milk',
      'Amul Taaza Toned Milk 1L',
      'Masala chai',
      'Tea with milk and sugar',
      'Beverages, coffee, brewed, prepared with tap water',
      'Iced latte',
      'Orange juice',
      'Mango lassi',
      'Chaas',
      'Coconut water',
      'Tomato soup',
      'Soup, tomato, canned, prepared with equal volume water',
      'Banana smoothie',
      'Coca-Cola Zero 330ml',
      'Diet 7up',
      'Chocolate milk',
      'Unsweetened almond milk',
    ]) {
      expect([name, isDrink(name)]).toEqual([name, true]);
    }
  });

  it('leaves out dishes that only have a drink in them, and dry or concentrated forms', () => {
    for (const name of [
      'Oats with milk',
      'Overnight oats',
      'Milk chocolate',
      'Coffee cake',
      'Tea biscuits',
      'Milk powder',
      'Milk, dry, whole',
      'Sweetened condensed milk',
      'Coconut milk',
      'Instant coffee powder',
      'Tea bags',
      'Orange juice, frozen concentrate',
      'Soup, chicken noodle, canned, condensed',
      'Watermelon',
      'Water chestnuts',
      'Rooh Afza syrup',
      'Red wine',
      'Vodka soda',
      'Paneer',
      'Dal tadka',
    ]) {
      expect([name, isDrink(name)]).toEqual([name, false]);
    }
  });

  it('counts each drink by how much of it is water', () => {
    expect(waterShare('Water')).toBe(1);
    expect(waterShare('Milk')).toBe(0.88);
    expect(waterShare('Skim milk')).toBe(0.91);
    expect(waterShare('Lassi')).toBe(0.8);
  });
});

describe('water from a logged drink', () => {
  it('is the drink’s weight times its water, or nothing when you said it doesn’t count', () => {
    expect(drinkWater('Milk', 250)).toBe(220);
    expect(drinkWater('Milk', 250, false)).toBe(0);
    expect(drinkWater('Black coffee', 240)).toBe(238);
  });

  it('is null for food that isn’t a drink, or a drink with no weight', () => {
    expect(drinkWater('Paneer', 100)).toBeNull();
    expect(drinkWater('Milk', null)).toBeNull();
  });
});

describe('remembering whether a drink counts', () => {
  const rows: DrinkMemory[] = [
    { food_id: 'milk', name: 'Milk', meal: 'breakfast', water_ml: 0 },
    { food_id: 'milk', name: 'Milk', meal: 'snack', water_ml: 220 },
    { food_id: 'chai', name: 'Masala chai', meal: 'snack', water_ml: null },
    { food_id: null, name: 'Buttermilk', meal: 'lunch', water_ml: 0 },
  ];

  it('goes by what you chose last time at that meal, then at any meal', () => {
    // Milk in breakfast oats is cooked down; a glass of milk as a snack counts.
    expect(rememberedCounts(rows, { foodId: 'milk', name: 'Milk' }, 'breakfast')).toBe(false);
    expect(rememberedCounts(rows, { foodId: 'milk', name: 'Milk' }, 'snack')).toBe(true);
    expect(rememberedCounts(rows, { foodId: 'milk', name: 'Milk' }, 'dinner')).toBe(false);
  });

  it('matches by name when there is no saved food, and knows nothing about drinks it never saw', () => {
    expect(rememberedCounts(rows, { foodId: null, name: 'buttermilk ' }, 'dinner')).toBe(false);
    expect(rememberedCounts(rows, { foodId: 'chai', name: 'Masala chai' }, 'snack')).toBeNull();
    expect(rememberedCounts(undefined, { foodId: 'x', name: 'Juice' }, 'snack')).toBeNull();
  });
});

describe('the day’s water', () => {
  it('adds drinks unless you’ve turned that off', () => {
    expect(waterTotal({ water_ml: 1500, drink_ml: 400 }, true)).toBe(1900);
    expect(waterTotal({ water_ml: 1500, drink_ml: 400 }, false)).toBe(1500);
  });

  it('keeps whether a drink counted when you copy it to another day', () => {
    const entry = (id: string, water_ml: number | null | undefined): FoodLogEntry => ({
      id,
      logged_at: '2026-10-12T08:00:00Z',
      meal: 'breakfast',
      food_id: 'milk',
      name: 'Milk',
      brand: null,
      quantity: 200,
      unit: 'ml',
      grams: 200,
      kcal: 120,
      protein_g: 6,
      carbs_g: 9,
      fat_g: 6,
      fiber_g: 0,
      water_ml,
    });
    const copied = copyEntries([entry('a', 0), entry('b', 176), entry('c', null), entry('d', undefined)], '2026-10-13');
    expect(copied.map((e) => e.countsAsWater)).toEqual([false, true, undefined, undefined]);
  });
});
