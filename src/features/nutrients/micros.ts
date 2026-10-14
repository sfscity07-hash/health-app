import { nameHead } from '@/features/water/drinks';

/**
 * Micronutrients, salt and caffeine. Foods keep what their label or database
 * lists (`micros`, per 100 g). Gaps can be filled with an estimate
 * (`micros_est`): borrowed from USDA's generic version of the same food, added
 * up from a recipe's ingredients, or (later) from AI, always marked as an
 * estimate. Caffeine also comes from a short list of typical amounts. A gap is
 * never counted as zero.
 */

export const MICRO_KEYS = [
  'sodium_mg',
  'caffeine_mg',
  'sugar_g',
  'saturated_fat_g',
  'cholesterol_mg',
  'potassium_mg',
  'calcium_mg',
  'iron_mg',
  'magnesium_mg',
  'zinc_mg',
  'vitamin_a_ug',
  'vitamin_c_mg',
  'vitamin_d_ug',
  'vitamin_b12_ug',
  'folate_ug',
] as const;

export type MicroKey = (typeof MICRO_KEYS)[number];
/** Amounts per 100 g; a key is there only when it's known. */
export type Micros = Partial<Record<MicroKey, number>>;
/** Where estimated amounts came from: a generic USDA food, a recipe's ingredients, or AI. "none": looked, nothing to borrow. */
export type MicroEstimate = { by: 'usda' | 'recipe' | 'ai' | 'none'; from: string; values: Micros };

/** Stored once a food has been checked for estimates and there was nothing honest to borrow. */
export const NO_ESTIMATE: MicroEstimate = { by: 'none', from: '', values: {} };

export type NutrientInfo = { key: MicroKey; label: string; unit: 'mg' | 'µg' | 'g'; group: 'limit' | 'mineral' | 'vitamin'; max100: number };

/** Names, units, and the most a believable food has per 100 g (anything above is a typo and dropped). */
export const NUTRIENTS: NutrientInfo[] = [
  { key: 'sodium_mg', label: 'Salt', unit: 'mg', group: 'limit', max100: 40000 },
  { key: 'caffeine_mg', label: 'Caffeine', unit: 'mg', group: 'limit', max100: 10000 },
  { key: 'sugar_g', label: 'Sugar', unit: 'g', group: 'limit', max100: 100 },
  { key: 'saturated_fat_g', label: 'Saturated fat', unit: 'g', group: 'limit', max100: 100 },
  { key: 'cholesterol_mg', label: 'Cholesterol', unit: 'mg', group: 'limit', max100: 5000 },
  { key: 'potassium_mg', label: 'Potassium', unit: 'mg', group: 'mineral', max100: 60000 },
  { key: 'calcium_mg', label: 'Calcium', unit: 'mg', group: 'mineral', max100: 40000 },
  { key: 'iron_mg', label: 'Iron', unit: 'mg', group: 'mineral', max100: 1000 },
  { key: 'magnesium_mg', label: 'Magnesium', unit: 'mg', group: 'mineral', max100: 30000 },
  { key: 'zinc_mg', label: 'Zinc', unit: 'mg', group: 'mineral', max100: 2000 },
  { key: 'vitamin_a_ug', label: 'Vitamin A', unit: 'µg', group: 'vitamin', max100: 50000 },
  { key: 'vitamin_c_mg', label: 'Vitamin C', unit: 'mg', group: 'vitamin', max100: 100000 },
  { key: 'vitamin_d_ug', label: 'Vitamin D', unit: 'µg', group: 'vitamin', max100: 2500 },
  { key: 'vitamin_b12_ug', label: 'Vitamin B12', unit: 'µg', group: 'vitamin', max100: 5000 },
  { key: 'folate_ug', label: 'Folate', unit: 'µg', group: 'vitamin', max100: 100000 },
];

export const NUTRIENT = Object.fromEntries(NUTRIENTS.map((n) => [n.key, n])) as Record<MicroKey, NutrientInfo>;

const sig = (v: number) => (v >= 100 ? Math.round(v) : v >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 1000) / 1000);

/** Drops anything negative, not a number, or beyond what a real food can have, and rounds to sensible figures. */
export function cleanMicros(m: Record<string, unknown> | null | undefined): Micros {
  const out: Micros = {};
  if (!m || typeof m !== 'object') return out;
  for (const n of NUTRIENTS) {
    const v = m[n.key];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= n.max100) out[n.key] = sig(v);
  }
  return out;
}

// ---------------------------------------------------------------------------
// From the databases
// ---------------------------------------------------------------------------

/** One nutrient line from USDA, in any of its shapes (search results, full or abridged details). */
type UsdaLine = {
  nutrientId?: number;
  nutrientNumber?: string;
  number?: string | number;
  unitName?: string;
  value?: number;
  amount?: number;
  nutrient?: { id?: number; number?: string; unitName?: string };
};

/** USDA nutrient id, its older number, the unit it's in, and how to turn that into ours. */
const USDA: [MicroKey, number, string, string, number][] = [
  ['sodium_mg', 1093, '307', 'MG', 1],
  ['potassium_mg', 1092, '306', 'MG', 1],
  ['calcium_mg', 1087, '301', 'MG', 1],
  ['iron_mg', 1089, '303', 'MG', 1],
  ['magnesium_mg', 1090, '304', 'MG', 1],
  ['zinc_mg', 1095, '309', 'MG', 1],
  ['vitamin_a_ug', 1106, '320', 'UG', 1],
  // Labels in IU: vitamin A added to milk and cereal is retinol (0.3 µg per IU); vitamin D is 40 IU per µg.
  ['vitamin_a_ug', 1104, '318', 'IU', 0.3],
  ['vitamin_c_mg', 1162, '401', 'MG', 1],
  ['vitamin_d_ug', 1114, '328', 'UG', 1],
  ['vitamin_d_ug', 1110, '324', 'IU', 1 / 40],
  ['vitamin_b12_ug', 1178, '418', 'UG', 1],
  ['folate_ug', 1190, '435', 'UG', 1],
  ['folate_ug', 1177, '417', 'UG', 1],
  ['saturated_fat_g', 1258, '606', 'G', 1],
  ['sugar_g', 2000, '269', 'G', 1],
  ['sugar_g', 1063, '269.3', 'G', 1],
  ['cholesterol_mg', 1253, '601', 'MG', 1],
  ['caffeine_mg', 1057, '262', 'MG', 1],
];

const unitOf = (u: string | undefined) => (u ?? '').toUpperCase().replace('µ', 'U').replace('MCG', 'UG');

/** Micronutrients per 100 g from USDA's nutrient list (the first line that fits wins for each). */
export function microsFromUsda(lines: UsdaLine[] | undefined): Micros {
  const found: Record<string, number> = {};
  for (const [key, id, num, unit, factor] of USDA) {
    if (found[key] !== undefined) continue;
    const line = (lines ?? []).find((l) => {
      const lid = l.nutrientId ?? l.nutrient?.id;
      const lnum = String(l.nutrientNumber ?? l.nutrient?.number ?? l.number ?? '');
      return (lid === id || lnum === num) && unitOf(l.unitName ?? l.nutrient?.unitName) === unit;
    });
    const v = line?.value ?? line?.amount;
    if (typeof v === 'number') found[key] = v * factor;
  }
  return cleanMicros(found);
}

/** Open Food Facts keeps everything per 100 g in grams: [their name, ours, grams → our unit]. */
const OFF: [string, MicroKey, number][] = [
  ['sodium', 'sodium_mg', 1000],
  ['potassium', 'potassium_mg', 1000],
  ['calcium', 'calcium_mg', 1000],
  ['iron', 'iron_mg', 1000],
  ['magnesium', 'magnesium_mg', 1000],
  ['zinc', 'zinc_mg', 1000],
  ['vitamin-a', 'vitamin_a_ug', 1e6],
  ['vitamin-c', 'vitamin_c_mg', 1000],
  ['vitamin-d', 'vitamin_d_ug', 1e6],
  ['vitamin-b12', 'vitamin_b12_ug', 1e6],
  ['vitamin-b9', 'folate_ug', 1e6],
  ['folates', 'folate_ug', 1e6],
  ['saturated-fat', 'saturated_fat_g', 1],
  ['sugars', 'sugar_g', 1],
  ['cholesterol', 'cholesterol_mg', 1000],
  ['caffeine', 'caffeine_mg', 1000],
];

const offNum = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Micronutrients per 100 g from an Open Food Facts product's nutriments. Salt counts as sodium (40% of it) when sodium isn't given. */
export function microsFromOff(n: Record<string, unknown> | undefined): Micros {
  const found: Record<string, number> = {};
  for (const [name, key, factor] of OFF) {
    const v = offNum(n?.[`${name}_100g`]);
    if (v !== null && found[key] === undefined) found[key] = v * factor;
  }
  const salt = offNum(n?.salt_100g);
  if (found.sodium_mg === undefined && salt !== null) found.sodium_mg = salt * 400;
  return cleanMicros(found);
}

// ---------------------------------------------------------------------------
// Caffeine
// ---------------------------------------------------------------------------

/** Typical caffeine per 100 g (or 100 ml), by what the food is called. */
const CAFFEINE: [RegExp, number][] = [
  [/\bespresso\b/, 212],
  [/\b(americano|long black)\b/, 45],
  [/\bcold brew\b/, 45],
  [/\bflat white\b/, 35],
  [/\b(latte|cappuccino|macchiato|cortado)\b/, 30],
  [/\bmocha\b/, 25],
  [/\b(cold coffee|frappe|frappuccino)\b/, 20],
  [/\biced coffee\b/, 30],
  [/\bfilter coffee\b/, 35],
  [/\bcoffee\b/, 40],
  [/\b(masala chai|chai|milk tea|bubble tea|ginger tea|cutting chai|irani chai)\b/, 15],
  [/\bgreen tea\b/, 12],
  [/\biced tea\b/, 10],
  [/\btea\b/, 20],
  [/\bkombucha\b/, 4],
  [/\b(red bull|monster|energy drink|sting)\b/, 32],
  [/\b(mountain dew)\b/, 15],
  [/\bdiet (coke|cola)\b/, 13],
  [/\b(coke|cola|pepsi|thums up)\b/, 10],
  [/\b(hot chocolate|hot cocoa|chocolate milk|chocolate drink)\b/, 2],
  [/\bdark chocolate\b/, 80],
  [/\bwhite chocolate\b/, 0],
  [/\bchocolate\b/, 20],
];

/** Herbal "teas" have none, and decaf next to none. */
const NO_CAFFEINE = /\b(herbal|chamomile|camomile|peppermint|rooibos|hibiscus|tulsi|fruit tea|caffeine free|caffeine-free)\b/;
/** Caffeine varies too much to guess. */
const UNKNOWN_CAFFEINE = /\b(pre ?workout|guarana|yerba|mate|caffeine|fat burner|matcha|kola)\b/;
/** Words that make a coffee or chocolate name a dish or a different food, not the drink itself. */
const ONLY_FLAVOUR = /\b(cake|cookie|cookies|biscuit|biscuits|ice cream|candy|bar|muffin|brownie|pudding|syrup|creamer|flavou?red)\b/;

/**
 * About how much caffeine 100 g of a food has, going by its name, or null when
 * it can't be guessed. Foods that aren't coffee, tea, cola, energy drinks or
 * chocolate have none. Instant coffee is told apart by its calories: the
 * powder has about 350 kcal per 100 g, a made cup almost none.
 */
export function caffeinePer100(name: string, kcal100?: number | null): number | null {
  // "Nescafé" → "nescafe".
  const plain = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const n = ` ${plain.replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ')} `;
  if (/\bdecaf/.test(n)) return 1;
  if (NO_CAFFEINE.test(n)) return 0;
  if (UNKNOWN_CAFFEINE.test(n)) return null;
  if (/\b(coffee|nescafe|bru)\b/.test(n) && (/\b(powder|granules|instant)\b/.test(n) || /\b(nescafe|bru)\b/.test(n))) {
    if (/\b(prepared|made|brewed)\b/.test(n)) return 26;
    if (kcal100 !== undefined && kcal100 !== null) return kcal100 > 150 ? 3142 : 26;
    return /\b(powder|granules)\b/.test(n) ? 3142 : null;
  }
  if (/\bcocoa\b/.test(n) && /\b(powder|dry)\b/.test(n)) return 230;
  // Judge by what the food is: "coffee cake" is cake, "tea biscuits" are biscuits.
  const head = ` ${nameHead(name)} `;
  if (ONLY_FLAVOUR.test(head)) return 0;
  for (const [pattern, mg] of CAFFEINE) if (pattern.test(head)) return mg;
  return 0;
}

// ---------------------------------------------------------------------------
// A food's numbers
// ---------------------------------------------------------------------------

export type MicroFood = {
  name: string;
  kcal_100g?: number;
  micros?: Micros | null;
  micros_est?: MicroEstimate | null;
  sugar_100g?: number | null;
  sodium_mg_100g?: number | null;
};

export type FoodMicros = { values: Micros; estimated: Partial<Record<MicroKey, string>> };

/**
 * Everything known about a food per 100 g: its label first, then estimates
 * for the gaps, then the caffeine list. `estimated` says, for each estimated
 * nutrient, where the estimate came from.
 */
export function foodMicros(f: MicroFood): FoodMicros {
  const label: Micros = { ...cleanMicros(f.micros ?? {}) };
  if (label.sugar_g === undefined && typeof f.sugar_100g === 'number') label.sugar_g = f.sugar_100g;
  if (label.sodium_mg === undefined && typeof f.sodium_mg_100g === 'number') label.sodium_mg = f.sodium_mg_100g;
  const values: Micros = { ...label };
  const estimated: Partial<Record<MicroKey, string>> = {};
  const est = f.micros_est;
  if (est?.values) {
    for (const [k, v] of Object.entries(cleanMicros(est.values)) as [MicroKey, number][]) {
      if (values[k] === undefined) {
        values[k] = v;
        estimated[k] = estimateNote(est);
      }
    }
  }
  if (values.caffeine_mg === undefined) {
    const c = caffeinePer100(f.name, f.kcal_100g);
    if (c !== null) {
      values.caffeine_mg = c;
      if (c > 0) estimated.caffeine_mg = 'typical amount';
    }
  }
  return { values, estimated };
}

/** "from USDA: Yogurt, Greek, plain", "from its ingredients", "AI estimate". */
export function estimateNote(e: MicroEstimate): string {
  if (e.by === 'usda') return `from USDA: ${e.from}`;
  if (e.by === 'recipe') return 'from its ingredients';
  if (e.by === 'ai') return 'AI estimate';
  return '';
}

/** Nutrients a food is missing that an estimate could fill (caffeine aside, which the list covers). */
export const missingKeys = (f: MicroFood): MicroKey[] => {
  const { values } = foodMicros(f);
  return MICRO_KEYS.filter((k) => values[k] === undefined && k !== 'caffeine_mg');
};

// ---------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------

export type RecipePart = { name: string; grams: number | null; food: MicroFood | null };

/** How much of a recipe (by weight) must have a nutrient before the recipe shows it, as an estimate. */
const RECIPE_COVERAGE = 0.8;

/**
 * A recipe's nutrients per 100 g of the finished dish, added up from its
 * ingredients. A nutrient every ingredient lists is exact; one that most of
 * the recipe (by weight) has, or that uses an estimate, is an estimate; the
 * rest are left out.
 */
export function recipeMicros(parts: RecipePart[], finishedWeight: number): { micros: Micros; est: MicroEstimate | null } {
  const micros: Micros = {};
  const est: Micros = {};
  if (finishedWeight <= 0) return { micros, est: null };
  const weighed = parts.filter((p) => p.grams && p.grams > 0);
  const total = weighed.reduce((s, p) => s + (p.grams ?? 0), 0);
  const unweighed = parts.length > weighed.length;
  const known = weighed.map((p) => (p.food ? foodMicros(p.food) : quickMicros(p.name)));
  for (const key of MICRO_KEYS) {
    let sum = 0;
    let covered = 0;
    let guessed = false;
    weighed.forEach((p, i) => {
      const v = known[i].values[key];
      if (v === undefined) return;
      sum += (v * (p.grams ?? 0)) / 100;
      covered += p.grams ?? 0;
      if (known[i].estimated[key]) guessed = true;
    });
    if (total <= 0 || covered === 0) continue;
    const value = (sum / finishedWeight) * 100;
    if (covered === total && !guessed && !unweighed) micros[key] = value;
    else if (covered / total >= RECIPE_COVERAGE) est[key] = value;
  }
  const cleanEst = cleanMicros(est);
  return { micros: cleanMicros(micros), est: Object.keys(cleanEst).length ? { by: 'recipe', from: 'its ingredients', values: cleanEst } : null };
}

// ---------------------------------------------------------------------------
// A day
// ---------------------------------------------------------------------------

/** A quick add or quick ingredient: only its caffeine can be told, from its name. */
function quickMicros(name: string): FoodMicros {
  const c = caffeinePer100(name);
  return c === null ? { values: {}, estimated: {} } : { values: { caffeine_mg: c }, estimated: c > 0 ? { caffeine_mg: 'typical amount' } : {} };
}

export type LoggedItem = { id: string; name: string; grams: number | null; food: MicroFood | null };

export type DayNutrient = {
  key: MicroKey;
  amount: number;
  /** Some of the amount is an estimate. */
  estimated: boolean;
  /** Foods you logged that don't say how much of it they have. */
  missing: string[];
  /** Where it came from, the most first. */
  from: { name: string; amount: number; note?: string }[];
};

/** The day's total of each nutrient, what it came from, and which foods had no data for it. */
export function dayNutrients(items: LoggedItem[]): Record<MicroKey, DayNutrient> {
  const out = Object.fromEntries(MICRO_KEYS.map((k) => [k, { key: k, amount: 0, estimated: false, missing: [], from: [] }])) as unknown as Record<MicroKey, DayNutrient>;
  for (const item of items) {
    const fm = item.food ? foodMicros(item.food) : quickMicros(item.name);
    for (const key of MICRO_KEYS) {
      const d = out[key];
      const per100 = fm.values[key];
      // None in it (no caffeine in rice): nothing to add, with or without a weight.
      if (per100 === 0) continue;
      if (per100 === undefined || !item.grams) {
        d.missing.push(item.name);
        continue;
      }
      const amount = (per100 * item.grams) / 100;
      const note = fm.estimated[key];
      d.amount += amount;
      if (note) d.estimated = true;
      d.from.push({ name: item.name, amount, ...(note ? { note } : {}) });
    }
  }
  for (const d of Object.values(out)) d.from.sort((a, b) => b.amount - a.amount);
  return out;
}

// ---------------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------------

export type NutrientTarget = { kind: 'limit' | 'goal'; amount: number; note: string };

/**
 * What to aim for. Vitamins and minerals use the recommended daily amounts
 * for your sex and age (US National Academies); salt, caffeine, sugar and
 * saturated fat have upper limits. Without a sex, the higher amount is used.
 */
export function nutrientTargets(p: { sex: 'male' | 'female' | null; age: number | null; kcal: number }): Record<MicroKey, NutrientTarget> {
  const age = p.age ?? 30;
  const pick = (male: number, female: number) => (p.sex === 'male' ? male : p.sex === 'female' ? female : Math.max(male, female));
  const goal = (amount: number) => ({ kind: 'goal' as const, amount, note: `Recommended for ${p.sex === 'male' ? 'men' : p.sex === 'female' ? 'women' : 'adults'} your age` });
  return {
    sodium_mg: { kind: 'limit', amount: 2300, note: 'Upper limit: 2,300 mg of sodium, about 5.8 g of salt' },
    caffeine_mg: { kind: 'limit', amount: 400, note: 'Upper limit for healthy adults' },
    sugar_g: { kind: 'limit', amount: Math.round((p.kcal * 0.1) / 4), note: 'Guide: 10% of your calories. Milk and fruit sugars count here too' },
    saturated_fat_g: { kind: 'limit', amount: Math.round((p.kcal * 0.1) / 9), note: 'Upper limit: 10% of your calories' },
    cholesterol_mg: { kind: 'limit', amount: 300, note: 'Guide' },
    potassium_mg: goal(pick(3400, 2600)),
    calcium_mg: goal(p.sex === 'female' ? (age >= 51 ? 1200 : 1000) : age >= 71 ? 1200 : 1000),
    iron_mg: goal(pick(8, age >= 51 ? 8 : 18)),
    magnesium_mg: goal(pick(age >= 31 ? 420 : 400, age >= 31 ? 320 : 310)),
    zinc_mg: goal(pick(11, 8)),
    vitamin_a_ug: goal(pick(900, 700)),
    vitamin_c_mg: goal(pick(90, 75)),
    vitamin_d_ug: goal(age >= 71 ? 20 : 15),
    vitamin_b12_ug: goal(2.4),
    folate_ug: goal(400),
  };
}

/** "1,840 mg", "0.4 µg", "12 g". */
export function formatAmount(v: number, unit: NutrientInfo['unit']): string {
  if (v > 0 && v < 0.01) return `<0.01 ${unit}`;
  const s = v >= 100 ? Math.round(v).toLocaleString('en-US') : v >= 10 ? String(Math.round(v)) : v >= 1 ? v.toFixed(1) : v > 0 ? v.toFixed(2) : '0';
  return `${s} ${unit}`;
}

/** Sodium as salt, in grams: 2,000 mg of sodium is 5 g of salt. */
export const saltFromSodium = (mg: number) => (mg * 2.5) / 1000;
