/**
 * Columns added by a migration you may not have run yet (water from drinks,
 * micronutrients). A write that sends one the database doesn't have is tried
 * again without it, and later writes leave it out, so the app keeps working
 * until you run the SQL.
 */
const missing = new Set<string>();

/** The micronutrient columns on foods. */
export const MICRO_COLUMNS = ['micros', 'micros_est'] as const;

type PgError = { code?: string; message?: string };

/** Whether the database has this column, as far as we know (yes until a write says otherwise). */
export const hasColumn = (column: string) => !missing.has(column);

/** A row (or rows) without the columns the database doesn't have. */
export function dropMissing<T extends object>(row: T): T;
export function dropMissing<T extends object>(row: T[]): T[];
export function dropMissing<T extends object>(row: T | T[]): T | T[] {
  if (Array.isArray(row)) return row.map((r) => dropMissing(r));
  if (missing.size === 0) return row;
  return Object.fromEntries(Object.entries(row).filter(([k]) => !missing.has(k))) as T;
}

/** The optional column a "column not found" error is about, if it's one of these. */
function missingColumn(error: PgError | null, optional: readonly string[]): string | null {
  if (!error || error.code !== 'PGRST204') return null;
  return optional.find((c) => !missing.has(c) && (error.message ?? '').includes(`'${c}'`)) ?? null;
}

/**
 * Runs a write that may include optional columns. `write` gets `dropMissing`
 * to apply to its rows; if the database says one of `optional` doesn't exist,
 * that column is dropped from now on and the write runs again.
 */
export async function tolerantWrite<R extends { error: PgError | null }>(optional: readonly string[], write: (drop: typeof dropMissing) => PromiseLike<R>): Promise<R> {
  let result = await write(dropMissing);
  for (let tries = 0; tries < optional.length; tries++) {
    const column = missingColumn(result.error, optional);
    if (!column) break;
    missing.add(column);
    result = await write(dropMissing);
  }
  return result;
}
