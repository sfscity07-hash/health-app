import type { Serving } from '@/lib/portion';

const MAX_LABEL = 40;

/** "1", "2", "0.5", "1/2", "1 1/2" → a number. */
function parseAmount(s: string): number | null {
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const clip = (s: string) => (s.length > MAX_LABEL ? `${s.slice(0, MAX_LABEL - 1).trimEnd()}…` : s);

/**
 * Turns a household measure into a serving you can count:
 * "1 medium (7\" to 7-7/8\" long)" → "medium", "1 bar (40 g)" → "bar",
 * "2 tbsp" → "serving (2 tbsp)". Amounts other than one keep their text so
 * nothing is wrongly made singular.
 */
export function measureToServing(text: string | null | undefined, grams: number | null | undefined): Serving | null {
  if (!text || !grams || !(grams > 0)) return null;
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean || /quantity not specified/i.test(clean)) return null;
  const withoutNotes = clean.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  // Labels that are only a weight ("30 g", "100ml") just mean "a serving".
  if (/^\d+([.,]\d+)?\s*(g|gr|grams?|ml|mL)$/i.test(withoutNotes)) return { label: 'serving', grams };
  const m = withoutNotes.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)\s+(.+)$/);
  if (m) {
    const amount = parseAmount(m[1].replace(',', '.'));
    const unit = m[2].trim().toLowerCase();
    if (amount === 1 && unit) return { label: clip(unit), grams };
    return { label: clip(`serving (${withoutNotes.toLowerCase()})`), grams };
  }
  return { label: clip(withoutNotes.toLowerCase()), grams };
}
