import { measureToServing } from '@/features/search/measures';
import { energyFits, mapOffProduct, type OffProduct } from '@/features/search/off';
import { interleave, MIN_RELEVANCE, nameTokens, rankResults, relevance, sameFood, withoutLocal } from '@/features/search/rank';
import { usSpelling } from '@/features/search/spelling';
import { asFood, type ExternalFood } from '@/features/search/types';
import { mapUsdaFood, type UsdaFood } from '@/features/search/usda';
import { defaultPortion, nutrientsFor } from '@/lib/portion';

// Trimmed from real FoodData Central search responses.
const usdaBanana: UsdaFood = {
  fdcId: 173944,
  description: 'Bananas, raw',
  dataType: 'SR Legacy',
  foodNutrients: [
    { nutrientId: 1003, nutrientNumber: '203', unitName: 'G', value: 1.09 },
    { nutrientId: 1004, nutrientNumber: '204', unitName: 'G', value: 0.33 },
    { nutrientId: 1005, nutrientNumber: '205', unitName: 'G', value: 22.8 },
    { nutrientId: 1008, nutrientNumber: '208', unitName: 'KCAL', value: 89 },
    { nutrientId: 1062, nutrientNumber: '268', unitName: 'KJ', value: 371 },
    { nutrientId: 1079, nutrientNumber: '291', unitName: 'G', value: 2.6 },
    { nutrientId: 2000, nutrientNumber: '269', unitName: 'G', value: 12.2 },
    { nutrientId: 1093, nutrientNumber: '307', unitName: 'MG', value: 1 },
  ],
  foodMeasures: [
    { disseminationText: '1 cup, sliced', gramWeight: 150, rank: 2 },
    { disseminationText: '1 medium (7" to 7-7/8" long)', gramWeight: 118, rank: 1 },
    { disseminationText: 'Quantity not specified', gramWeight: 118, rank: 9 },
  ],
};

// Foundation foods often list energy only as Atwater factors.
const usdaFoundation: UsdaFood = {
  fdcId: 2346396,
  description: 'Oats, whole grain, rolled, old fashioned',
  dataType: 'Foundation',
  foodNutrients: [
    { nutrientId: 1003, unitName: 'G', value: 13.5 },
    { nutrientId: 1004, unitName: 'G', value: 5.89 },
    { nutrientId: 1050, unitName: 'G', value: 68.7 },
    { nutrientId: 2047, unitName: 'KCAL', value: 382 },
    { nutrientId: 1079, unitName: 'G', value: 10.1 },
  ],
};

const offBar: OffProduct = {
  code: '5060221205026',
  product_name: 'Carb Killa Chocolate Chip Salted Caramel',
  brands: 'Grenade, Grenade Carb Killa',
  serving_size: '1 bar (60 g)',
  serving_quantity: 60,
  nutriments: {
    'energy-kcal_100g': 357,
    proteins_100g: 35,
    carbohydrates_100g: 28.3,
    fat_100g: 13.3,
    fiber_100g: 8.5,
    sugars_100g: 2.2,
    salt_100g: 0.6,
  },
};

describe('USDA results', () => {
  it('maps nutrients per 100 g, fibre included, with the usual serving first', () => {
    const f = mapUsdaFood(usdaBanana)!;
    expect(f).toMatchObject({
      key: 'usda:173944',
      name: 'Bananas, raw',
      kcal_100g: 89,
      protein_100g: 1.09,
      carbs_100g: 22.8,
      fat_100g: 0.33,
      fiber_100g: 2.6,
      sodium_mg_100g: 1,
      generic: true,
      serving: { label: 'medium', grams: 118 },
    });
    expect(f.servings).toEqual([{ label: 'cup, sliced', grams: 150 }]);
  });

  it('uses Atwater energy and summed carbs when that is all a food lists', () => {
    const f = mapUsdaFood(usdaFoundation)!;
    expect(f.kcal_100g).toBe(382);
    expect(f.carbs_100g).toBe(68.7);
    expect(f.serving).toBeNull();
  });

  it('works out kcal from kJ and tidies names written in capitals', () => {
    const f = mapUsdaFood({
      fdcId: 1,
      description: 'GREEK YOGURT, PLAIN',
      dataType: 'Branded',
      brandOwner: 'FAGE USA DAIRY INDUSTRY',
      servingSize: 170,
      servingSizeUnit: 'g',
      householdServingFullText: '1 container',
      foodNutrients: [{ nutrientId: 1062, unitName: 'KJ', value: 418.4 }],
    })!;
    expect(f.kcal_100g).toBe(100);
    expect(f.name).toBe('Greek Yogurt, Plain');
    expect(f.brand).toBe('Fage Usa Dairy Industry');
    expect(f.serving).toEqual({ label: 'container', grams: 170 });
  });

  it('drops results without energy or with impossible numbers', () => {
    expect(mapUsdaFood({ fdcId: 2, description: 'Mystery', foodNutrients: [] })).toBeNull();
    expect(
      mapUsdaFood({ fdcId: 3, description: 'Broken', foodNutrients: [{ nutrientId: 1008, unitName: 'KCAL', value: 4000 }] }),
    ).toBeNull();
  });
});

describe('Open Food Facts results', () => {
  it('maps a product with its serving, first brand, fibre and sodium from salt', () => {
    const f = mapOffProduct(offBar)!;
    expect(f).toMatchObject({
      key: 'off:5060221205026',
      barcode: '5060221205026',
      brand: 'Grenade',
      kcal_100g: 357,
      fiber_100g: 8.5,
      sodium_mg_100g: 240,
      serving: { label: 'bar', grams: 60 },
      generic: false,
    });
  });

  it('reads names and brands from the newer search service too', () => {
    const f = mapOffProduct({
      code: '3017620422003',
      product_name: { en: 'Nutella', fr: 'Nutella' },
      brands: ['Ferrero', 'Nutella'],
      unique_scans_n: 25000,
      serving_size: '15 g',
      serving_quantity: '15',
      nutriments: { energy_100g: 2252, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9 },
    })!;
    expect(f.name).toBe('Nutella');
    expect(f.brand).toBe('Ferrero');
    expect(f.kcal_100g).toBeCloseTo(538.24, 1);
    expect(f.serving).toEqual({ label: 'serving', grams: 15 });
  });

  it('skips half-filled entries and ones whose calories don’t fit their macros', () => {
    expect(mapOffProduct({ code: '3', product_name: 'Bananas', nutriments: { 'energy-kcal_100g': 95 } })).toBeNull();
    expect(mapOffProduct({ ...offBar, unique_scans_n: 812 })?.popularity).toBe(812);
    // 45 kcal can't hold 20 g protein, 50 g carbs and 20 g fat: a typo.
    expect(energyFits(45, 20, 50, 20)).toBe(false);
    expect(energyFits(460, 20, 50, 20)).toBe(true);
    // Beer: most of its energy is alcohol.
    expect(energyFits(43, 0.5, 3.6, 0, 3.9)).toBe(true);
    expect(mapOffProduct({ ...offBar, nutriments: { ...offBar.nutriments, 'energy-kcal_100g': 35.7 } })).toBeNull();
  });

  it('never shows a bare brand as a food name', () => {
    const greatValue = { code: '0078742', brands: 'Great Value', nutriments: { 'energy-kcal_100g': 59, proteins_100g: 10, carbohydrates_100g: 3.5, fat_100g: 0.4 } };
    // Only the brand, nothing else to go on: skipped.
    expect(mapOffProduct({ ...greatValue, product_name: 'Great Value' })).toBeNull();
    // The category says what it is.
    expect(
      mapOffProduct({ ...greatValue, product_name: 'Great Value', categories_tags: ['en:dairies', 'en:yogurts', 'en:greek-style-yogurts'] })?.name,
    ).toBe('Great Value greek style yogurts');
    // So does a generic name.
    expect(mapOffProduct({ ...greatValue, product_name: 'Great Value', generic_name: 'Nonfat Greek yogurt' })?.name).toBe('Great Value nonfat Greek yogurt');
    // Products people know by the brand keep it.
    expect(mapOffProduct({ ...greatValue, code: '505', product_name: 'Pringles', brands: 'Pringles', unique_scans_n: 900, nutriments: { 'energy-kcal_100g': 536, proteins_100g: 4, carbohydrates_100g: 52, fat_100g: 34 } })?.name).toBe('Pringles');
    // Codes aren't names.
    expect(mapOffProduct({ ...greatValue, product_name: '0078742012345' })).toBeNull();
  });

  it('doesn’t open on a serving of a gram or two', () => {
    const sweetener = mapOffProduct({
      code: '0078742011',
      product_name: 'Sweetener packets',
      brands: 'Great Value',
      serving_size: '1 packet (1 g)',
      serving_quantity: 1,
      nutriments: { 'energy-kcal_100g': 364, proteins_100g: 0, carbohydrates_100g: 91, fat_100g: 0 },
    })!;
    expect(sweetener.serving).toBeNull();
    expect(sweetener.servings).toEqual([{ label: 'packet', grams: 1 }]);
  });

  it('skips products without a name or energy', () => {
    expect(mapOffProduct({ code: '1', product_name: '', nutriments: { 'energy-kcal_100g': 100 } })).toBeNull();
    expect(mapOffProduct({ code: '2', product_name: 'Water', nutriments: {} })).toBeNull();
  });
});

describe('household measures', () => {
  it('turns one of something into a countable serving', () => {
    expect(measureToServing('1 slice', 28)).toEqual({ label: 'slice', grams: 28 });
    expect(measureToServing('1 bar (40g)', 40)).toEqual({ label: 'bar', grams: 40 });
  });

  it('keeps other amounts as written, and plain weights as "serving"', () => {
    expect(measureToServing('2 tbsp', 32)).toEqual({ label: 'serving (2 tbsp)', grams: 32 });
    expect(measureToServing('1/2 cup', 120)).toEqual({ label: 'serving (1/2 cup)', grams: 120 });
    expect(measureToServing('30 g', 30)).toEqual({ label: 'serving', grams: 30 });
  });

  it('ignores measures without a weight', () => {
    expect(measureToServing('1 cup', 0)).toBeNull();
    expect(measureToServing('', 30)).toBeNull();
  });
});

describe('ranking', () => {
  const food = (name: string, extra: Partial<ExternalFood> = {}): ExternalFood => ({
    key: name,
    source: 'off',
    externalId: name,
    name,
    brand: null,
    barcode: null,
    kcal_100g: 100,
    protein_100g: 1,
    carbs_100g: 20,
    fat_100g: 1,
    fiber_100g: null,
    sugar_100g: null,
    sodium_mg_100g: null,
    serving: null,
    servings: [],
    generic: false,
    ...extra,
  });

  it('puts the plain whole food first for a one-word search', () => {
    const ranked = rankResults('banana', [
      food('Banana chips, sweetened, fried'),
      food('Organic banana bread with walnuts'),
      food('Bananas, raw', { source: 'usda', generic: true, kcal_100g: 89 }),
    ]);
    expect(ranked[0].name).toBe('Bananas, raw');
  });

  it('needs every word, but counts the brand', () => {
    expect(relevance('chicken breast', food('Chicken thigh'))).toBeLessThan(relevance('chicken breast', food('Chicken breast, grilled')));
    const ranked = rankResults('grenade bar', [food('Protein bar', { brand: 'Grenade' }), food('Granola')]);
    expect(ranked.map((f) => f.name)).toEqual(['Protein bar']);
  });

  // What a search for "banana" really returns: the same fruit from three USDA
  // datasets and several supermarkets, plus foods that only share the word.
  const bananas = [
    food('Bananas, raw', { source: 'usda', generic: true, kcal_100g: 89, protein_100g: 1.09, carbs_100g: 22.84, fat_100g: 0.33, fiber_100g: 2.6, serving: { label: 'medium', grams: 118 } }),
    food('Banana, raw', { source: 'usda', generic: true, kcal_100g: 89, protein_100g: 1.09, carbs_100g: 22.84, fat_100g: 0.33 }),
    food('Bananas, ripe and slightly ripe, raw', { source: 'usda', generic: true, kcal_100g: 97, protein_100g: 0.74, carbs_100g: 23, fat_100g: 0.29 }),
    food('Bananas, overripe, raw', { source: 'usda', generic: true, kcal_100g: 85, protein_100g: 0.73, carbs_100g: 20.1, fat_100g: 0.22 }),
    food('Bananas', { brand: 'Tesco', kcal_100g: 95, protein_100g: 1.2, carbs_100g: 20.3, fat_100g: 0.1 }),
    food('Fairtrade Bananas', { brand: "Sainsbury's", kcal_100g: 95, protein_100g: 1.2, carbs_100g: 20.3, fat_100g: 0.1 }),
    food('Banana chips', { source: 'usda', generic: true, kcal_100g: 519, protein_100g: 2.3, carbs_100g: 58.4, fat_100g: 33.6 }),
    food('Banana Bread', { brand: 'Soreen', kcal_100g: 326, protein_100g: 6.9, carbs_100g: 60, fat_100g: 4.7 }),
  ];

  it('shows each food once, however many databases and shops list it', () => {
    const ranked = rankResults('banana', bananas);
    expect(ranked.map((f) => f.name)).toEqual(['Bananas, raw', 'Banana chips', 'Banana Bread']);
  });

  it('merges the same product sold in different sizes and countries', () => {
    const ranked = rankResults('nutella', [
      food('Nutella', { brand: 'Ferrero', kcal_100g: 539, protein_100g: 6.3, carbs_100g: 57.5, fat_100g: 30.9 }),
      food('NUTELLA 750g', { brand: 'Ferrero', kcal_100g: 539.2, protein_100g: 6.3, carbs_100g: 57.5, fat_100g: 30.9 }),
      food('Pâte à tartiner Nutella', { brand: 'Ferrero', kcal_100g: 546, protein_100g: 6, carbs_100g: 57, fat_100g: 31 }),
      food('Nutella Biscuits', { brand: 'Ferrero', kcal_100g: 511, protein_100g: 7.1, carbs_100g: 64.1, fat_100g: 22.9 }),
    ]);
    expect(ranked.map((f) => f.name)).toEqual(['Nutella', 'Nutella Biscuits']);
  });

  it('keeps foods with the same name but different numbers apart', () => {
    const yogurt = rankResults('greek yogurt', [
      food('Greek yogurt, plain, nonfat', { kcal_100g: 59, protein_100g: 10.2, carbs_100g: 3.6, fat_100g: 0.4 }),
      food('Greek yogurt, plain, whole milk', { kcal_100g: 97, protein_100g: 9, carbs_100g: 3.98, fat_100g: 5 }),
    ]);
    expect(yogurt).toHaveLength(2);
    const chicken = rankResults('chicken breast', [
      food('Chicken breast, raw', { kcal_100g: 120, protein_100g: 22.5, carbs_100g: 0, fat_100g: 2.6 }),
      food('Chicken breast, roasted', { kcal_100g: 165, protein_100g: 31, carbs_100g: 0, fat_100g: 3.6 }),
    ]);
    expect(chicken).toHaveLength(2);
  });

  it('borrows a serving and fibre from a duplicate when the kept result has none', () => {
    const [only] = rankResults('banana', [
      food('Banana, raw', { source: 'usda', generic: true, kcal_100g: 89, protein_100g: 1.09, carbs_100g: 22.84, fat_100g: 0.33 }),
      food('Bananas', { kcal_100g: 92, protein_100g: 1.1, carbs_100g: 21, fat_100g: 0.3, fiber_100g: 2.4, serving: { label: 'banana', grams: 120 } }),
    ]);
    expect(only.name).toBe('Banana, raw');
    expect(only.serving).toEqual({ label: 'banana', grams: 120 });
    expect(only.fiber_100g).toBe(2.4);
  });

  it('treats one brand’s product listed twice under the same name as one, keeping the well-known copy', () => {
    const ranked = rankResults('weetabix', [
      food('Weetabix', { brand: 'Weetabix', kcal_100g: 136, protein_100g: 4.5, carbs_100g: 27.6, fat_100g: 0.8, popularity: 3 }),
      food('Weetabix', { brand: 'Weetabix', kcal_100g: 362, protein_100g: 12, carbs_100g: 69, fat_100g: 2, popularity: 4200 }),
    ]);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].kcal_100g).toBe(362);
  });

  it('reads names the way people mean them', () => {
    expect(nameTokens('Bananas, raw')).toEqual(['banana', 'raw']);
    expect(nameTokens('NUTELLA 750g x2')).toEqual(['nutella']);
    expect(nameTokens('Tomatoes and berries')).toEqual(['tomato', 'berry']);
    expect(sameFood(bananas[0], bananas[6])).toBe(false);
  });

  it('hides results already in Recent or Your foods', () => {
    const results = rankResults('banana', bananas);
    const shown = withoutLocal(results, new Set(['Banana chips']), [{ name: 'Banana bread', kcal_100g: 330, protein_100g: 7, carbs_100g: 59, fat_100g: 5 }]);
    expect(shown.map((f) => f.name)).toEqual(['Bananas, raw']);
  });

  it('treats British and American spellings as the same word', () => {
    expect(usSpelling('Great Value greek Yoghurt')).toBe('Great Value greek yogurt');
    const wanted = food('Greek Nonfat Yogurt', { brand: 'Great Value', kcal_100g: 59, protein_100g: 10, carbs_100g: 3.6, fat_100g: 0.4 });
    expect(relevance('great value greek yoghurt', wanted)).toBeGreaterThan(MIN_RELEVANCE + 6);
    // Same yogurt, two spellings: one result.
    expect(rankResults('greek yoghurt', [wanted, food('Greek Yoghurt, nonfat', { brand: 'Great Value', kcal_100g: 59, protein_100g: 10, carbs_100g: 3.6, fat_100g: 0.4 })])).toHaveLength(1);
  });

  it('drops a result that only matched the start of what you were typing', () => {
    // "Great Value" matched "great value", but not "great value greek yoghurt".
    expect(relevance('great value greek yoghurt', food('Great Value Sweetener', { brand: 'Great Value' }))).toBeLessThanOrEqual(MIN_RELEVANCE);
  });

  it('alternates sources before ranking', () => {
    expect(interleave<number | string>([1, 2, 3], ['a'])).toEqual([1, 'a', 2, 3]);
  });

  it('logs a search result at its serving in one tap', () => {
    const f = asFood(mapUsdaFood(usdaBanana)!);
    const p = defaultPortion(f);
    expect(p).toEqual({ qty: 1, unit: 'medium', grams: 118 });
    expect(nutrientsFor(f, p.grams).kcal).toBeCloseTo(105, 0);
    expect(nutrientsFor(f, p.grams).fiber_g).toBeCloseTo(3.07, 2);
  });
});
