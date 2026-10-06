import { measureToServing } from '@/features/search/measures';
import type { ExternalFood } from '@/features/search/types';

/** Open Food Facts' newer search service; the older endpoint is the fallback. */
export const OFF_SEARCH_URL = 'https://search.openfoodfacts.org/search';
export const OFF_LEGACY_SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';

const FIELDS = [
  'code',
  'product_name',
  'product_name_en',
  'generic_name',
  'brands',
  'nutriments',
  'serving_size',
  'serving_quantity',
  'serving_quantity_unit',
].join(',');

/** Open Food Facts asks every app to say who it is. */
const HEADERS = { Accept: 'application/json', 'User-Agent': 'Fuel/1.0 (personal calorie tracker)' };

export type OffProduct = {
  code?: string;
  product_name?: unknown;
  product_name_en?: unknown;
  generic_name?: unknown;
  brands?: unknown;
  nutriments?: Record<string, unknown>;
  serving_size?: unknown;
  serving_quantity?: unknown;
  serving_quantity_unit?: unknown;
};

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Names can come as a string, or as { en: "…", fr: "…" } from the newer service. */
function text(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (Array.isArray(v)) return text(v[0]);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return text(o.en ?? o.main ?? Object.values(o)[0]);
  }
  return '';
}

/** "Ferrero, Nutella" or ["Ferrero", "Nutella"] → "Ferrero". */
function firstBrand(v: unknown): string | null {
  const s = Array.isArray(v) ? text(v[0]) : text(v).split(',')[0]?.trim();
  return s ? s.slice(0, 120) : null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function mapOffProduct(p: OffProduct): ExternalFood | null {
  const code = typeof p.code === 'string' ? p.code.trim() : String(p.code ?? '');
  const name = text(p.product_name_en) || text(p.product_name) || text(p.generic_name);
  const n = p.nutriments ?? {};
  const kj = num(n.energy_100g) ?? num(n['energy-kj_100g']);
  const kcal = num(n['energy-kcal_100g']) ?? (kj === null ? null : kj / 4.184);
  if (!code || !name || kcal === null) return null;
  const protein = num(n.proteins_100g) ?? 0;
  const carbs = num(n.carbohydrates_100g) ?? 0;
  const fat = num(n.fat_100g) ?? 0;
  if (kcal < 0 || kcal > 900 || protein < 0 || carbs < 0 || fat < 0 || protein + carbs + fat > 105) return null;

  // Sodium is stored in grams; fall back to salt (sodium is 40% of salt).
  const sodiumG = num(n.sodium_100g) ?? ((num(n.salt_100g) ?? NaN) * 0.4);
  const servingGrams = num(p.serving_quantity);
  const serving = measureToServing(text(p.serving_size) || (servingGrams ? `${servingGrams} g` : ''), servingGrams);

  return {
    key: `off:${code}`,
    source: 'off',
    externalId: code,
    name: name.slice(0, 200),
    brand: firstBrand(p.brands),
    barcode: /^\d{6,14}$/.test(code) ? code : null,
    kcal_100g: round2(kcal),
    protein_100g: round2(protein),
    carbs_100g: round2(carbs),
    fat_100g: round2(fat),
    fiber_100g: num(n.fiber_100g),
    sugar_100g: num(n.sugars_100g),
    sodium_mg_100g: Number.isFinite(sodiumG) ? round2(sodiumG * 1000) : null,
    serving,
    servings: [],
    generic: false,
  };
}

async function getJson(url: string, signal?: AbortSignal): Promise<{ hits?: OffProduct[]; products?: OffProduct[] }> {
  const res = await fetch(url, { headers: HEADERS, signal });
  if (!res.ok) throw new Error(`Open Food Facts search failed (${res.status})`);
  return res.json();
}

export async function searchOff(query: string, signal?: AbortSignal): Promise<ExternalFood[]> {
  const q = encodeURIComponent(query);
  let products: OffProduct[];
  try {
    const body = await getJson(`${OFF_SEARCH_URL}?q=${q}&page_size=24&langs=en&fields=${FIELDS}`, signal);
    products = body.hits ?? body.products ?? [];
  } catch (e) {
    if (signal?.aborted) throw e;
    const body = await getJson(
      `${OFF_LEGACY_SEARCH_URL}?search_terms=${q}&search_simple=1&action=process&json=1&page_size=24&fields=${FIELDS}`,
      signal,
    );
    products = body.products ?? [];
  }
  return products.map(mapOffProduct).filter((f): f is ExternalFood => f !== null);
}
