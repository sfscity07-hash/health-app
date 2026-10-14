import { buildCustomFood, type CustomFoodForm } from '@/features/food/forms';
import { borrow, borrowKind, closestGeneric, type Generic } from '@/features/nutrients/fill';
import {
  aiWanted,
  caffeinePer100,
  cleanMicros,
  dayNutrients,
  foodMicros,
  formatAmount,
  microsFromOff,
  microsFromUsda,
  missingKeys,
  NO_ESTIMATE,
  nutrientTargets,
  recipeMicros,
  saltFromSodium,
  wantsAi,
} from '@/features/nutrients/micros';
import { mapOffProduct } from '@/features/search/off';
import { mapUsdaFood } from '@/features/search/usda';

jest.mock('@/lib/supabase', () => ({ supabase: null, requireSupabase: jest.fn() }));

describe('reading micronutrients from the databases', () => {
  it('reads USDA search results, IU labels and the full details format alike', () => {
    expect(
      microsFromUsda([
        { nutrientId: 1093, unitName: 'MG', value: 43 },
        { nutrientId: 1087, unitName: 'MG', value: 113 },
        { nutrientId: 1106, unitName: 'UG', value: 46 },
        { nutrientId: 1057, unitName: 'MG', value: 0 },
        // Branded labels give vitamin D in IU: 40 IU is 1 µg.
        { nutrientId: 1110, unitName: 'IU', value: 100 },
        // Energy isn't a micronutrient.
        { nutrientId: 1008, unitName: 'KCAL', value: 61 },
      ]),
    ).toEqual({ sodium_mg: 43, calcium_mg: 113, vitamin_a_ug: 46, caffeine_mg: 0, vitamin_d_ug: 2.5 });
    expect(microsFromUsda([{ nutrient: { id: 1092, number: '306', unitName: 'mg' }, amount: 132 }])).toEqual({ potassium_mg: 132 });
    expect(microsFromUsda([{ number: '303', unitName: 'mg', amount: 0.03 }])).toEqual({ iron_mg: 0.03 });
  });

  it('reads Open Food Facts, which keeps everything in grams, and turns salt into sodium', () => {
    expect(microsFromOff({ salt_100g: 0.1, 'saturated-fat_100g': 2.1, sugars_100g: 3.6, calcium_100g: 0.12, 'vitamin-d_100g': 0.0000011 })).toEqual({
      sodium_mg: 40,
      saturated_fat_g: 2.1,
      sugar_g: 3.6,
      calcium_mg: 120,
      vitamin_d_ug: 1.1,
    });
  });

  it('drops impossible numbers instead of trusting a typo', () => {
    expect(cleanMicros({ sodium_mg: 90000, iron_mg: -1, calcium_mg: 'lots', potassium_mg: 300 })).toEqual({ potassium_mg: 300 });
  });

  it('keeps them on search results', () => {
    const usda = mapUsdaFood({
      fdcId: 171265,
      description: 'Milk, whole, 3.25% milkfat',
      dataType: 'SR Legacy',
      foodNutrients: [
        { nutrientId: 1008, unitName: 'KCAL', value: 61 },
        { nutrientId: 1003, unitName: 'G', value: 3.15 },
        { nutrientId: 1004, unitName: 'G', value: 3.27 },
        { nutrientId: 1005, unitName: 'G', value: 4.78 },
        { nutrientId: 1093, unitName: 'MG', value: 43 },
        { nutrientId: 1087, unitName: 'MG', value: 113 },
        { nutrientId: 1092, unitName: 'MG', value: 132 },
      ],
    });
    expect(usda?.micros).toEqual({ sodium_mg: 43, calcium_mg: 113, potassium_mg: 132 });
    const off = mapOffProduct({
      code: '8901262010016',
      product_name: 'Taaza Toned Milk',
      brands: 'Amul',
      nutriments: { 'energy-kcal_100g': 58, proteins_100g: 3, carbohydrates_100g: 4.7, fat_100g: 3, sodium_100g: 0.05 },
    });
    expect(off?.micros).toEqual({ sodium_mg: 50 });
  });
});

describe('caffeine', () => {
  it('has typical amounts for coffee, tea, cola, energy drinks and chocolate', () => {
    expect(caffeinePer100('Coffee, brewed')).toBe(40);
    expect(caffeinePer100('Espresso')).toBe(212);
    expect(caffeinePer100('Masala chai')).toBe(15);
    expect(caffeinePer100('Green tea')).toBe(12);
    expect(caffeinePer100('Coca-Cola')).toBe(10);
    expect(caffeinePer100('Red Bull Energy Drink')).toBe(32);
    expect(caffeinePer100('Dark chocolate 70%')).toBe(80);
  });

  it('tells instant coffee powder from a made cup by its calories', () => {
    expect(caffeinePer100('Nescafé Classic', 350)).toBe(3142);
    expect(caffeinePer100('Bru Instant Coffee', 2)).toBe(26);
    expect(caffeinePer100('Instant coffee powder')).toBe(3142);
  });

  it('knows what has none, and what it can’t guess', () => {
    expect(caffeinePer100('Paneer')).toBe(0);
    expect(caffeinePer100('Coffee cake')).toBe(0);
    expect(caffeinePer100('Tea biscuits')).toBe(0);
    expect(caffeinePer100('Chamomile tea')).toBe(0);
    expect(caffeinePer100('Decaf coffee')).toBe(1);
    expect(caffeinePer100('Pre workout')).toBeNull();
  });
});

describe('a food’s numbers', () => {
  const yogurt = { name: 'Greek Nonfat Yogurt, Plain', kcal_100g: 59, micros: { sodium_mg: 36, calcium_mg: 110 }, micros_est: null };

  it('puts the label first, estimates in the gaps, and says where each estimate came from', () => {
    const est = { by: 'usda' as const, from: 'Yogurt, Greek, plain, nonfat', values: { calcium_mg: 999, potassium_mg: 141 } };
    const fm = foodMicros({ ...yogurt, micros_est: est });
    expect(fm.values.calcium_mg).toBe(110);
    expect(fm.values.potassium_mg).toBe(141);
    expect(fm.estimated).toEqual({ potassium_mg: 'from USDA: Yogurt, Greek, plain, nonfat' });
    // No caffeine in yoghurt, and that's known rather than missing.
    expect(fm.values.caffeine_mg).toBe(0);
  });

  it('uses the older sugar and sodium columns when a food has nothing else yet', () => {
    expect(foodMicros({ name: 'Bar', micros: null, sugar_100g: 20, sodium_mg_100g: 300 }).values).toMatchObject({ sugar_g: 20, sodium_mg: 300 });
  });

  it('lists what an estimate could still fill', () => {
    expect(missingKeys(yogurt)).not.toContain('calcium_mg');
    expect(missingKeys(yogurt)).toContain('vitamin_b12_ug');
    expect(missingKeys(yogurt)).not.toContain('caffeine_mg');
  });
});

describe('borrowing from USDA’s plain version of a food', () => {
  const generics: Generic[] = [
    { name: 'Yogurt, Greek, plain, nonfat', kcal_100g: 59, micros: { sodium_mg: 36, potassium_mg: 141, calcium_mg: 110, vitamin_b12_ug: 0.75, zinc_mg: 0.52, magnesium_mg: 11 } },
    { name: 'Yogurt, Greek, plain, whole milk', kcal_100g: 97, micros: { sodium_mg: 35, potassium_mg: 141, calcium_mg: 100, vitamin_b12_ug: 0.75, zinc_mg: 0.52, magnesium_mg: 11 } },
    { name: 'Yogurt, Greek, strawberry, lowfat', kcal_100g: 106, micros: { sodium_mg: 33, potassium_mg: 125, calcium_mg: 88, vitamin_b12_ug: 0.5, zinc_mg: 0.4, magnesium_mg: 10 } },
  ];

  it('only for simple foods, never a dish or a processed product', () => {
    expect(borrowKind('Greek Nonfat Yogurt, Plain')).toBe('greek yogurt');
    expect(borrowKind('Amul Taaza Toned Milk')).toBe('milk');
    expect(borrowKind('Paneer marinade')).toBeNull();
    expect(borrowKind('Chocolate protein bar')).toBeNull();
    expect(borrowKind('Dragon fruit')).toBeNull();
  });

  it('picks the plain food closest in calories, and refuses one that’s too different', () => {
    expect(closestGeneric('greek yogurt', 62, generics)?.name).toBe('Yogurt, Greek, plain, nonfat');
    expect(closestGeneric('greek yogurt', 95, generics)?.name).toBe('Yogurt, Greek, plain, whole milk');
    expect(closestGeneric('greek yogurt', 250, generics)).toBeNull();
  });

  it('prefers the unfortified version, so a product isn’t credited with vitamins the maker may not add', () => {
    const micros = { sodium_mg: 43, potassium_mg: 132, calcium_mg: 113, vitamin_b12_ug: 0.45, zinc_mg: 0.37, magnesium_mg: 10 };
    const milks: Generic[] = [
      { name: 'Milk, whole, 3.25% milkfat, with added vitamin D', kcal_100g: 61, micros: { ...micros, vitamin_d_ug: 1.3 } },
      { name: 'Milk, whole, 3.25% milkfat, without added vitamin A and vitamin D', kcal_100g: 61, micros: { ...micros, vitamin_d_ug: 0.1 } },
    ];
    expect(closestGeneric('milk', 58, milks)?.name).toMatch(/without added/);
    const oats: Generic[] = [{ name: 'Cereals, oats, regular and quick, not fortified, dry', kcal_100g: 379, micros }];
    expect(closestGeneric('oats', 379, oats)).not.toBeNull();
  });

  it('borrows only what the label leaves out', () => {
    const est = borrow({ name: 'Greek Nonfat Yogurt, Plain', kcal_100g: 59, micros: { sodium_mg: 40, calcium_mg: 120 } }, 'greek yogurt', generics);
    expect(est.by).toBe('usda');
    expect(est.from).toBe('Yogurt, Greek, plain, nonfat');
    expect(est.values).toEqual({ potassium_mg: 141, vitamin_b12_ug: 0.75, zinc_mg: 0.52, magnesium_mg: 11 });
    expect(borrow({ name: 'Yogurt', kcal_100g: 400, micros: {} }, 'greek yogurt', generics)).toEqual(NO_ESTIMATE);
  });
});

describe('recipes', () => {
  const paneer = { name: 'Paneer', kcal_100g: 296, micros: { sodium_mg: 18, calcium_mg: 480, potassium_mg: 100 } };
  const ghee = { name: 'Ghee', kcal_100g: 876, micros: { sodium_mg: 2, calcium_mg: 4 } };

  it('adds up ingredients per 100 g of the finished dish', () => {
    const { micros, est } = recipeMicros(
      [
        { name: 'Paneer', grams: 400, food: paneer },
        { name: 'Ghee', grams: 25, food: ghee },
      ],
      400,
    );
    // 400 g paneer has 72 mg sodium, 25 g ghee 0.5 mg, in a 400 g dish.
    expect(micros.sodium_mg).toBeCloseTo(18.1, 1);
    expect(micros.calcium_mg).toBe(480);
    expect(micros.caffeine_mg).toBe(0);
    // Ghee doesn't list potassium, but it's under 20% of the weight: an estimate.
    expect(micros.potassium_mg).toBeUndefined();
    expect(est?.values.potassium_mg).toBeCloseTo(100, 0);
    expect(est?.by).toBe('recipe');
  });

  it('leaves out what too little of the recipe lists', () => {
    const { micros, est } = recipeMicros(
      [
        { name: 'Paneer', grams: 100, food: paneer },
        { name: 'Mystery sauce', grams: 300, food: null },
      ],
      400,
    );
    expect(micros.calcium_mg).toBeUndefined();
    expect(est?.values.calcium_mg).toBeUndefined();
  });
});

describe('a day', () => {
  const milk = { name: 'Milk', kcal_100g: 61, micros: { sodium_mg: 43, calcium_mg: 113 } };

  it('adds up each food by the grams you logged, names foods without data, and counts no caffeine as known', () => {
    const day = dayNutrients([
      { id: '1', name: 'Milk', grams: 250, food: milk },
      { id: '2', name: 'Masala chai', grams: 150, food: null },
      { id: '3', name: 'Burrito bowl', grams: null, food: null },
    ]);
    expect(day.sodium_mg.amount).toBeCloseTo(107.5);
    expect(day.sodium_mg.missing).toEqual(['Masala chai', 'Burrito bowl']);
    expect(day.calcium_mg.from).toEqual([{ name: 'Milk', amount: 282.5 }]);
    // Chai's caffeine is a typical amount; milk has none; the bowl can't have any.
    expect(day.caffeine_mg.amount).toBeCloseTo(22.5);
    expect(day.caffeine_mg.estimated).toBe(true);
    expect(day.caffeine_mg.missing).toEqual([]);
  });
});

describe('targets', () => {
  it('fits your sex and age, with limits from your calories', () => {
    const man = nutrientTargets({ sex: 'male', age: 30, kcal: 2000 });
    expect(man.iron_mg.amount).toBe(8);
    expect(man.magnesium_mg.amount).toBe(400);
    expect(man.saturated_fat_g).toMatchObject({ kind: 'limit', amount: 22 });
    expect(man.sugar_g.amount).toBe(50);
    const woman = nutrientTargets({ sex: 'female', age: 55, kcal: 1800 });
    expect(woman.iron_mg.amount).toBe(8);
    expect(woman.calcium_mg.amount).toBe(1200);
    expect(nutrientTargets({ sex: null, age: null, kcal: 2000 }).iron_mg.amount).toBe(18);
  });

  it('formats amounts and salt', () => {
    expect(formatAmount(1840, 'mg')).toBe('1,840 mg');
    expect(formatAmount(2.4, 'µg')).toBe('2.4 µg');
    expect(saltFromSodium(2000)).toBe(5);
  });
});

describe('your own food’s label extras', () => {
  const form = (label: CustomFoodForm['label'], over: Partial<CustomFoodForm> = {}): CustomFoodForm => ({
    name: 'Masala oats',
    brand: '',
    unit: 'packet',
    unitGrams: '40',
    basis: 'unit',
    kcal: '160',
    protein: '4',
    carbs: '26',
    fat: '4',
    fiber: '',
    extraUnits: [],
    label,
    ...over,
  });

  it('stores them per 100 g, on the same basis as the macros', () => {
    const r = buildCustomFood(form({ sodium_mg: '560', sugar_g: '2', caffeine_mg: '' }));
    expect(r.ok && r.food.micros).toEqual({ sodium_mg: 1400, sugar_g: 5 });
    expect(r.ok && r.food.sodium_mg_100g).toBe(1400);
  });

  it('catches numbers that can’t be right', () => {
    expect(buildCustomFood(form({ saturated_fat_g: '6' }))).toEqual({ ok: false, error: 'Saturated fat is part of fat, so it can’t be more. Check the numbers.' });
    expect(buildCustomFood(form({ sodium_mg: 'a pinch' }))).toEqual({ ok: false, error: 'Sodium must be a plain number.' });
  });
});

describe('AI estimates', () => {
  const ai = { model: 'claude-opus-5-5', from: 'IFCT: bhujia', confidence: 'medium' as const, values: { sodium_mg: 9, potassium_mg: 520, iron_mg: 4.1, caffeine_mg: 0 } };
  const bhujia = {
    name: 'Aloo Bhujia',
    kcal_100g: 597,
    micros: { sodium_mg: 1050 },
    micros_est: { by: 'usda' as const, from: 'Snacks, potato sticks', values: { potassium_mg: 900 }, ai },
  };

  it('fill only what the label, USDA and the caffeine list leave unknown, and say so', () => {
    const fm = foodMicros(bhujia);
    expect(fm.values.sodium_mg).toBe(1050);
    expect(fm.values.potassium_mg).toBe(900);
    expect(fm.values.iron_mg).toBe(4.1);
    expect(fm.ai).toEqual({ iron_mg: true });
    expect(fm.estimated.iron_mg).toBe('AI estimate, based on IFCT: bhujia');
  });

  it('marks a rough guess as rough', () => {
    const fm = foodMicros({ ...bhujia, micros_est: { ...bhujia.micros_est, ai: { ...ai, confidence: 'low' as const } } });
    expect(fm.estimated.iron_mg).toBe('AI estimate, based on IFCT: bhujia (rough)');
  });

  it('are asked for once, after the label and USDA, for whatever is still unknown', () => {
    const plain = { name: 'Pre workout', kcal_100g: 350, micros: { sodium_mg: 200 }, micros_est: NO_ESTIMATE };
    expect(aiWanted(plain)).toContain('caffeine_mg');
    expect(aiWanted(plain)).not.toContain('sodium_mg');
    expect(wantsAi(plain, false)).toBe(true);
    expect(wantsAi(plain, true)).toBe(false);
    expect(wantsAi({ ...plain, micros: null }, false)).toBe(false);
    expect(wantsAi({ ...plain, micros_est: null }, false)).toBe(false);
    expect(wantsAi(bhujia, false)).toBe(false);
  });

  it('show on the day', () => {
    const day = dayNutrients([{ id: '1', name: 'Aloo Bhujia', grams: 50, food: bhujia }]);
    expect(day.iron_mg.ai).toBe(true);
    expect(day.iron_mg.from[0]).toMatchObject({ amount: 2.05, ai: true });
    expect(day.sodium_mg.ai).toBe(false);
  });
});
