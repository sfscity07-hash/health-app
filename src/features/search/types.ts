import type { FoodWithServings } from '@/features/food/api';
import type { Serving } from '@/lib/portion';

export type FoodSource = 'usda' | 'off';

/** A food from USDA or Open Food Facts, mapped to one shape. Nutrients are per 100 g (or 100 ml). */
export type ExternalFood = {
  /** Stable across searches: "usda:173944", "off:3017620422003". */
  key: string;
  source: FoodSource;
  externalId: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  fiber_100g: number | null;
  sugar_100g: number | null;
  sodium_mg_100g: number | null;
  /** The serving the food opens on, e.g. 1 medium banana = 118 g. */
  serving: Serving | null;
  /** Other ways to measure it (cup, slice…). */
  servings: Serving[];
  /** USDA's whole and generic foods (as opposed to a branded product). */
  generic: boolean;
};

export const SOURCE_TAG: Record<FoodSource, string> = { usda: 'USDA', off: 'OFF' };

/** Lets the food screen show a search result before it's saved to your account. */
export function asFood(f: ExternalFood): FoodWithServings {
  return {
    id: f.key,
    source: f.source,
    name: f.name,
    brand: f.brand,
    barcode: f.barcode,
    kcal_100g: f.kcal_100g,
    protein_100g: f.protein_100g,
    carbs_100g: f.carbs_100g,
    fat_100g: f.fat_100g,
    fiber_100g: f.fiber_100g,
    default_serving_g: f.serving?.grams ?? null,
    default_serving_label: f.serving?.label ?? null,
    servings: f.servings,
  };
}
