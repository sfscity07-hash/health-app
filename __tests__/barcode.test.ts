import { barcodeProblem, barcodeVariants, lookupBarcode } from '@/features/search/barcode';
import { fetchOffProduct } from '@/features/search/off';
import type { ExternalFood } from '@/features/search/types';
import { findUsdaByBarcode } from '@/features/search/usda';

jest.mock('@/lib/supabase', () => ({ supabase: null, requireSupabase: jest.fn() }));

const food = (key: string): ExternalFood => ({
  key,
  source: key.startsWith('usda') ? 'usda' : 'off',
  externalId: key.split(':')[1],
  name: 'Greek Nonfat Yogurt',
  brand: 'Great Value',
  barcode: '078742012345',
  kcal_100g: 59,
  protein_100g: 10,
  carbs_100g: 3.6,
  fat_100g: 0.4,
  fiber_100g: 0,
  sugar_100g: null,
  sodium_mg_100g: null,
  serving: { label: 'container', grams: 150 },
  servings: [],
  generic: false,
});

const json = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);

describe('barcodes', () => {
  it('treats a 12-digit UPC and its 13-digit EAN form as the same product', () => {
    expect(barcodeVariants('036000291452')).toEqual(['036000291452', '0036000291452']);
    expect(barcodeVariants('0036000291452')).toEqual(['0036000291452', '036000291452']);
    expect(barcodeVariants('3017620422003')).toEqual(['3017620422003']);
    expect(barcodeVariants('abc')).toEqual([]);
  });

  it('catches typos in a typed number with the check digit', () => {
    expect(barcodeProblem('3017620422003')).toBeNull();
    expect(barcodeProblem('036000291452')).toBeNull();
    expect(barcodeProblem('3017620422004')).toMatch(/doesn’t look right/);
    expect(barcodeProblem('12345')).toMatch(/8, 12 or 13 digits/);
    expect(barcodeProblem('30176204220a3')).toMatch(/only numbers/);
    expect(barcodeProblem('96385074')).toBeNull();
  });
});

describe('looking up a scan', () => {
  const sources = (over: Partial<Parameters<typeof lookupBarcode>[2]> = {}) => ({
    findSaved: jest.fn(async () => null),
    fetchOff: jest.fn(async () => ({ kind: 'missing' as const })),
    findUsda: jest.fn(async () => null),
    ...over,
  });

  it('opens your own saved food first, without asking the databases', async () => {
    const s = sources({ findSaved: jest.fn(async () => 'food-1') });
    expect(await lookupBarcode('036000291452', undefined, s)).toEqual({ kind: 'saved', foodId: 'food-1' });
    expect(s.findSaved).toHaveBeenCalledWith(['036000291452', '0036000291452']);
    expect(s.fetchOff).not.toHaveBeenCalled();
  });

  it('uses Open Food Facts next, then USDA', async () => {
    const off = food('off:3017620422003');
    expect(await lookupBarcode('3017620422003', undefined, sources({ fetchOff: jest.fn(async () => ({ kind: 'found' as const, food: off })) }))).toEqual({
      kind: 'found',
      food: off,
    });
    const usda = food('usda:2345');
    expect(await lookupBarcode('078742012345', undefined, sources({ findUsda: jest.fn(async () => usda) }))).toEqual({ kind: 'found', food: usda });
  });

  it('says when a product is listed without nutrition, unless USDA has it', async () => {
    const incomplete = { kind: 'incomplete' as const, name: 'Mystery bar', brand: 'Acme' };
    expect(await lookupBarcode('96385074', undefined, sources({ fetchOff: jest.fn(async () => incomplete) }))).toEqual(incomplete);
    const usda = food('usda:1');
    expect(await lookupBarcode('96385074', undefined, sources({ fetchOff: jest.fn(async () => incomplete), findUsda: jest.fn(async () => usda) }))).toEqual({
      kind: 'found',
      food: usda,
    });
  });

  it('reports "not found" only when the databases answered', async () => {
    expect(await lookupBarcode('96385074', undefined, sources())).toEqual({ kind: 'missing' });
    // USDA failing alone still trusts Open Food Facts' answer.
    expect(await lookupBarcode('96385074', undefined, sources({ findUsda: jest.fn(async () => Promise.reject(new Error('down'))) }))).toEqual({
      kind: 'missing',
    });
    // Both down: an error, not a wrong "nobody knows this".
    await expect(
      lookupBarcode(
        '96385074',
        undefined,
        sources({ fetchOff: jest.fn(async () => Promise.reject(new Error('offline'))), findUsda: jest.fn(async () => Promise.reject(new Error('offline'))) }),
      ),
    ).rejects.toThrow(/Couldn’t reach/);
  });

  it('still checks the databases when your foods can’t be reached', async () => {
    const off = food('off:1');
    const s = sources({ findSaved: jest.fn(async () => Promise.reject(new Error('offline'))), fetchOff: jest.fn(async () => ({ kind: 'found' as const, food: off })) });
    expect(await lookupBarcode('96385074', undefined, s)).toEqual({ kind: 'found', food: off });
  });
});

describe('database lookups by barcode', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('reads an Open Food Facts product page', async () => {
    globalThis.fetch = jest.fn(() =>
      json({
        status: 1,
        product: {
          product_name: 'Greek Nonfat Yogurt, Plain',
          brands: 'Great Value',
          serving_size: '1 container (150 g)',
          serving_quantity: 150,
          nutriments: { 'energy-kcal_100g': 59, proteins_100g: 10, carbohydrates_100g: 3.6, fat_100g: 0.4 },
        },
      }),
    ) as jest.Mock;
    const r = await fetchOffProduct('0078742012345');
    expect(r).toMatchObject({ kind: 'found', food: { key: 'off:0078742012345', name: 'Greek Nonfat Yogurt, Plain', serving: { label: 'container', grams: 150 } } });
    expect((globalThis.fetch as jest.Mock).mock.calls[0][0]).toMatch(/\/api\/v2\/product\/0078742012345\.json/);
  });

  it('tells "not listed" from "listed without nutrition"', async () => {
    globalThis.fetch = jest.fn(() => json({ status: 0, status_verbose: 'product not found' })) as jest.Mock;
    expect(await fetchOffProduct('96385074')).toEqual({ kind: 'missing' });
    globalThis.fetch = jest.fn(() => json({ status: 1, product: { product_name: 'Mystery bar', brands: 'Acme', nutriments: {} } })) as jest.Mock;
    expect(await fetchOffProduct('96385074')).toEqual({ kind: 'incomplete', name: 'Mystery bar', brand: 'Acme' });
  });

  it('matches USDA products whatever the leading zeros', async () => {
    globalThis.fetch = jest.fn(() =>
      json({
        foods: [
          { fdcId: 9, description: 'OTHER', gtinUpc: '011111111111', foodNutrients: [{ nutrientId: 1008, unitName: 'KCAL', value: 100 }] },
          {
            fdcId: 10,
            description: 'GREEK NONFAT YOGURT',
            dataType: 'Branded',
            gtinUpc: '00078742012345',
            servingSize: 150,
            servingSizeUnit: 'g',
            householdServingFullText: '1 container',
            foodNutrients: [
              { nutrientId: 1008, unitName: 'KCAL', value: 59 },
              { nutrientId: 1003, unitName: 'G', value: 10 },
            ],
          },
        ],
      }),
    ) as jest.Mock;
    const f = await findUsdaByBarcode(['078742012345', '0078742012345'], 'KEY');
    expect(f).toMatchObject({ key: 'usda:10', name: 'Greek Nonfat Yogurt', serving: { label: 'container', grams: 150 } });
  });
});
