import { fetchOffProduct, type OffLookup } from '@/features/search/off';
import type { ExternalFood } from '@/features/search/types';
import { findUsdaByBarcode } from '@/features/search/usda';
import { usdaApiKey } from '@/lib/env';
import { requireSupabase } from '@/lib/supabase';

/**
 * The forms one product's code can take: a 12-digit UPC-A is the same code
 * as a 13-digit EAN-13 with a leading 0, and phones report either.
 */
export function barcodeVariants(raw: string): string[] {
  const code = raw.replace(/\D/g, '');
  const out = new Set([code]);
  if (code.length === 12) out.add(`0${code}`);
  if (code.length === 13 && code.startsWith('0')) out.add(code.slice(1));
  return [...out].filter((c) => /^\d{6,14}$/.test(c));
}

/**
 * Checks a typed barcode. 12-, 13- and 14-digit codes end in a check digit,
 * which catches most typos; 8-digit codes come in two kinds, so any is allowed.
 */
export function barcodeProblem(raw: string): string | null {
  const code = raw.replace(/\s/g, '');
  if (!/^\d+$/.test(code)) return 'A barcode is only numbers.';
  if (![8, 12, 13, 14].includes(code.length)) return 'Barcodes have 8, 12 or 13 digits. Check the number under the bars.';
  if (code.length === 8) return null;
  const digits = code.split('').map(Number);
  const check = digits.pop() as number;
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check ? null : 'That number doesn’t look right. Check it against the package.';
}

export type BarcodeResult =
  | { kind: 'saved'; foodId: string }
  | { kind: 'found'; food: ExternalFood }
  | { kind: 'incomplete'; name: string | null; brand: string | null }
  | { kind: 'missing' };

type Sources = {
  findSaved: (codes: string[]) => Promise<string | null>;
  fetchOff: (code: string, signal?: AbortSignal) => Promise<OffLookup>;
  findUsda: (codes: string[], signal?: AbortSignal) => Promise<ExternalFood | null>;
};

/** A food you saved with this barcode (one you created, or one you logged from a scan before). */
async function findSaved(codes: string[]): Promise<string | null> {
  const { data, error } = await requireSupabase().from('foods').select('id').in('barcode', codes).limit(1);
  if (error) throw error;
  return (data?.[0]?.id as string | undefined) ?? null;
}

const defaultSources: Sources = {
  findSaved,
  fetchOff: fetchOffProduct,
  findUsda: (codes, signal) => findUsdaByBarcode(codes, usdaApiKey, signal),
};

/**
 * What a scanned code is: your own saved food first (instant, and your
 * numbers win), then Open Food Facts, then USDA's US branded foods. Throws only
 * when neither database could be reached, so "not found" is never a guess.
 */
export async function lookupBarcode(raw: string, signal?: AbortSignal, sources: Sources = defaultSources): Promise<BarcodeResult> {
  const codes = barcodeVariants(raw);
  if (codes.length === 0) return { kind: 'missing' };

  try {
    const saved = await sources.findSaved(codes);
    if (saved) return { kind: 'saved', foodId: saved };
  } catch {
    // Can't check your foods (offline?): the databases may still answer.
  }

  let incomplete: BarcodeResult | null = null;
  let offFailed = false;
  try {
    const off = await sources.fetchOff(codes[0], signal);
    if (off.kind === 'found') return off;
    if (off.kind === 'incomplete') incomplete = off;
  } catch (e) {
    if (signal?.aborted) throw e;
    offFailed = true;
  }

  try {
    const usda = await sources.findUsda(codes, signal);
    if (usda) return { kind: 'found', food: usda };
  } catch (e) {
    if (signal?.aborted) throw e;
    if (offFailed) throw new Error('Couldn’t reach the food databases.');
  }
  return incomplete ?? { kind: 'missing' };
}
