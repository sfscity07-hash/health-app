/**
 * Portions: the units a food can be measured in, and the nutrients for an
 * amount. Foods store nutrients per 100 g; servings map a name to grams.
 */

export type FoodRecord = {
  id: string;
  source: 'custom' | 'usda' | 'off';
  name: string;
  brand: string | null;
  barcode?: string | null;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  /** Null when the label or database doesn't list fibre. */
  fiber_100g: number | null;
  default_serving_g: number | null;
  default_serving_label: string | null;
};

export type Serving = { label: string; grams: number };

export type PortionUnit = {
  key: string;
  /** "g" or a serving name such as "bar". */
  label: string;
  /** Grams in one of this unit. */
  grams: number;
  /** Ruler step and limits. */
  step: number;
  defaultQty: number;
  max: number;
  /** Pixels between ruler ticks, and how many steps between labelled ticks. */
  spacing: number;
  major: number;
};

export type Nutrients = { kcal: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number };

export const roundTo = (n: number, step: number) => Math.round(n / step) * step;

export const OUNCE_G = 28.3495;

type RulerShape = Pick<PortionUnit, 'step' | 'max' | 'spacing' | 'major'>;
/** Things you count: scoops, cups, slices, bars. Quarter steps. */
const COUNTED: RulerShape = { step: 0.25, max: 20, spacing: 22, major: 4 };
const GRAMS: RulerShape = { step: 5, max: 1500, spacing: 8, major: 10 };
const MILLILITRES: RulerShape = { step: 10, max: 2000, spacing: 8, major: 10 };
const OUNCES: RulerShape = { step: 0.25, max: 50, spacing: 14, major: 4 };

/** Units every food has, because they're plain weights. */
export const BUILT_IN_UNITS = ['g', 'oz'];

export const isMillilitres = (label: string) => /^(ml|millilit(re|er)s?)$/i.test(label.trim());

/**
 * Your food's own units first (scoop, cup, slice…, the way you usually think
 * of it), then grams and ounces, which work for anything.
 */
export function unitsFor(food: FoodRecord, servings: Serving[] = []): PortionUnit[] {
  const named: Serving[] = [];
  const add = (s: Serving) => {
    const taken = named.some((n) => n.label.toLowerCase() === s.label.toLowerCase());
    if (s.grams > 0 && !taken && !BUILT_IN_UNITS.includes(s.label.toLowerCase())) named.push(s);
  };
  if (food.default_serving_label && food.default_serving_g) add({ label: food.default_serving_label, grams: food.default_serving_g });
  for (const s of servings) add(s);

  const units: PortionUnit[] = named.map((s) =>
    isMillilitres(s.label)
      ? { key: `serving:${s.label}`, label: 'ml', grams: s.grams, defaultQty: 250, ...MILLILITRES }
      : { key: `serving:${s.label}`, label: s.label, grams: s.grams, defaultQty: 1, ...COUNTED },
  );
  // How much you usually have, so switching to g or oz starts somewhere sensible.
  const usual = units[0] ? units[0].defaultQty * units[0].grams : (food.default_serving_g ?? 100);
  units.push({ key: 'g', label: 'g', grams: 1, defaultQty: Math.max(5, roundTo(usual, 5)), ...GRAMS });
  units.push({ key: 'oz', label: 'oz', grams: OUNCE_G, defaultQty: Math.max(0.25, roundTo(usual / OUNCE_G, 0.25)), ...OUNCES });
  return units;
}

export function nutrientsFor(food: FoodRecord, grams: number): Nutrients {
  const f = grams / 100;
  return {
    kcal: food.kcal_100g * f,
    protein_g: food.protein_100g * f,
    carbs_g: food.carbs_100g * f,
    fat_g: food.fat_100g * f,
    fiber_g: (food.fiber_100g ?? 0) * f,
  };
}

/** "1", "1.5", "0.25", "137". */
export function formatQty(q: number): string {
  return String(Math.round(q * 100) / 100);
}

/** "bar" → "bars" for amounts other than 1; leaves units like "g", "oz" or "cup (240 ml)" alone. */
const NEVER_PLURAL = new Set(['g', 'kg', 'mg', 'ml', 'l', 'oz', 'lb', 'lbs', 'tbsp', 'tsp', 'cl', 'dl']);

export function pluralize(label: string, qty: number): string {
  if (qty === 1 || NEVER_PLURAL.has(label.toLowerCase()) || !/^[a-z]+$/i.test(label) || /s$/i.test(label)) return label;
  return `${label}s`;
}

/** "150 g", "250 ml" or "1.5 bars · 90 g". */
export function describePortion(qty: number, unit: Pick<PortionUnit, 'label' | 'grams'>): string {
  if (unit.label === 'g' || unit.label === 'ml') return `${formatQty(qty)} ${unit.label}`;
  return `${formatQty(qty)} ${pluralize(unit.label, qty)} · ${Math.round(qty * unit.grams)} g`;
}

/** How a logged amount reads in lists: "150 g", "250 ml", "2 scoops · 60 g", "1 serving". */
export function describeLogged(qty: number, unit: string, grams: number | null): string {
  if (unit === 'g' || unit === 'ml') return `${formatQty(qty)} ${unit}`;
  const base = `${formatQty(qty)} ${pluralize(unit, qty)}`;
  return grams ? `${base} · ${Math.round(grams)} g` : base;
}

/** The amount one tap logs for a food: one of its main unit (1 scoop, 250 ml), or its usual weight in grams. */
export function defaultPortion(food: FoodRecord): { qty: number; unit: string; grams: number } {
  const u = unitsFor(food)[0];
  return { qty: u.defaultQty, unit: u.label, grams: u.defaultQty * u.grams };
}

export function clampQty(q: number, unit: Pick<PortionUnit, 'step' | 'max'>): number {
  return Math.min(unit.max, Math.max(unit.step, q));
}

/** Rounds stored values the way the database keeps them (one decimal). */
export function roundNutrients(n: Nutrients): Nutrients {
  const r = (v: number) => Math.round(v * 10) / 10;
  return { kcal: r(n.kcal), protein_g: r(n.protein_g), carbs_g: r(n.carbs_g), fat_g: r(n.fat_g), fiber_g: r(n.fiber_g) };
}

/** Energy implied by macros, for when quick add has macros but no calories. */
export const kcalFromMacros = (p: number, c: number, f: number) => p * 4 + c * 4 + f * 9;
