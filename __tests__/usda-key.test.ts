import { searchFoodDatabases, sourceNote } from '@/features/search/api';
import { findUsdaByBarcode, SearchKeyError, SearchLimitError, searchUsda } from '@/features/search/usda';

jest.mock('@/lib/supabase', () => ({ supabase: null, requireSupabase: jest.fn() }));

const reply = (status: number, body: unknown = {}) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('when USDA says no', () => {
  it('a used-up key (429) and a rejected key (403) are told apart', async () => {
    globalThis.fetch = jest.fn(() => reply(429)) as unknown as typeof fetch;
    await expect(searchUsda('paneer', 'DEMO_KEY')).rejects.toBeInstanceOf(SearchLimitError);
    globalThis.fetch = jest.fn(() => reply(403, { error: { code: 'API_KEY_INVALID' } })) as unknown as typeof fetch;
    await expect(searchUsda('paneer', 'typo')).rejects.toBeInstanceOf(SearchKeyError);
    await expect(findUsdaByBarcode(['012345678905'], 'typo')).rejects.toBeInstanceOf(SearchKeyError);
  });

  it('Open Food Facts results still come through, with USDA marked rejected', async () => {
    globalThis.fetch = jest.fn((url: string) =>
      String(url).includes('api.nal.usda.gov')
        ? reply(403)
        : reply(200, { hits: [{ code: '1', product_name: 'Paneer', brands: 'Amul', nutriments: { 'energy-kcal_100g': 296, proteins_100g: 20, carbohydrates_100g: 3.6, fat_100g: 22.5 } }] }),
    ) as unknown as typeof fetch;
    const out = await searchFoodDatabases('paneer');
    expect(out.usda).toBe('rejected');
    expect(out.off).toBe('ok');
    expect(out.results.map((r) => r.name)).toEqual(['Paneer']);
  });
});

describe('the note under the results', () => {
  it('points at a personal key when the shared demo key runs out', () => {
    expect(sourceNote({ usda: 'limited', off: 'ok' }, true)).toMatch(/shared demo key has run out.*README/);
  });

  it('says to wait when your own key hits its hourly limit', () => {
    expect(sourceNote({ usda: 'limited', off: 'ok' }, false)).toMatch(/resets within the hour/);
  });

  it('says to check the .env when USDA turns your key down', () => {
    expect(sourceNote({ usda: 'rejected', off: 'ok' }, false)).toMatch(/EXPO_PUBLIC_USDA_API_KEY.*--clear/);
  });

  it('stays quiet when both answered, and says when neither did', () => {
    expect(sourceNote({ usda: 'ok', off: 'ok' }, true)).toBeNull();
    expect(sourceNote({ usda: 'failed', off: 'failed' }, true)).toMatch(/Couldn’t reach/);
  });
});
