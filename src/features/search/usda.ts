import { measureToServing } from '@/features/search/measures';
import type { ExternalFood } from '@/features/search/types';
import type { Serving } from '@/lib/portion';

export const USDA_SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';

/** Whole and generic foods. Packaged products come from Open Food Facts, which covers more countries. */
const DATA_TYPES = ['Foundation', 'SR Legacy', 'Survey (FNDDS)'];

type UsdaNutrient = {
  nutrientId?: number;
  nutrientNumber?: string;
  unitName?: string;
  value?: number;
};

type UsdaMeasure = { disseminationText?: string; gramWeight?: number; rank?: number };

export type UsdaFood = {
  fdcId: number;
  description?: string;
  dataType?: string;
  brandOwner?: string;
  brandName?: string;
  gtinUpc?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodNutrients?: UsdaNutrient[];
  foodMeasures?: UsdaMeasure[];
};

/** Nutrient ids (and the older nutrient numbers) for what we keep. */
const IDS = {
  kcal: [[1008, '208']],
  kcalAtwater: [
    [2047, '957'],
    [2048, '958'],
  ],
  kj: [[1062, '268']],
  protein: [[1003, '203']],
  fat: [
    [1004, '204'],
    [1085, '298'],
  ],
  carbs: [
    [1005, '205'],
    [1050, '205.2'],
  ],
  fiber: [[1079, '291']],
  sugar: [
    [2000, '269'],
    [1063, '269.3'],
  ],
  sodium: [[1093, '307']],
} as const;

function pick(nutrients: UsdaNutrient[], ids: readonly (readonly [number, string])[], unit?: string): number | null {
  for (const [id, num] of ids) {
    const n = nutrients.find(
      (x) =>
        (x.nutrientId === id || x.nutrientNumber === num) &&
        typeof x.value === 'number' &&
        (!unit || (x.unitName ?? '').toUpperCase() === unit),
    );
    if (n && typeof n.value === 'number') return n.value;
  }
  return null;
}

/** USDA writes branded names in capitals; generic names are fine as they are. */
function tidyName(s: string): string {
  const t = s.trim();
  if (t !== t.toUpperCase()) return t;
  return t.toLowerCase().replace(/(^|[\s,(/-])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase());
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Maps one search hit, or returns null when it's missing the basics or the numbers can't be right. */
export function mapUsdaFood(f: UsdaFood): ExternalFood | null {
  const nutrients = f.foodNutrients ?? [];
  const kj = pick(nutrients, IDS.kj, 'KJ');
  const kcal = pick(nutrients, IDS.kcal, 'KCAL') ?? pick(nutrients, IDS.kcalAtwater, 'KCAL') ?? (kj === null ? null : kj / 4.184);
  const name = f.description ? tidyName(f.description) : '';
  if (kcal === null || !name) return null;
  const protein = pick(nutrients, IDS.protein) ?? 0;
  const fat = pick(nutrients, IDS.fat) ?? 0;
  const carbs = pick(nutrients, IDS.carbs) ?? 0;
  if (kcal < 0 || kcal > 900 || protein + fat + carbs > 105) return null;

  const measures = [...(f.foodMeasures ?? [])].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  const servings: Serving[] = [];
  for (const m of measures) {
    const s = measureToServing(m.disseminationText, m.gramWeight);
    if (s && !servings.some((x) => x.label === s.label)) servings.push(s);
    if (servings.length === 4) break;
  }
  const unit = (f.servingSizeUnit ?? '').toLowerCase();
  const branded =
    f.servingSize && ['g', 'grm', 'ml', 'mlt'].includes(unit)
      ? measureToServing(f.householdServingFullText || `${f.servingSize} g`, f.servingSize)
      : null;
  const serving = branded ?? servings[0] ?? null;

  const brand = f.brandName || f.brandOwner || null;
  const sodium = pick(nutrients, IDS.sodium, 'MG');
  return {
    key: `usda:${f.fdcId}`,
    source: 'usda',
    externalId: String(f.fdcId),
    name: name.slice(0, 200),
    brand: brand ? tidyName(brand).slice(0, 120) : null,
    barcode: f.gtinUpc && /^\d{6,14}$/.test(f.gtinUpc) ? f.gtinUpc : null,
    kcal_100g: round2(kcal),
    protein_100g: round2(protein),
    carbs_100g: round2(carbs),
    fat_100g: round2(fat),
    fiber_100g: pick(nutrients, IDS.fiber),
    sugar_100g: pick(nutrients, IDS.sugar),
    sodium_mg_100g: sodium,
    serving,
    servings: servings.filter((s) => s.label !== serving?.label),
    generic: f.dataType !== 'Branded',
  };
}

export class SearchLimitError extends Error {
  constructor() {
    super('USDA search limit reached');
  }
}

export async function searchUsda(query: string, apiKey: string, signal?: AbortSignal): Promise<ExternalFood[]> {
  const res = await fetch(`${USDA_SEARCH_URL}?api_key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, dataType: DATA_TYPES, pageSize: 30, requireAllWords: true }),
    signal,
  });
  if (res.status === 429) throw new SearchLimitError();
  if (!res.ok) throw new Error(`USDA search failed (${res.status})`);
  const body = (await res.json()) as { foods?: UsdaFood[] };
  return (body.foods ?? []).map(mapUsdaFood).filter((f): f is ExternalFood => f !== null);
}

const withoutLeadingZeros = (s: string) => s.replace(/^0+/, '');

/** US packaged foods by their UPC, from USDA's branded data. Null when USDA doesn't have it. */
export async function findUsdaByBarcode(codes: string[], apiKey: string, signal?: AbortSignal): Promise<ExternalFood | null> {
  const res = await fetch(`${USDA_SEARCH_URL}?api_key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: codes[0], dataType: ['Branded'], pageSize: 5 }),
    signal,
  });
  if (res.status === 429) throw new SearchLimitError();
  if (!res.ok) throw new Error(`USDA lookup failed (${res.status})`);
  const body = (await res.json()) as { foods?: UsdaFood[] };
  const wanted = new Set(codes.map(withoutLeadingZeros));
  const hit = (body.foods ?? []).find((f) => f.gtinUpc && wanted.has(withoutLeadingZeros(f.gtinUpc)));
  return hit ? mapUsdaFood(hit) : null;
}
