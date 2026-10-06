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

/** Serving units first (the way you usually think of the food), then grams. */
export function unitsFor(food: FoodRecord, servings: Serving[] = []): PortionUnit[] {
  const named: Serving[] = [];
  if (food.default_serving_label && food.default_serving_g) {
    named.push({ label: food.default_serving_label, grams: food.default_serving_g });
  }
  for (const s of servings) {
    if (s.grams > 0 && !named.some((n) => n.label.toLowerCase() === s.label.toLowerCase())) named.push(s);
  }
  const units: PortionUnit[] = named.map((s) => ({
    key: `serving:${s.label}`,
    label: s.label,
    grams: s.grams,
    step: 0.25,
    defaultQty: 1,
    max: 10,
    spacing: 22,
    major: 4,
  }));
  units.push({
    key: 'g',
    label: 'g',
    grams: 1,
    step: 5,
    defaultQty: Math.max(5, roundTo(food.default_serving_g ?? 100, 5)),
    max: 1500,
    spacing: 8,
    major: 10,
  });
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
export function pluralize(label: string, qty: number): string {
  if (qty === 1 || label.length <= 2 || !/^[a-z]+$/i.test(label) || /s$/i.test(label)) return label;
  return `${label}s`;
}

/** "150 g" or "1.5 bars · 90 g". */
export function describePortion(qty: number, unit: Pick<PortionUnit, 'label' | 'grams'>): string {
  if (unit.label === 'g') return `${formatQty(qty)} g`;
  return `${formatQty(qty)} ${pluralize(unit.label, qty)} · ${Math.round(qty * unit.grams)} g`;
}

/** How a logged amount reads in lists: "150 g", "2 bars · 120 g", "1 serving". */
export function describeLogged(qty: number, unit: string, grams: number | null): string {
  if (unit === 'g') return `${formatQty(qty)} g`;
  const base = `${formatQty(qty)} ${pluralize(unit, qty)}`;
  return grams ? `${base} · ${Math.round(grams)} g` : base;
}

/** The amount one tap logs for a food: one named serving, or its usual weight in grams. */
export function defaultPortion(food: FoodRecord): { qty: number; unit: string; grams: number } {
  if (food.default_serving_label && food.default_serving_g) {
    return { qty: 1, unit: food.default_serving_label, grams: food.default_serving_g };
  }
  const grams = food.default_serving_g ?? 100;
  return { qty: grams, unit: 'g', grams };
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
