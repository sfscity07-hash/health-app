import { buildPantry, preferredFor, usualFor, type Use } from '@/features/recipes/pantry';
import { kindOf } from '@/features/recipes/suggest';
import type { FoodRecord } from '@/lib/portion';

const food = (id: string, name: string, brand: string | null = null): FoodRecord => ({
  id,
  source: brand ? 'off' : 'usda',
  name,
  brand,
  kcal_100g: 100,
  protein_100g: 5,
  carbs_100g: 5,
  fat_100g: 5,
  fiber_100g: 0,
  default_serving_g: null,
  default_serving_label: null,
});

const greek = food('usda-greek', 'Greek Yoghurt');
const greatValue = food('gv-greek', 'Greek Nonfat Yogurt, Plain', 'Great Value');
const epigamia = food('epi-greek', 'Greek Yoghurt', 'Epigamia');
const ghee = food('usda-ghee', 'Ghee, clarified butter');
const amulGhee = food('amul-ghee', 'Pure Ghee', 'Amul');
const paneer = food('paneer', 'Paneer');
const foods = [greek, greatValue, epigamia, ghee, amulGhee, paneer];

const use = (foodId: string, date: string, over: Partial<Use> = {}): Use => ({ foodId, date, quantity: 150, unit: 'g', grams: 150, inRecipe: false, ...over });
const TODAY = '2026-10-13';

describe('what kind of food something is', () => {
  it('uses the most specific kind it knows, then the one named first', () => {
    expect(kindOf('Greek Yoghurt')).toBe('greek yogurt');
    expect(kindOf('Greek Nonfat Yogurt, Plain')).toBe('greek yogurt');
    expect(kindOf('Ghee, clarified butter')).toBe('ghee');
    expect(kindOf('Soya Chaap')).toBe('soya chaap');
    expect(kindOf('Dragon fruit')).toBeNull();
  });
});

describe('learning your pantry', () => {
  it('ranks products by how much you use them, recent use counting most', () => {
    const pantry = buildPantry(
      [use('usda-greek', '2026-06-01'), use('usda-greek', '2026-06-08'), use('usda-greek', '2026-06-15'), use('gv-greek', '2026-10-05'), use('gv-greek', '2026-10-12')],
      foods,
      TODAY,
    );
    // Three old uses lose to two recent ones: you've switched brands.
    expect(pantry[0].food.id).toBe('gv-greek');
    expect(pantry.find((p) => p.food.id === 'usda-greek')?.uses).toBe(3);
  });

  it('counts a recipe ingredient more than a log, and takes its amount as your usual', () => {
    const pantry = buildPantry(
      [use('gv-greek', '2026-10-12', { quantity: 200, grams: 200 }), use('gv-greek', '2026-10-01', { inRecipe: true, quantity: 150, grams: 150 })],
      foods,
      TODAY,
    );
    expect(pantry[0].usual).toEqual({ quantity: 150, unit: 'g', grams: 150 });
    expect(pantry[0].uses).toBe(2);
    expect(pantry[0].lastUsed).toBe('2026-10-12');
  });

  it('skips foods it can’t find and amounts without a weight', () => {
    const pantry = buildPantry([use('gone', TODAY), use('paneer', TODAY, { grams: null, unit: 'serving', quantity: 1 })], foods, TODAY);
    expect(pantry.map((p) => p.food.id)).toEqual(['paneer']);
    expect(pantry[0].usual).toBeNull();
  });
});

describe('your usual for an idea', () => {
  const pantry = buildPantry([use('gv-greek', '2026-10-12'), use('gv-greek', '2026-10-10'), use('epi-greek', '2026-09-01'), use('amul-ghee', '2026-10-11')], foods, TODAY);

  it('finds your products for an idea, the one you lean on most first, brand included', () => {
    expect(usualFor('yogurt', pantry).map((p) => p.food.id)).toEqual(['gv-greek', 'epi-greek']);
    expect(usualFor('great value', pantry).map((p) => p.food.id)).toEqual(['gv-greek']);
    expect(usualFor('paneer', pantry)).toEqual([]);
  });

  it('turns a generic ingredient from an old recipe into the product you buy now', () => {
    expect(preferredFor({ name: 'Greek Yoghurt', foodId: 'usda-greek' }, pantry)?.food.id).toBe('gv-greek');
    expect(preferredFor({ name: 'Ghee, clarified butter', foodId: 'usda-ghee' }, pantry)?.food.id).toBe('amul-ghee');
  });

  it('never stands in a dish that only mentions the ingredient', () => {
    const marinade = food('marinade', 'Paneer marinade');
    const withDish = buildPantry([use('marinade', '2026-10-12'), use('marinade', '2026-10-11'), use('paneer', '2026-08-01')], [...foods, marinade], TODAY);
    expect(preferredFor({ name: 'Paneer', foodId: 'paneer' }, withDish)).toBeNull();
    expect(preferredFor({ name: 'Paneer', foodId: null }, withDish)?.food.id).toBe('paneer');
  });

  it('keeps an ingredient that already is your usual', () => {
    expect(preferredFor({ name: 'Greek Nonfat Yogurt, Plain', foodId: 'gv-greek' }, pantry)).toBeNull();
    expect(preferredFor({ name: 'Paneer', foodId: 'paneer' }, pantry)).toBeNull();
  });
});
