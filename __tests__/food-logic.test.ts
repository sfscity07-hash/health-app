import { buildCustomFood, parseQuickAdd } from '@/features/food/forms';
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
  default_serving_g: 150,
  default_serving_label: 'fillet',
};

describe('portions', () => {
  it('offers serving units first, then grams', () => {
    const units = unitsFor(salmon, [{ label: 'oz', grams: 28.35 }, { label: 'Fillet', grams: 150 }]);
    expect(units.map((u) => u.label)).toEqual(['fillet', 'oz', 'g']);
    expect(units[2]).toMatchObject({ grams: 1, step: 5, defaultQty: 150 });
  });

  it('scales nutrients from per-100 g values', () => {
    const n = nutrientsFor(salmon, 150);
    expect(n.kcal).toBeCloseTo(309);
    expect(n.protein_g).toBeCloseTo(33.15);
    expect(n.carbs_g).toBe(0);
    expect(n.fat_g).toBeCloseTo(18.6);
  });

  it('describes amounts the way people say them', () => {
    expect(describePortion(150, { label: 'g', grams: 1 })).toBe('150 g');
    expect(describePortion(1, { label: 'fillet', grams: 150 })).toBe('1 fillet · 150 g');
    expect(describePortion(1.5, { label: 'bar', grams: 60 })).toBe('1.5 bars · 90 g');
    expect(pluralize('oz', 2)).toBe('oz');
    expect(pluralize('glass', 2)).toBe('glass');
    expect(formatQty(0.25)).toBe('0.25');
  });
});

describe('quick add', () => {
  it('needs calories or macros', () => {
    expect(parseQuickAdd({ name: '', kcal: '', protein: '', carbs: '', fat: '' })).toMatchObject({ ok: false });
  });

  it('works out calories from macros when left blank', () => {
    const r = parseQuickAdd({ name: '', kcal: '', protein: '30', carbs: '40', fat: '10' });
    expect(r).toEqual({ ok: true, name: 'Quick add', nutrients: { kcal: 370, protein_g: 30, carbs_g: 40, fat_g: 10 } });
  });

  it('keeps typed calories and a name', () => {
    const r = parseQuickAdd({ name: ' Office cake ', kcal: '350', protein: '', carbs: '', fat: '' });
    expect(r).toEqual({ ok: true, name: 'Office cake', nutrients: { kcal: 350, protein_g: 0, carbs_g: 0, fat_g: 0 } });
  });
});

describe('custom foods', () => {
  const base = { name: 'Protein bar', brand: 'Grenade', servingLabel: 'Bar', servingGrams: '60', kcal: '210', protein: '20', carbs: '22', fat: '7' };

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
        default_serving_g: 60,
        default_serving_label: 'bar',
      },
    });
  });

  it('treats values as per 100 g when there is no serving name', () => {
    const r = buildCustomFood({ ...base, servingLabel: '', servingGrams: '' });
    expect(r.ok && r.food.kcal_100g).toBe(210);
    expect(r.ok && r.food.default_serving_label).toBeNull();
  });

  it('catches impossible numbers', () => {
    expect(buildCustomFood({ ...base, servingGrams: '10' })).toMatchObject({ ok: false, error: expect.stringMatching(/more than the serving weighs/) });
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

  it('one tap logs a named serving, or the usual weight in grams', () => {
    expect(defaultPortion(salmon)).toEqual({ qty: 1, unit: 'fillet', grams: 150 });
    expect(defaultPortion({ ...salmon, default_serving_label: null, default_serving_g: 100 })).toEqual({ qty: 100, unit: 'g', grams: 100 });
  });
});
