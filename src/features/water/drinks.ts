import type { Meal } from '@/lib/meals';

/**
 * Water from what you drink. Milk, tea, coffee, juice, buttermilk, soup and
 * the like count toward your water by roughly how much of them is water. The
 * end of a food's name decides what it is, so "chocolate milk" counts and
 * "milk chocolate" or "oats with milk" don't. Anything you say was cooked down
 * (milk simmered into oats) counts for nothing, and the app remembers that for
 * next time.
 */

/** About how much of each drink is water. */
const DRINKS: Record<string, number> = {
  water: 1,
  'coconut water': 0.95,
  tea: 0.99,
  chai: 0.9,
  'milk tea': 0.9,
  'bubble tea': 0.8,
  'iced tea': 0.92,
  kahwa: 0.99,
  coffee: 0.99,
  'cold coffee': 0.82,
  espresso: 0.97,
  americano: 0.99,
  latte: 0.88,
  cappuccino: 0.9,
  'flat white': 0.88,
  macchiato: 0.9,
  mocha: 0.84,
  frappe: 0.8,
  frappuccino: 0.8,
  'cold brew': 0.99,
  milk: 0.88,
  'skim milk': 0.91,
  'chocolate milk': 0.82,
  'almond milk': 0.97,
  'oat milk': 0.9,
  'soy milk': 0.9,
  'soya milk': 0.9,
  'rice milk': 0.89,
  'badam milk': 0.8,
  'rose milk': 0.85,
  doodh: 0.88,
  buttermilk: 0.9,
  chaas: 0.92,
  chaach: 0.92,
  chhaas: 0.92,
  mattha: 0.92,
  lassi: 0.8,
  kefir: 0.88,
  ayran: 0.92,
  juice: 0.88,
  lemonade: 0.9,
  'nimbu pani': 0.95,
  shikanji: 0.93,
  jaljeera: 0.95,
  'aam panna': 0.85,
  sharbat: 0.88,
  thandai: 0.8,
  'sol kadhi': 0.9,
  smoothie: 0.8,
  milkshake: 0.76,
  shake: 0.8,
  'protein shake': 0.85,
  'hot chocolate': 0.82,
  'hot cocoa': 0.82,
  soda: 0.89,
  cola: 0.89,
  'soft drink': 0.89,
  'energy drink': 0.88,
  'sports drink': 0.93,
  drink: 0.88,
  beverage: 0.9,
  kombucha: 0.96,
  'ginger ale': 0.9,
  'root beer': 0.89,
  'ginger beer': 0.89,
  ors: 0.97,
  soup: 0.9,
  broth: 0.95,
  consomme: 0.95,
  rasam: 0.93,
  shorba: 0.92,
};

/** Drinks known by their brand, wherever it is in the name ("Coke Zero", "Pepsi Max"). */
const BRANDS: Record<string, number> = {
  coke: 0.89,
  'coca cola': 0.89,
  pepsi: 0.89,
  sprite: 0.9,
  fanta: 0.88,
  '7up': 0.9,
  'mountain dew': 0.88,
  'thums up': 0.89,
  limca: 0.9,
  mirinda: 0.88,
  'red bull': 0.89,
  'monster energy': 0.88,
  gatorade: 0.94,
  powerade: 0.94,
  frooti: 0.85,
  maaza: 0.85,
  'appy fizz': 0.88,
  'paper boat': 0.88,
  electral: 0.97,
  yakult: 0.85,
};

/** Words that make it the dry or concentrated form (or alcohol), not a drink that hydrates. */
const NOT_DRINK = new Set(
  'powder powdered dry dried condensed evaporated concentrate concentrated mix granules beans bean leaves leaf bag bags pod pods capsule capsules cube cubes bouillon syrup ground premix vodka whisky whiskey rum gin tequila brandy liqueur cocktail wine alcoholic'.split(
    ' ',
  ),
);

/** Ends in a drink word but isn't one you drink. */
const NOT_HEADS = ['coconut milk', 'rose water'];

/** Sizes and containers at the end of a product name ("Whole milk 1L", "Cola can"). */
const SIZE = /^(\d+(ml|l|ltr|cl|g|kg|oz|x)?|ml|l|ltr|litre|liter|litres|liters|fl|oz|g|kg|pack|bottle|bottles|can|cans|carton|tetra|pouch|cup|cups|glass|mug|serving|large|small|medium|regular)$/;

const clean = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** What the food is, from its name: the part before any comma or "with", minus sizes ("Tea with milk" → "tea"). */
export function nameHead(name: string): string {
  const parts = name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .split(/[,;]/)
    .map(clean)
    .filter(Boolean);
  // USDA lists some drinks as "Beverages, coffee, brewed".
  let first = parts[0] ?? '';
  if (/^(beverages?|drinks?)$/.test(first) && parts[1]) first = parts[1];
  // "Oats with milk" is oats; "tea with milk" is tea.
  const words = first.replace(/ (with|w|in|and|plus|topped|made|served|on|over) .*$/, '').split(' ');
  while (words.length > 1 && SIZE.test(words[words.length - 1])) words.pop();
  return words.join(' ');
}

/** How much of a food is water if it's a drink (0.88 for milk), or null if it isn't one. */
export function waterShare(name: string): number | null {
  const all = clean(name).split(' ');
  if (all.some((w) => NOT_DRINK.has(w))) return null;
  const h = nameHead(name);
  const padded = ` ${h} `;
  for (const [brand, share] of Object.entries(BRANDS)) if (padded.includes(` ${brand} `)) return share;
  if (NOT_HEADS.some((x) => h === x || h.endsWith(` ${x}`))) return null;
  const words = h.split(' ');
  for (let n = Math.min(3, words.length); n >= 1; n--) {
    const share = DRINKS[words.slice(-n).join(' ')];
    if (share !== undefined) return share;
  }
  return null;
}

/** Whether a food counts as a drink at all. */
export const isDrink = (name: string) => waterShare(name) !== null;

/**
 * What a logged food adds to your water, in ml: 0 when you said it doesn't
 * count, null when it isn't a drink (or has no weight to go on).
 */
export function drinkWater(name: string, grams: number | null, counts = true): number | null {
  const share = waterShare(name);
  if (share === null || !grams || grams <= 0) return null;
  return counts ? Math.round(grams * share) : 0;
}

export type DrinkMemory = { food_id: string | null; name: string; meal: Meal; water_ml?: number | null };

/**
 * What you chose last time for this food: true if it counted, false if you
 * said it didn't. It looks at the same meal first (milk in your breakfast oats
 * vs a glass of milk at night), then any meal. Null if it never came up.
 * Rows come newest first.
 */
export function rememberedCounts(rows: DrinkMemory[] | undefined, food: { foodId: string | null; name: string }, meal: Meal): boolean | null {
  const name = food.name.trim().toLowerCase();
  const same = (rows ?? []).filter(
    (r) => (food.foodId ? r.food_id === food.foodId : r.name.trim().toLowerCase() === name) && r.water_ml !== null && r.water_ml !== undefined,
  );
  const last = same.find((r) => r.meal === meal) ?? same[0];
  return last ? (last.water_ml as number) > 0 : null;
}

/** The day's water: what you drank as water, plus water from drinks unless you've turned that off. */
export const waterTotal = (day: { water_ml: number; drink_ml: number }, countDrinks: boolean) => day.water_ml + (countDrinks ? day.drink_ml : 0);
