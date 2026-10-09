import type { FoodWithServings } from '@/features/food/api';
import { useRecipeDraft } from '@/features/recipes/draft';
import {
  copyName,
  describeItem,
  emptyDraft,
  finishedWeight,
  itemFromFood,
  per100,
  perServing,
  quickItem,
  rawWeight,
  recipeFood,
  recipeProblem,
  recipeUnits,
  swapItem,
  totals,
  type RecipeDraft,
} from '@/features/recipes/logic';
import { defaultPortion, nutrientsFor, unitsFor, WHOLE_BATCH } from '@/lib/portion';

jest.mock('@/lib/supabase', () => ({ supabase: null, requireSupabase: jest.fn() }));

const food = (id: string, name: string, per100g: [number, number, number, number, number], extra: Partial<FoodWithServings> = {}): FoodWithServings => ({
  id,
  source: 'custom',
  name,
  brand: null,
  kcal_100g: per100g[0],
  protein_100g: per100g[1],
  carbs_100g: per100g[2],
  fat_100g: per100g[3],
  fiber_100g: per100g[4],
  default_serving_g: 100,
  default_serving_label: null,
  servings: [],
  ...extra,
});

const ghee = food('f-ghee', 'Ghee', [900, 0, 0, 100, 0], { default_serving_g: 14, default_serving_label: 'tbsp' });
const paneer = food('f-paneer', 'Paneer', [296, 20, 3.6, 22.5, 0]);
const yoghurt = food('f-yog', 'Greek yoghurt', [97, 9, 3.9, 5, 0]);
const chaap = food('f-chaap', 'Soya chaap', [180, 18, 9, 8, 4]);

/** 30 g ghee + 400 g paneer + 150 g yoghurt + a spice mix with no weight. */
const marinade = (over: Partial<RecipeDraft> = {}): RecipeDraft => ({
  ...emptyDraft(),
  name: 'Paneer marinade',
  items: [
    itemFromFood(ghee, 2, 'tbsp', 28),
    itemFromFood(paneer, 400, 'g', 400),
    itemFromFood(yoghurt, 150, 'g', 150),
    quickItem('Tandoori spice mix', { kcal: 20, protein_g: 1, carbs_g: 3, fat_g: 0.5, fiber_g: 1 }, null),
  ],
  ...over,
});

describe('recipe numbers', () => {
  it('adds up every ingredient for the whole batch', () => {
    const t = totals(marinade().items);
    // 252 + 1184 + 145.5 + 20
    expect(t.kcal).toBeCloseTo(1601.5);
    expect(t.fat_g).toBeCloseTo(28 + 90 + 7.5 + 0.5);
    expect(t.protein_g).toBeCloseTo(0 + 80 + 13.5 + 1);
    expect(t.fiber_g).toBeCloseTo(1);
  });

  it('weighs what the ingredients add up to, ignoring quick ingredients without a weight', () => {
    expect(rawWeight(marinade().items)).toBe(578);
    expect(finishedWeight(marinade())).toBe(578);
  });

  it('uses the weighed finished dish when you enter it, so cooking losses concentrate the calories', () => {
    const raw = per100(marinade())!;
    const cooked = per100(marinade({ finalWeight: 500 }))!;
    expect(raw.kcal).toBeCloseTo((1601.5 / 578) * 100);
    expect(cooked.kcal).toBeCloseTo((1601.5 / 500) * 100);
    expect(cooked.kcal).toBeGreaterThan(raw.kcal);
  });

  it('knows how much ghee is in 50 g of the marinade', () => {
    const d = marinade({ finalWeight: 500 });
    const fiftyGrams = (per100(d)!.fat_g * 50) / 100;
    // 50 g is a tenth of the batch, so a tenth of all the fat (12.6 g), most of it from ghee and paneer.
    expect(fiftyGrams).toBeCloseTo(12.6);
  });

  it('splits the batch into servings', () => {
    expect(perServing(marinade())).toBeNull();
    expect(perServing(marinade({ servings: 4 }))!.kcal).toBeCloseTo(1601.5 / 4);
  });

  it('has no per-100 g numbers until something has a weight', () => {
    const d = { ...emptyDraft(), name: 'Spice mix', items: [quickItem('Spices', { kcal: 20, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }, null)] };
    expect(per100(d)).toBeNull();
  });
});

describe('ingredients', () => {
  it('measures a food at any of its units', () => {
    const i = itemFromFood(ghee, 2, 'tbsp', 28);
    expect(i.nutrients).toEqual(nutrientsFor(ghee, 28));
    expect(describeItem(i)).toBe('2 tbsp · 28 g');
    expect(describeItem(itemFromFood(paneer, 200, 'g', 200))).toBe('200 g');
  });

  it('describes quick ingredients', () => {
    expect(describeItem(quickItem('Spices', { kcal: 20, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }, null))).toBe('Quick ingredient');
    expect(describeItem(quickItem('Oil', { kcal: 90, protein_g: 0, carbs_g: 0, fat_g: 10, fiber_g: 0 }, 10))).toBe('10 g · quick ingredient');
  });

  it('gives every ingredient its own key', () => {
    const keys = new Set(marinade().items.map((i) => i.key));
    expect(keys.size).toBe(4);
  });

  it('swaps paneer for soya chaap at the same weight, keeping its place', () => {
    const d = marinade();
    const old = d.items[1];
    const swapped = swapItem(old, chaap);
    expect(swapped.key).toBe(old.key);
    expect(swapped.name).toBe('Soya chaap');
    expect(swapped.grams).toBe(400);
    expect(swapped.unit).toBe('g');
    expect(swapped.nutrients.kcal).toBeCloseTo(720);
  });

  it('swaps a quick ingredient for a food at the food’s usual amount', () => {
    const spices = quickItem('Spices', { kcal: 20, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }, null);
    const swapped = swapItem(spices, ghee);
    expect(swapped.grams).toBe(14);
    expect(swapped.food?.id).toBe('f-ghee');
  });
});

describe('saving a recipe', () => {
  it('says what to fix before it can be saved', () => {
    expect(recipeProblem(marinade({ name: ' ' }))).toMatch(/name/);
    expect(recipeProblem(marinade({ items: [] }))).toMatch(/at least one/);
    expect(recipeProblem({ ...emptyDraft(), name: 'Spices', items: [quickItem('Spices', { kcal: 20, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }, null)] })).toMatch(
      /by weight/,
    );
    // 578 g of ingredients can't weigh 100 g when they hold ~244 g of protein, carbs and fat.
    expect(recipeProblem(marinade({ finalWeight: 100 }))).toMatch(/less than the protein/);
    expect(recipeProblem(marinade({ servings: 0 }))).toMatch(/Servings/);
    expect(recipeProblem(marinade({ finalWeight: 500, servings: 4 }))).toBeNull();
  });

  it('becomes a food with per-100 g numbers and a serving as its usual amount', () => {
    const f = recipeFood(marinade({ finalWeight: 500, servings: 4 }));
    expect(f.name).toBe('Paneer marinade');
    expect(f.kcal_100g).toBeCloseTo(320.3, 1);
    expect(f.fat_100g).toBeCloseTo(25.2, 1);
    expect(f.default_serving_g).toBe(125);
    expect(f.default_serving_label).toBe('serving');
  });

  it('uses 100 g as the usual amount without servings', () => {
    const f = recipeFood(marinade());
    expect(f.default_serving_g).toBe(100);
    expect(f.default_serving_label).toBeNull();
  });

  it('keeps per-100 g numbers within what a food can hold', () => {
    const oil = { ...emptyDraft(), name: 'Garlic oil', items: [quickItem('Oil', { kcal: 2000, protein_g: 0, carbs_g: 0, fat_g: 150, fiber_g: 0 }, 100)] };
    const f = recipeFood(oil);
    expect(f.kcal_100g).toBe(1000);
    expect(f.fat_100g).toBe(100);
  });

  it('adds a whole-batch unit at the finished weight', () => {
    expect(recipeUnits(marinade({ finalWeight: 512.34 }))).toEqual([{ label: WHOLE_BATCH, grams: 512.3 }]);
    expect(recipeUnits({ ...emptyDraft(), items: [] })).toEqual([]);
  });

  it('marks an unrenamed version as a copy once', () => {
    expect(copyName('Paneer marinade')).toBe('Paneer marinade (copy)');
    expect(copyName('Paneer marinade (copy)')).toBe('Paneer marinade (copy)');
  });
});

describe('logging a recipe', () => {
  const asFood = (d: RecipeDraft): FoodWithServings => ({ id: 'r1', source: 'custom', brand: null, ...recipeFood(d), servings: recipeUnits(d) });

  it('offers serving, then grams and ounces, with the whole batch last', () => {
    const units = unitsFor(asFood(marinade({ finalWeight: 500, servings: 4 })), recipeUnits(marinade({ finalWeight: 500 })));
    expect(units.map((u) => u.label)).toEqual(['serving', 'g', 'oz', WHOLE_BATCH]);
    expect(units[3].grams).toBe(500);
    expect(units[3].defaultQty).toBe(1);
  });

  it('defaults to 100 g without servings, and never to the whole batch', () => {
    const f = asFood(marinade({ finalWeight: 500 }));
    expect(defaultPortion(f)).toEqual({ qty: 100, unit: 'g', grams: 100 });
    expect(unitsFor(f, f.servings).map((u) => u.label)).toEqual(['g', 'oz', WHOLE_BATCH]);
  });

  it('can go inside another recipe (a taco with 50 g of the marinade)', () => {
    const m = asFood(marinade({ finalWeight: 500 }));
    const cheese = food('f-cheese', 'Cheddar', [403, 25, 1.3, 33, 0]);
    const tortilla = food('f-tort', 'Corn tortilla', [218, 5.7, 44.6, 2.9, 6.3], { default_serving_g: 26, default_serving_label: 'tortilla' });
    const taco = { ...emptyDraft(), name: 'Paneer taco', items: [itemFromFood(m, 50, 'g', 50), itemFromFood(cheese, 20, 'g', 20), itemFromFood(tortilla, 1, 'tortilla', 26)] };
    const t = totals(taco.items);
    expect(t.kcal).toBeCloseTo(160.15 + 80.6 + 56.68, 0);
    expect(recipeProblem(taco)).toBeNull();
  });
});

describe('recipe draft', () => {
  beforeEach(() => useRecipeDraft.getState().start(marinade(), 'new'));

  it('adds, replaces in place and removes ingredients', () => {
    const s = useRecipeDraft.getState();
    const [, p] = s.draft.items;
    s.replaceItem(p.key, swapItem(p, chaap));
    expect(useRecipeDraft.getState().draft.items.map((i) => i.name)).toEqual(['Ghee', 'Soya chaap', 'Greek yoghurt', 'Tandoori spice mix']);
    useRecipeDraft.getState().removeItem(p.key);
    useRecipeDraft.getState().addItem(itemFromFood(paneer, 100, 'g', 100));
    expect(useRecipeDraft.getState().draft.items.map((i) => i.name)).toEqual(['Ghee', 'Greek yoghurt', 'Tandoori spice mix', 'Paneer']);
  });

  it('keeps the key when replacing, so the list doesn’t jump', () => {
    const s = useRecipeDraft.getState();
    const first = s.draft.items[0];
    s.replaceItem(first.key, itemFromFood(ghee, 1, 'tbsp', 14));
    expect(useRecipeDraft.getState().draft.items[0].key).toBe(first.key);
    expect(useRecipeDraft.getState().draft.items[0].grams).toBe(14);
  });

  it('patches the name and weights', () => {
    useRecipeDraft.getState().patch({ finalWeight: 520, servings: 3 });
    expect(useRecipeDraft.getState().draft).toMatchObject({ name: 'Paneer marinade', finalWeight: 520, servings: 3 });
  });
});
