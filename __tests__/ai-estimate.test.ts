import { NUTRIENTS as APP_NUTRIENTS } from '@/features/nutrients/micros';

import { cleanAnswer, KEYS, MAX_FOODS, NUTRIENTS, parseRequest, SCHEMA, userPrompt, withAi, type FoodRow } from '../supabase/functions/estimate-nutrients/estimate';

const id = '11111111-2222-3333-4444-555555555555';
const bhujia: FoodRow = {
  id,
  name: 'Aloo Bhujia',
  brand: 'Haldiram',
  kcal_100g: 597,
  protein_100g: 9.4,
  carbs_100g: 41.3,
  fat_100g: 44.4,
  fiber_100g: null,
  sugar_100g: 2.1,
  micros: { sodium_mg: 1050 },
};

describe('the AI estimate function', () => {
  it('knows the same nutrients, units and limits as the app', () => {
    expect(KEYS).toEqual(APP_NUTRIENTS.map((n) => n.key));
    for (const n of APP_NUTRIENTS) {
      expect(NUTRIENTS[n.key].unit).toBe(n.unit);
      expect(NUTRIENTS[n.key].max).toBe(n.max100);
    }
  });

  it('accepts only real foods and nutrients, a few at a time', () => {
    expect(parseRequest({ foods: [{ id, missing: ['iron_mg', 'iron_mg', 'bogus'] }] })).toEqual({ foods: [{ id, missing: ['iron_mg'] }] });
    expect(parseRequest({ foods: [{ id: 'nope', missing: ['iron_mg'] }] })).toEqual({ error: 'Each food needs its id.' });
    expect(parseRequest({ foods: Array.from({ length: MAX_FOODS + 1 }, () => ({ id, missing: ['iron_mg'] })) })).toHaveProperty('error');
    expect(parseRequest(null)).toHaveProperty('error');
  });

  it('tells Claude the food, its macros, what the label already says, and what to estimate', () => {
    const prompt = userPrompt(bhujia, ['iron_mg', 'caffeine_mg']);
    expect(prompt).toContain('Food: Aloo Bhujia (brand: Haldiram)');
    expect(prompt).toContain('597 kcal, protein 9.4 g, carbohydrate 41.3 g, fat 44.4 g.');
    expect(prompt).toContain('sodium 1050 mg, total sugars 2.1 g');
    expect(prompt).toContain('Estimate per 100 g: iron_mg (iron, mg), caffeine_mg (caffeine, mg).');
  });

  it('asks for every nutrient in one fixed shape, each a number or null', () => {
    expect(SCHEMA.properties.values.required).toEqual(KEYS);
    expect(SCHEMA.additionalProperties).toBe(false);
  });

  it('keeps only believable answers to what was asked', () => {
    const answer = {
      values: { iron_mg: 4.137, potassium_mg: 520, calcium_mg: -5, saturated_fat_g: 80, sugar_g: 2, vitamin_c_mg: null },
      basis: '  IFCT: bhujia  ',
      confidence: 'medium',
    };
    expect(cleanAnswer(answer, ['iron_mg', 'calcium_mg', 'saturated_fat_g', 'sugar_g', 'vitamin_c_mg'], bhujia)).toEqual({
      from: 'IFCT: bhujia',
      confidence: 'medium',
      values: { iron_mg: 4.137, sugar_g: 2 },
    });
    expect(cleanAnswer({ values: { iron_mg: null }, basis: '', confidence: 'high' }, ['iron_mg'], bhujia)).toBeNull();
    expect(cleanAnswer('nonsense', ['iron_mg'], bhujia)).toBeNull();
  });

  it('adds the AI part next to anything borrowed from USDA', () => {
    const usda = { by: 'usda', from: 'Yogurt, Greek, plain', values: { potassium_mg: 141 } };
    const ai = { model: 'claude-opus-5-5', from: 'IFCT', confidence: 'low' as const, values: { iron_mg: 0.1 } };
    expect(withAi(usda, ai)).toEqual({ ...usda, ai });
    expect(withAi(null, ai)).toEqual({ by: 'none', from: '', values: {}, ai });
  });
});
