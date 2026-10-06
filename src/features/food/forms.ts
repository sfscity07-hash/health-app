import { parseNumber } from '@/features/onboarding/draft';
import { kcalFromMacros, roundTo, type Nutrients } from '@/lib/portion';

const optional = (s: string) => (s.trim() === '' ? 0 : parseNumber(s));

export type QuickAddForm = { name: string; kcal: string; protein: string; carbs: string; fat: string };

export type QuickAddResult = { ok: true; name: string; nutrients: Nutrients } | { ok: false; error: string };

/** Quick add needs calories, or macros we can work calories out from. */
export function parseQuickAdd(f: QuickAddForm): QuickAddResult {
  const protein = optional(f.protein);
  const carbs = optional(f.carbs);
  const fat = optional(f.fat);
  if (protein === null || carbs === null || fat === null) return { ok: false, error: 'Macros must be plain numbers.' };
  let kcal = f.kcal.trim() === '' ? null : parseNumber(f.kcal);
  if (f.kcal.trim() !== '' && kcal === null) return { ok: false, error: 'Calories must be a plain number.' };
  if (kcal === null) {
    const fromMacros = kcalFromMacros(protein, carbs, fat);
    if (fromMacros <= 0) return { ok: false, error: 'Enter calories, or the macros to work them out from.' };
    kcal = Math.round(fromMacros);
  }
  if (kcal > 10000) return { ok: false, error: "That's more than 10,000 kcal. Check the number." };
  return { ok: true, name: f.name.trim() || 'Quick add', nutrients: { kcal, protein_g: protein, carbs_g: carbs, fat_g: fat } };
}

export type CustomFoodForm = {
  name: string;
  brand: string;
  servingLabel: string;
  servingGrams: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
};

export type CustomFoodInsert = {
  source: 'custom';
  name: string;
  brand: string | null;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  default_serving_g: number;
  default_serving_label: string | null;
};

export type CustomFoodResult = { ok: true; food: CustomFoodInsert } | { ok: false; error: string };

/**
 * Labels list nutrition per serving; we store it per 100 g. When no serving
 * name is given, the numbers are treated as per 100 g.
 */
export function buildCustomFood(f: CustomFoodForm): CustomFoodResult {
  const name = f.name.trim();
  if (!name) return { ok: false, error: 'Give the food a name.' };
  const perServing = f.servingLabel.trim() !== '';
  const grams = perServing ? parseNumber(f.servingGrams) : 100;
  if (grams === null || grams <= 0) return { ok: false, error: 'Enter how many grams one serving weighs.' };
  const kcal = parseNumber(f.kcal);
  if (kcal === null) return { ok: false, error: 'Enter the calories.' };
  const protein = optional(f.protein);
  const carbs = optional(f.carbs);
  const fat = optional(f.fat);
  if (protein === null || carbs === null || fat === null) return { ok: false, error: 'Macros must be plain numbers.' };
  if (protein + carbs + fat > grams * 1.02) return { ok: false, error: 'The macros add up to more than the serving weighs. Check the numbers.' };

  const per100 = (v: number) => roundTo((v / grams) * 100, 0.01);
  const kcal_100g = per100(kcal);
  if (kcal_100g > 900) return { ok: false, error: "That's more than 900 kcal per 100 g. Check the calories and serving size." };

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
      default_serving_g: grams,
      default_serving_label: perServing ? f.servingLabel.trim().toLowerCase() : null,
    },
  };
}
