/**
 * British and other spellings, mapped to the one most product names and
 * USDA use, so "greek yoghurt" finds "Greek Yogurt" and both count as the
 * same food.
 */
const SPELLINGS: Record<string, string> = {
  yoghurt: 'yogurt',
  yoghurts: 'yogurts',
  yoghourt: 'yogurt',
  yogourt: 'yogurt',
  flavour: 'flavor',
  flavoured: 'flavored',
  flavours: 'flavors',
  colour: 'color',
  fibre: 'fiber',
  chilli: 'chili',
  chillies: 'chilies',
  aubergine: 'eggplant',
  courgette: 'zucchini',
  coriander: 'cilantro',
  beetroot: 'beet',
  rocket: 'arugula',
  prawn: 'shrimp',
  prawns: 'shrimp',
  porridge: 'oatmeal',
  skimmed: 'skim',
  wholemeal: 'wholewheat',
};

/** One word, in the shared spelling. Expects lower case. */
export const standardWord = (w: string) => SPELLINGS[w] ?? w;

/** The search as USDA spells things ("Greek yoghurt" → "Greek yogurt"). */
export function usSpelling(query: string): string {
  return query
    .split(/(\s+)/)
    .map((part) => SPELLINGS[part.toLowerCase()] ?? part)
    .join('');
}
