import { buildCustomFood, parseQuickAdd, parseUnit, type CustomFoodForm } from '@/features/food/forms';
import { matches, rankRecents, type LoggedRow } from '@/features/food/recents';
import { defaultPortion, describeLogged, describePortion, formatQty, nutrientsFor, pluralize, unitsFor, type FoodRecord } from '@/lib/portion';

const salmon: FoodRecord = {
  id: 'f1',
  source: 'usda',
  name: 'Salmon, Atlantic, cooked',
  brand: null,
  kcal_100g: 206,
  protein_100g: 22.1,
  carbs_100g: 0,
  fat_100g: 12.4,
  fiber_100g: null,
  default_serving_g: 150,
  default_serving_label: 'fillet',
};

describe('portions', () => {
  it('offers serving units first, then grams', () => {
    const units = unitsFor(salmon, [{ label: 'oz', grams: 28.35 }, { label: 'Fillet', grams: 150 }, { label: 'cup', grams: 140 }]);
    // g and oz are always there (a food's own "oz" isn't repeated); its own units come first.
    expect(units.map((u) => u.label)).toEqual(['fillet', 'cup', 'g', 'oz']);
    expect(units[2]).toMatchObject({ grams: 1, step: 5, defaultQty: 150 });
    expect(units[3]).toMatchObject({ step: 0.25, defaultQty: 5.25 });
  });

  it('scales nutrients from per-100 g values', () => {
    const n = nutrientsFor(salmon, 150);
    expect(n.kcal).toBeCloseTo(309);
    expect(n.protein_g).toBeCloseTo(33.15);
    expect(n.carbs_g).toBe(0);
    expect(n.fat_g).toBeCloseTo(18.6);
    // No fibre listed counts as none.
    expect(n.fiber_g).toBe(0);
    expect(nutrientsFor({ ...salmon, fiber_100g: 8 }, 50).fiber_g).toBe(4);
  });

  it('describes amounts the way people say them', () => {
    expect(describePortion(150, { label: 'g', grams: 1 })).toBe('150 g');
    expect(describePortion(1, { label: 'fillet', grams: 150 })).toBe('1 fillet · 150 g');
    expect(describePortion(1.5, { label: 'bar', grams: 60 })).toBe('1.5 bars · 90 g');
    expect(pluralize('oz', 2)).toBe('oz');
    expect(pluralize('tbsp', 2)).toBe('tbsp');
    expect(pluralize('scoop', 2)).toBe('scoops');
    expect(describePortion(250, { label: 'ml', grams: 1.03 })).toBe('250 ml');
    expect(pluralize('glass', 2)).toBe('glass');
    expect(formatQty(0.25)).toBe('0.25');
  });
});

describe('quick add', () => {
  it('needs calories or macros', () => {
    expect(parseQuickAdd({ name: '', kcal: '', protein: '', carbs: '', fat: '', fiber: '' })).toMatchObject({ ok: false });
    // Fibre alone has no calories to work out.
    expect(parseQuickAdd({ name: '', kcal: '', protein: '', carbs: '', fat: '', fiber: '6' })).toMatchObject({ ok: false });
  });

  it('works out calories from macros when left blank', () => {
    const r = parseQuickAdd({ name: '', kcal: '', protein: '30', carbs: '40', fat: '10', fiber: '6' });
    expect(r).toEqual({ ok: true, name: 'Quick add', nutrients: { kcal: 370, protein_g: 30, carbs_g: 40, fat_g: 10, fiber_g: 6 } });
  });

  it('keeps typed calories and a name', () => {
    const r = parseQuickAdd({ name: ' Office cake ', kcal: '350', protein: '', carbs: '', fat: '', fiber: '' });
    expect(r).toEqual({ ok: true, name: 'Office cake', nutrients: { kcal: 350, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 } });
  });
});

describe('custom foods', () => {
  const base: CustomFoodForm = {
    name: 'Protein bar',
    brand: 'Grenade',
    unit: 'Bar',
    unitGrams: '60',
    basis: 'unit',
    kcal: '210',
    protein: '20',
    carbs: '22',
    fat: '7',
    fiber: '',
    extraUnits: [],
  };

  it('converts per-serving label values to per 100 g', () => {
    const r = buildCustomFood(base);
    expect(r).toEqual({
      ok: true,
      food: {
        source: 'custom',
        name: 'Protein bar',
        brand: 'Grenade',
        kcal_100g: 350,
        protein_100g: 33.33,
        carbs_100g: 36.67,
        fat_100g: 11.67,
        fiber_100g: null,
        default_serving_g: 60,
        default_serving_label: 'bar',
      },
      servings: [],
    });
  });

  it('treats values as per 100 g when measured in grams', () => {
    const r = buildCustomFood({ ...base, unit: 'g', unitGrams: '' });
    expect(r.ok && r.food.kcal_100g).toBe(210);
    expect(r.ok && r.food.default_serving_label).toBeNull();
  });

  it('measures protein powder by the scoop, from either column of the label', () => {
    const whey = { ...base, name: 'Whey', brand: '', unit: 'scoop', unitGrams: '30', kcal: '120', protein: '24', carbs: '3', fat: '1.5' };
    const perScoop = buildCustomFood(whey);
    expect(perScoop).toMatchObject({ ok: true, food: { kcal_100g: 400, protein_100g: 80, default_serving_label: 'scoop', default_serving_g: 30 } });
    const per100 = buildCustomFood({ ...whey, basis: '100', kcal: '400', protein: '80', carbs: '10', fat: '5' });
    expect(per100).toMatchObject({ ok: true, food: { kcal_100g: 400, protein_100g: 80, default_serving_g: 30 } });
  });

  it('measures drinks per 100 ml', () => {
    const r = buildCustomFood({ ...base, name: 'Milk', unit: 'ml', unitGrams: '1.03', kcal: '64', protein: '3.4', carbs: '4.8', fat: '3.6' });
    expect(r).toMatchObject({ ok: true, food: { default_serving_label: 'ml', default_serving_g: 1.03 } });
    expect(r.ok && r.food.kcal_100g).toBeCloseTo(62.14, 2);
  });

  it('saves more units, skipping empty rows and catching repeats', () => {
    const r = buildCustomFood({ ...base, extraUnits: [{ label: 'Tbsp', grams: '10' }, { label: '', grams: '' }] });
    expect(r.ok && r.servings).toEqual([{ label: 'tbsp', grams: 10 }]);
    expect(buildCustomFood({ ...base, extraUnits: [{ label: 'bar', grams: '60' }] })).toMatchObject({ ok: false, error: expect.stringMatching(/already a “bar”/) });
    expect(buildCustomFood({ ...base, extraUnits: [{ label: 'oz', grams: '28' }] })).toMatchObject({ ok: false, error: expect.stringMatching(/already/) });
    expect(buildCustomFood({ ...base, extraUnits: [{ label: 'cup', grams: '' }] })).toMatchObject({ ok: false, error: expect.stringMatching(/one cup weighs/) });
  });

  it('reads "1 scoop" as the unit "scoop"', () => {
    expect(parseUnit({ label: '1 Scoop', grams: '31.5' })).toEqual({ ok: true, serving: { label: 'scoop', grams: 31.5 } });
    expect(parseUnit({ label: 'Millilitres', grams: '1' })).toEqual({ ok: true, serving: { label: 'ml', grams: 1 } });
    expect(parseUnit({ label: 'g', grams: '1' })).toMatchObject({ ok: false });
  });

  it('stores fibre per 100 g, or leaves it unknown', () => {
    const r = buildCustomFood({ ...base, fiber: '4.5' });
    expect(r.ok && r.food.fiber_100g).toBe(7.5);
    expect(buildCustomFood({ ...base, fiber: '' })).toMatchObject({ ok: true, food: { fiber_100g: null } });
    expect(buildCustomFood({ ...base, fiber: 'lots' })).toMatchObject({ ok: false, error: expect.stringMatching(/Fibre/) });
    expect(buildCustomFood({ ...base, fiber: '70' })).toMatchObject({ ok: false, error: expect.stringMatching(/more fibre/) });
  });

  it('catches impossible numbers', () => {
    expect(buildCustomFood({ ...base, unitGrams: '10' })).toMatchObject({ ok: false, error: expect.stringMatching(/more than one bar weighs/) });
    expect(buildCustomFood({ ...base, unitGrams: '' })).toMatchObject({ ok: false, error: expect.stringMatching(/how many grams one bar weighs/) });
    expect(buildCustomFood({ ...base, kcal: '2000', protein: '', carbs: '', fat: '' })).toMatchObject({ ok: false, error: expect.stringMatching(/900 kcal/) });
    expect(buildCustomFood({ ...base, name: ' ' })).toMatchObject({ ok: false });
  });
});

describe('recents', () => {
  const row = (over: Partial<LoggedRow>): LoggedRow => ({
    food_id: 'a',
    name: 'Oats',
    brand: null,
    quantity: 50,
    unit: 'g',
    grams: 50,
    kcal: 190,
    protein_g: 6,
    carbs_g: 33,
    fat_g: 3,
    fiber_g: 5,
    external_key: null,
    meal: 'breakfast',
    log_date: '2026-10-05',
    ...over,
  });

  it('ranks by frequency, favouring this meal, and keeps the latest amount', () => {
    const rows = [
      row({ food_id: 'rice', name: 'Rice', meal: 'dinner', quantity: 180, log_date: '2026-10-05' }),
      row({ food_id: 'oats', name: 'Oats', quantity: 60, log_date: '2026-10-05' }),
      row({ food_id: 'oats', name: 'Oats', quantity: 50, log_date: '2026-10-04' }),
      row({ food_id: 'rice', name: 'Rice', meal: 'dinner', quantity: 150, log_date: '2026-09-01' }),
      row({ food_id: null, name: 'Quick add', kcal: 300, meal: 'snack', log_date: '2026-10-01' }),
    ];
    const atDinner = rankRecents(rows, 'dinner', '2026-10-06');
    expect(atDinner[0].name).toBe('Rice');
    expect(atDinner[0].last.quantity).toBe(180);
    expect(atDinner[0].count).toBe(2);
    expect(rankRecents(rows, 'breakfast', '2026-10-06')[0].name).toBe('Oats');
    expect(atDinner.find((r) => r.foodId === null)?.key).toBe('quick:quick add|300');
  });

  it('matches by name or brand, ignoring case', () => {
    expect(matches('grEN', 'Protein bar', 'Grenade')).toBe(true);
    expect(matches('salmon', 'Protein bar', null)).toBe(false);
    expect(matches('', 'Anything')).toBe(true);
  });
});

describe('logged portions', () => {
  it('reads naturally in lists', () => {
    expect(describeLogged(150, 'g', 150)).toBe('150 g');
    expect(describeLogged(2, 'bar', 120)).toBe('2 bars · 120 g');
    expect(describeLogged(1, 'serving', null)).toBe('1 serving');
  });

  it('measures drinks in millilitres with a fine ruler', () => {
    const milk = { ...salmon, name: 'Milk', default_serving_label: 'ml', default_serving_g: 1.03 };
    const [ml, g] = unitsFor(milk);
    expect(ml).toMatchObject({ label: 'ml', grams: 1.03, step: 10, defaultQty: 250 });
    expect(g.defaultQty).toBe(260);
    expect(defaultPortion(milk)).toEqual({ qty: 250, unit: 'ml', grams: 257.5 });
    expect(describeLogged(250, 'ml', 257.5)).toBe('250 ml');
  });

  it('one tap logs a named serving, or the usual weight in grams', () => {
    expect(defaultPortion(salmon)).toEqual({ qty: 1, unit: 'fillet', grams: 150 });
    expect(defaultPortion({ ...salmon, default_serving_label: null, default_serving_g: 100 })).toEqual({ qty: 100, unit: 'g', grams: 100 });
  });
});
