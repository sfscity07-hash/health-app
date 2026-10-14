import { dropMissing, hasColumn, tolerantWrite } from '@/lib/optionalColumns';

describe('columns from a migration you haven’t run yet', () => {
  it('retries without the missing column and leaves it out from then on', async () => {
    const sent: object[] = [];
    const write = jest.fn(async (drop: typeof dropMissing) => {
      const row = drop({ name: 'Milk', micros: { calcium_mg: 113 }, micros_est: null });
      sent.push(row);
      return 'micros' in row ? { error: { code: 'PGRST204', message: "Could not find the 'micros' column of 'foods' in the schema cache" } } : { error: null };
    });
    expect((await tolerantWrite(['micros', 'micros_est'], write)).error).toBeNull();
    expect(sent).toEqual([{ name: 'Milk', micros: { calcium_mg: 113 }, micros_est: null }, { name: 'Milk', micros_est: null }]);
    expect(hasColumn('micros')).toBe(false);
    expect(hasColumn('micros_est')).toBe(true);
    // The next write skips it straight away.
    await tolerantWrite(['micros'], write);
    expect(sent[2]).toEqual({ name: 'Milk', micros_est: null });
  });

  it('passes other errors through untouched', async () => {
    const error = { code: '23505', message: 'duplicate key' };
    expect((await tolerantWrite(['water_ml'], async () => ({ error }))).error).toBe(error);
  });
});
