/**
 * The plain part of the estimate-nutrients Edge Function: what to ask Claude,
 * the shape of its answer, and checking that answer before it's saved. No
 * Deno or npm imports, so the app's tests run it too.
 */

/** Claude Opus 5.5: the best recall of food composition; each food is estimated once and kept, so a call costs about a cent. */
export const MODEL = 'claude-opus-5-5';

/** The nutrients the app tracks, with their units and the most a believable food has per 100 g (kept in step with the app's NUTRIENTS). */
export const NUTRIENTS = {
  sodium_mg: { name: 'sodium', unit: 'mg', max: 40000 },
  caffeine_mg: { name: 'caffeine', unit: 'mg', max: 10000 },
  sugar_g: { name: 'total sugars', unit: 'g', max: 100 },
  saturated_fat_g: { name: 'saturated fat', unit: 'g', max: 100 },
  cholesterol_mg: { name: 'cholesterol', unit: 'mg', max: 5000 },
  potassium_mg: { name: 'potassium', unit: 'mg', max: 60000 },
  calcium_mg: { name: 'calcium', unit: 'mg', max: 40000 },
  iron_mg: { name: 'iron', unit: 'mg', max: 1000 },
  magnesium_mg: { name: 'magnesium', unit: 'mg', max: 30000 },
  zinc_mg: { name: 'zinc', unit: 'mg', max: 2000 },
  vitamin_a_ug: { name: 'vitamin A (retinol activity equivalents)', unit: 'µg', max: 50000 },
  vitamin_c_mg: { name: 'vitamin C', unit: 'mg', max: 100000 },
  vitamin_d_ug: { name: 'vitamin D', unit: 'µg', max: 2500 },
  vitamin_b12_ug: { name: 'vitamin B12', unit: 'µg', max: 5000 },
  folate_ug: { name: 'folate (dietary folate equivalents)', unit: 'µg', max: 100000 },
} as const;

export type Key = keyof typeof NUTRIENTS;
export const KEYS = Object.keys(NUTRIENTS) as Key[];
export type Values = Partial<Record<Key, number>>;

/** At most this many foods per request, so a call finishes well inside the function's time limit. */
export const MAX_FOODS = 6;

export type FoodAsk = { id: string; missing: Key[] };

/** Checks the app's request: `{ foods: [{ id, missing: ["iron_mg", …] }] }`. */
export function parseRequest(body: unknown): { foods: FoodAsk[] } | { error: string } {
  const foods = (body as { foods?: unknown } | null)?.foods;
  if (!Array.isArray(foods) || foods.length === 0) return { error: 'Send foods: [{ id, missing }].' };
  if (foods.length > MAX_FOODS) return { error: `At most ${MAX_FOODS} foods at a time.` };
  const out: FoodAsk[] = [];
  for (const f of foods) {
    const id = (f as { id?: unknown })?.id;
    const missing = (f as { missing?: unknown })?.missing;
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return { error: 'Each food needs its id.' };
    if (!Array.isArray(missing)) return { error: 'Each food needs the nutrients it is missing.' };
    const keys = [...new Set(missing.filter((k): k is Key => typeof k === 'string' && k in NUTRIENTS))];
    if (keys.length) out.push({ id, missing: keys });
  }
  return { foods: out };
}

/** The food as the database has it (the columns the prompt uses). */
export type FoodRow = {
  id: string;
  name: string;
  brand: string | null;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  fiber_100g: number | null;
  sugar_100g?: number | null;
  sodium_mg_100g?: number | null;
  micros?: Values | null;
  micros_est?: Estimate | null;
};

export type AiPart = { model: string; from: string; confidence: 'low' | 'medium' | 'high'; values: Values };
export type Estimate = { by: string; from: string; values: Values; ai?: AiPart };

export const SYSTEM = `You estimate nutrient content for foods in a personal calorie tracker, for nutrients the food's label and USDA's data don't give.

Give each value per 100 g of the food as described (as sold; for a drink or dish, as it's consumed). Base the estimate on reference food-composition data for the closest matching food (USDA FoodData Central, the Indian Food Composition Tables (IFCT 2017) for Indian foods, UK CoFID), adjusted for the brand and for the calories and macros given. Keep values consistent with the macros: saturated fat can't exceed fat, and sugar can't exceed carbohydrate. Fortified products only get added vitamins if the name or brand says so.

Fill in only the nutrients asked for and give null for every other one. Give 0 when the food essentially contains none of a nutrient (caffeine in rice, cholesterol in a plant food). Give null when you can't make a reasonable estimate.

In basis, name the reference food you based it on in a few words, like "IFCT: wheat flakes, roasted" or "USDA: masala chai with milk". Set confidence to how close that reference is to this food.`;

const num = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** The food, what's known, and what to estimate, in plain words. */
export function userPrompt(food: FoodRow, missing: Key[]): string {
  const known: string[] = [];
  const label: Values = { ...(food.micros ?? {}) };
  if (label.sugar_g === undefined && num(food.sugar_100g) !== null) label.sugar_g = num(food.sugar_100g) as number;
  if (label.sodium_mg === undefined && num(food.sodium_mg_100g) !== null) label.sodium_mg = num(food.sodium_mg_100g) as number;
  for (const k of KEYS) if (typeof label[k] === 'number') known.push(`${NUTRIENTS[k].name} ${label[k]} ${NUTRIENTS[k].unit}`);
  const fiber = num(food.fiber_100g);
  return [
    `Food: ${food.name}${food.brand ? ` (brand: ${food.brand})` : ''}`,
    `Per 100 g: ${food.kcal_100g} kcal, protein ${food.protein_100g} g, carbohydrate ${food.carbs_100g} g, fat ${food.fat_100g} g${fiber !== null ? `, fibre ${fiber} g` : ''}.`,
    known.length ? `Already known from the label, per 100 g: ${known.join(', ')}.` : 'Nothing else is known from the label.',
    `Estimate per 100 g: ${missing.map((k) => `${k} (${NUTRIENTS[k].name}, ${NUTRIENTS[k].unit})`).join(', ')}.`,
  ].join('\n');
}

/** The answer's shape (structured output): every nutrient, a number or null, plus where the estimate comes from. One schema for every request. */
export const SCHEMA = {
  type: 'object',
  properties: {
    values: {
      type: 'object',
      properties: Object.fromEntries(KEYS.map((k) => [k, { anyOf: [{ type: 'number' }, { type: 'null' }] }])),
      required: KEYS,
      additionalProperties: false,
    },
    basis: { type: 'string' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
  required: ['values', 'basis', 'confidence'],
  additionalProperties: false,
} as const;

/**
 * Keeps only what was asked for and could be true: no negatives, nothing
 * beyond what a real food has, saturated fat within fat and sugar within
 * carbs. Null when nothing usable is left.
 */
export function cleanAnswer(answer: unknown, missing: Key[], food: FoodRow): Omit<AiPart, 'model'> | null {
  const a = answer as { values?: Record<string, unknown>; basis?: unknown; confidence?: unknown } | null;
  if (!a?.values) return null;
  const values: Values = {};
  for (const k of missing) {
    const v = a.values[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > NUTRIENTS[k].max) continue;
    if (k === 'saturated_fat_g' && v > food.fat_100g + 0.5) continue;
    if (k === 'sugar_g' && v > food.carbs_100g + 0.5) continue;
    values[k] = v >= 100 ? Math.round(v) : v >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 1000) / 1000;
  }
  if (Object.keys(values).length === 0) return null;
  const confidence = a.confidence === 'high' || a.confidence === 'medium' ? a.confidence : 'low';
  const from = typeof a.basis === 'string' ? a.basis.trim().slice(0, 120) : '';
  return { from, confidence, values };
}

/** The food's estimates with the AI part added, keeping anything borrowed from USDA. */
export function withAi(existing: Estimate | null | undefined, ai: AiPart): Estimate {
  return { by: existing?.by ?? 'none', from: existing?.from ?? '', values: existing?.values ?? {}, ai };
}

/** Stored when Claude declines or has nothing usable, so the food isn't asked about again. */
export const NOTHING = (model: string): AiPart => ({ model, from: '', confidence: 'low', values: {} });
