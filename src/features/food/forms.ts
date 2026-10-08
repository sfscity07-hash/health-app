import { parseNumber } from '@/features/onboarding/draft';
import { BUILT_IN_UNITS, isMillilitres, kcalFromMacros, roundTo, type Nutrients, type Serving } from '@/lib/portion';

const optional = (s: string) => (s.trim() === '' ? 0 : parseNumber(s));

export type QuickAddForm = { name: string; kcal: string; protein: string; carbs: string; fat: string; fiber: string };

export type QuickAddResult = { ok: true; name: string; nutrients: Nutrients } | { ok: false; error: string };

/** Quick add needs calories, or macros we can work calories out from. */
export function parseQuickAdd(f: QuickAddForm): QuickAddResult {
  const protein = optional(f.protein);
  const carbs = optional(f.carbs);
  const fat = optional(f.fat);
  const fiber = optional(f.fiber);
  if (protein === null || carbs === null || fat === null || fiber === null) return { ok: false, error: 'Macros and fibre must be plain numbers.' };
  let kcal = f.kcal.trim() === '' ? null : parseNumber(f.kcal);
  if (f.kcal.trim() !== '' && kcal === null) return { ok: false, error: 'Calories must be a plain number.' };
  if (kcal === null) {
    const fromMacros = kcalFromMacros(protein, carbs, fat);
    if (fromMacros <= 0) return { ok: false, error: 'Enter calories, or the macros to work them out from.' };
    kcal = Math.round(fromMacros);
  }
  if (kcal > 10000) return { ok: false, error: "That's more than 10,000 kcal. Check the number." };
  return { ok: true, name: f.name.trim() || 'Quick add', nutrients: { kcal, protein_g: protein, carbs_g: carbs, fat_g: fat, fiber_g: fiber } };
}

export type UnitDraft = { label: string; grams: string };

/** Units offered as one-tap choices. Anything else can be typed in. */
export const UNIT_SUGGESTIONS = ['scoop', 'cup', 'tbsp', 'tsp', 'slice', 'piece', 'bar', 'serving', 'ml', 'can', 'bottle', 'packet'];

export type CustomFoodForm = {
  name: string;
  brand: string;
  /** How it's measured: "g" (grams only), "ml", or a unit you count such as "scoop" or "cup". */
  unit: string;
  /** Grams in one of that unit (grams per ml for "ml"). */
  unitGrams: string;
  /** Whether the label's numbers are for one unit ("per scoop") or per 100 g / 100 ml. */
  basis: 'unit' | '100';
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  /** Optional: left empty means the label doesn't list it. */
  fiber: string;
  /** Other ways to measure it, e.g. 1 tbsp = 10 g. */
  extraUnits: UnitDraft[];
  /** From a scan that found nothing, so the next scan finds this food. */
  barcode?: string;
};

export type CustomFoodInsert = {
  source: 'custom';
  name: string;
  brand: string | null;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  fiber_100g: number | null;
  default_serving_g: number;
  default_serving_label: string | null;
  barcode: string | null;
};

export type CustomFoodResult = { ok: true; food: CustomFoodInsert; servings: Serving[] } | { ok: false; error: string };

const UNIT_NAME_MAX = 40;

/** Checks a unit you named, e.g. "scoop" weighing "30" g. */
export function parseUnit(u: UnitDraft, taken: string[] = []): { ok: true; serving: Serving } | { ok: false; error: string } {
  const label = u.label.trim().toLowerCase().replace(/^1\s+/, '');
  if (!label) return { ok: false, error: 'Give the unit a name, like scoop or cup.' };
  if (label.length > UNIT_NAME_MAX) return { ok: false, error: 'Keep the unit name short (40 letters at most).' };
  if ([...BUILT_IN_UNITS, ...taken.map((t) => t.toLowerCase())].includes(label)) return { ok: false, error: `There’s already a “${label}” unit.` };
  const grams = parseNumber(u.grams);
  if (grams === null || grams <= 0) return { ok: false, error: `Enter how many grams one ${label} weighs.` };
  if (grams > 5000) return { ok: false, error: `One ${label} can’t weigh more than 5 kg. Check the number.` };
  return { ok: true, serving: { label: isMillilitres(label) ? 'ml' : label, grams: roundTo(grams, 0.01) } };
}

/**
 * Labels list nutrition per serving or per 100 g (100 ml for drinks); we
 * store it per 100 g, plus the units you measure the food in.
 */
export function buildCustomFood(f: CustomFoodForm): CustomFoodResult {
  const name = f.name.trim();
  if (!name) return { ok: false, error: 'Give the food a name.' };

  const unitName = f.unit.trim().toLowerCase();
  const byWeight = unitName === '' || unitName === 'g';
  let main: Serving | null = null;
  if (!byWeight) {
    const parsed = parseUnit({ label: unitName, grams: f.unitGrams });
    if (!parsed.ok) return parsed;
    main = parsed.serving;
  }
  const ml = main !== null && isMillilitres(main.label);
  const perHundred = byWeight || ml || f.basis === '100';
  // Grams the label's numbers are for.
  const grams = perHundred ? (ml && main ? 100 * main.grams : 100) : (main?.grams ?? 100);
  const basisName = byWeight ? '100 g' : ml ? '100 ml' : perHundred ? '100 g' : `one ${main?.label}`;

  const kcal = parseNumber(f.kcal);
  if (kcal === null) return { ok: false, error: 'Enter the calories.' };
  const protein = optional(f.protein);
  const carbs = optional(f.carbs);
  const fat = optional(f.fat);
  if (protein === null || carbs === null || fat === null) return { ok: false, error: 'Macros must be plain numbers.' };
  if (protein + carbs + fat > grams * 1.02) return { ok: false, error: `The macros add up to more than ${basisName} weighs. Check the numbers.` };
  // Some labels count fibre inside carbs and some list it separately, so it's only checked on its own.
  const fiber = f.fiber.trim() === '' ? null : parseNumber(f.fiber);
  if (f.fiber.trim() !== '' && fiber === null) return { ok: false, error: 'Fibre must be a plain number.' };
  if (fiber !== null && fiber > grams) return { ok: false, error: 'There’s more fibre than the serving weighs. Check the number.' };

  const per100 = (v: number) => roundTo((v / grams) * 100, 0.01);
  const kcal_100g = per100(kcal);
  if (kcal_100g > 900) return { ok: false, error: "That's more than 900 kcal per 100 g. Check the calories and serving size." };

  const servings: Serving[] = [];
  const taken = main ? [main.label] : [];
  for (const draft of f.extraUnits) {
    if (draft.label.trim() === '' && draft.grams.trim() === '') continue;
    const parsed = parseUnit(draft, [...taken, ...servings.map((s) => s.label)]);
    if (!parsed.ok) return parsed;
    servings.push(parsed.serving);
  }

  return {
    ok: true,
    food: {
      source: 'custom',
      name,
      brand: f.brand.trim() || null,
      kcal_100g,
      protein_100g: per100(protein),
      carbs_100g: per100(carbs),
      fat_100g: per100(fat),
      fiber_100g: fiber === null ? null : per100(fiber),
      default_serving_g: main?.grams ?? 100,
      default_serving_label: main?.label ?? null,
      barcode: f.barcode && /^\d{6,14}$/.test(f.barcode) ? f.barcode : null,
    },
    servings,
  };
}
