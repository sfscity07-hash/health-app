import { measureToServing } from '@/features/search/measures';
import { mapOffProduct, type OffProduct } from '@/features/search/off';
import { interleave, rankResults, relevance } from '@/features/search/rank';
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
      serving_size: '15 g',
      serving_quantity: '15',
      nutriments: { energy_100g: 2252, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9 },
    })!;
    expect(f.name).toBe('Nutella');
    expect(f.brand).toBe('Ferrero');
    expect(f.kcal_100g).toBeCloseTo(538.24, 1);
    expect(f.serving).toEqual({ label: 'serving', grams: 15 });
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

  it('drops duplicates across sources', () => {
    const ranked = rankResults('nutella', [food('Nutella', { brand: 'Ferrero', kcal_100g: 539 }), food('NUTELLA', { brand: 'Ferrero', kcal_100g: 539.2 })]);
    expect(ranked).toHaveLength(1);
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
