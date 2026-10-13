import { standardWord } from '@/features/search/spelling';

/**
 * Ingredient ideas from a recipe's name, so the picker can search before you
 * type: the foods the name mentions ("paneer"), then what that kind of dish
 * usually has ("tikka marinade" → yoghurt, ginger garlic paste, lemon…).
 * When swapping, the usual alternatives instead ("paneer" → tofu, soya chaap…).
 */

/** Words that say nothing about what's in it. */
const STOP = new Set(
  'a an the and with of in on for to my our mom moms mum mums home homemade style special quick easy healthy simple classic best new copy version spicy mild sweet high low protein fat calorie calories lunch dinner breakfast snack meal prep big small mini fresh leftover leftovers batch bowl plate day sunday monday tuesday wednesday thursday friday saturday'.split(
    ' ',
  ),
);

/** Foods written as two words, kept together. */
const PHRASES = [
  'soya chaap',
  'soya chunks',
  'peanut butter',
  'greek yogurt',
  'chia seeds',
  'olive oil',
  'brown rice',
  'sweet potato',
  'cottage cheese',
  'chicken breast',
  'kidney beans',
  'whey protein',
  'egg whites',
  'overnight oats',
  'fried rice',
  'butter chicken',
];

/** What a kind of dish usually has. The dish word itself is searched too when it's a food (oats, rice, dal). */
const DISHES: Record<string, { food?: boolean; ideas: string[] }> = {
  marinade: { ideas: ['yogurt', 'ginger garlic paste', 'lemon juice', 'mustard oil', 'ghee'] },
  tikka: { ideas: ['yogurt', 'ginger garlic paste', 'lemon juice', 'mustard oil'] },
  tandoori: { ideas: ['yogurt', 'ginger garlic paste', 'lemon juice', 'mustard oil'] },
  curry: { ideas: ['onion', 'tomato', 'ginger garlic paste', 'oil', 'cream'] },
  gravy: { ideas: ['onion', 'tomato', 'ginger garlic paste', 'oil'] },
  masala: { ideas: ['onion', 'tomato', 'ginger garlic paste', 'oil'] },
  sabzi: { ideas: ['onion', 'tomato', 'oil'] },
  sabji: { ideas: ['onion', 'tomato', 'oil'] },
  makhani: { ideas: ['butter', 'cream', 'tomato', 'cashews'] },
  'butter chicken': { ideas: ['chicken', 'butter', 'cream', 'tomato', 'cashews'] },
  korma: { ideas: ['onion', 'yogurt', 'cream', 'cashews'] },
  kadai: { ideas: ['onion', 'tomato', 'capsicum', 'oil'] },
  dal: { food: true, ideas: ['toor dal', 'moong dal', 'ghee', 'onion', 'tomato'] },
  daal: { ideas: ['toor dal', 'moong dal', 'ghee', 'onion', 'tomato'] },
  tadka: { ideas: ['ghee', 'cumin seeds', 'garlic'] },
  rajma: { food: true, ideas: ['kidney beans', 'onion', 'tomato'] },
  chole: { ideas: ['chickpeas', 'onion', 'tomato'] },
  chana: { food: true, ideas: ['chickpeas', 'onion', 'tomato'] },
  biryani: { ideas: ['basmati rice', 'onion', 'yogurt', 'ghee'] },
  pulao: { ideas: ['basmati rice', 'onion', 'ghee', 'peas'] },
  'fried rice': { ideas: ['rice', 'egg', 'soy sauce', 'oil'] },
  rice: { food: true, ideas: [] },
  khichdi: { ideas: ['rice', 'moong dal', 'ghee'] },
  paratha: { ideas: ['whole wheat flour', 'ghee'] },
  roti: { ideas: ['whole wheat flour'] },
  chapati: { ideas: ['whole wheat flour'] },
  dosa: { ideas: ['rice', 'urad dal', 'oil'] },
  idli: { ideas: ['rice', 'urad dal'] },
  chilla: { ideas: ['besan', 'onion', 'tomato'] },
  cheela: { ideas: ['besan', 'onion', 'tomato'] },
  poha: { food: true, ideas: ['peanuts', 'onion', 'oil'] },
  upma: { ideas: ['semolina', 'onion', 'oil'] },
  oats: { food: true, ideas: ['milk', 'banana', 'honey', 'chia seeds'] },
  'overnight oats': { ideas: ['oats', 'milk', 'yogurt', 'chia seeds', 'honey'] },
  oatmeal: { ideas: ['oats', 'milk', 'banana', 'honey'] },
  smoothie: { ideas: ['milk', 'banana', 'whey protein', 'peanut butter', 'oats'] },
  shake: { ideas: ['milk', 'banana', 'whey protein', 'peanut butter'] },
  lassi: { ideas: ['yogurt', 'sugar'] },
  raita: { ideas: ['yogurt', 'cucumber'] },
  salad: { ideas: ['cucumber', 'tomato', 'onion', 'lettuce', 'olive oil'] },
  taco: { ideas: ['tortilla', 'cheese', 'onion', 'lettuce', 'salsa'] },
  tacos: { ideas: ['tortilla', 'cheese', 'onion', 'lettuce', 'salsa'] },
  wrap: { ideas: ['tortilla', 'lettuce', 'onion'] },
  burrito: { ideas: ['tortilla', 'rice', 'beans', 'cheese'] },
  roll: { ideas: ['paratha', 'onion', 'egg'] },
  kathi: { ideas: ['paratha', 'onion', 'egg'] },
  frankie: { ideas: ['paratha', 'onion'] },
  sandwich: { ideas: ['bread', 'butter', 'cheese'] },
  toast: { ideas: ['bread', 'butter'] },
  burger: { ideas: ['burger bun', 'cheese', 'lettuce', 'tomato'] },
  pasta: { food: true, ideas: ['olive oil', 'tomato', 'parmesan', 'garlic'] },
  spaghetti: { food: true, ideas: ['olive oil', 'tomato', 'parmesan', 'garlic'] },
  pizza: { ideas: ['pizza base', 'mozzarella', 'tomato sauce'] },
  omelette: { ideas: ['egg', 'onion', 'tomato', 'butter'] },
  omelet: { ideas: ['egg', 'onion', 'tomato', 'butter'] },
  bhurji: { ideas: ['onion', 'tomato', 'butter'] },
  scrambled: { ideas: ['egg', 'butter', 'milk'] },
  egg: { food: true, ideas: [] },
  eggs: { ideas: ['egg'] },
  pancake: { ideas: ['flour', 'milk', 'egg', 'butter'] },
  pancakes: { ideas: ['flour', 'milk', 'egg', 'butter'] },
  soup: { ideas: ['onion', 'garlic', 'butter'] },
  noodles: { food: true, ideas: ['soy sauce', 'oil', 'garlic', 'cabbage'] },
  chowmein: { ideas: ['noodles', 'soy sauce', 'cabbage', 'oil'] },
  stirfry: { ideas: ['oil', 'soy sauce', 'garlic'] },
  kheer: { ideas: ['milk', 'rice', 'sugar'] },
  halwa: { ideas: ['semolina', 'ghee', 'sugar', 'milk'] },
  chaap: { ideas: ['soya chaap'] },
};

/** Healthier or different stand-ins for a swap. */
const SWAPS: Record<string, string[]> = {
  paneer: ['tofu', 'soya chaap', 'chicken breast', 'cottage cheese'],
  'soya chaap': ['paneer', 'tofu', 'soya chunks'],
  chicken: ['paneer', 'tofu', 'soya chunks', 'fish'],
  tofu: ['paneer', 'soya chunks', 'tempeh'],
  ghee: ['olive oil', 'butter', 'cooking spray'],
  butter: ['ghee', 'olive oil', 'cooking spray'],
  oil: ['cooking spray', 'olive oil', 'ghee'],
  cream: ['greek yogurt', 'milk', 'cashew paste'],
  milk: ['skim milk', 'toned milk', 'almond milk', 'soy milk'],
  yogurt: ['greek yogurt', 'low fat yogurt', 'hung curd'],
  curd: ['greek yogurt', 'hung curd'],
  rice: ['brown rice', 'cauliflower rice', 'quinoa'],
  sugar: ['jaggery', 'honey', 'stevia'],
  bread: ['whole wheat bread', 'multigrain bread'],
  potato: ['sweet potato'],
  mayonnaise: ['greek yogurt', 'hung curd'],
  mayo: ['greek yogurt', 'hung curd'],
  cheese: ['low fat cheese', 'cottage cheese', 'paneer'],
  egg: ['egg whites'],
  pasta: ['whole wheat pasta', 'zucchini noodles'],
  tortilla: ['whole wheat tortilla', 'lettuce wrap'],
  maida: ['whole wheat flour', 'oat flour'],
  flour: ['whole wheat flour', 'oat flour'],
};

/** Lower case, shared spelling, plain words. */
const normal = (s: string) =>
  s
    .toLowerCase()
    .replace(/['’]s\b/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(standardWord)
    .join(' ');

/** Splits a name into its foods and dish words, keeping two-word foods together. */
function terms(name: string): string[] {
  let rest = ` ${normal(name)} `;
  const found: string[] = [];
  for (const p of PHRASES) {
    if (rest.includes(` ${p} `)) {
      found.push(p);
      rest = rest.replace(` ${p} `, ' ');
    }
  }
  for (const w of rest.split(' ')) if (w && !STOP.has(w)) found.push(w);
  return found;
}

/** Does a food's name mention this idea? ("Greek Yoghurt" mentions "yogurt".) */
export function mentions(idea: string, name: string): boolean {
  const n = ` ${normal(name)} `;
  return normal(idea)
    .split(' ')
    .every((w) => n.includes(` ${w} `) || n.includes(` ${w}s `) || (w.length > 4 && n.includes(w)));
}

const MAX = 8;

/** Ideas to search for a recipe's next ingredient, minus what's already in it. */
export function ingredientIdeas(recipeName: string, existing: string[]): string[] {
  const out: string[] = [];
  const add = (idea: string) => {
    if (!out.includes(idea) && !existing.some((name) => mentions(idea, name))) out.push(idea);
  };
  const found = terms(recipeName);
  // Foods the name mentions come first…
  for (const t of found) {
    const dish = DISHES[t];
    if ((!dish || dish.food) && t.length >= 3) add(t);
  }
  // …then what the dish usually has.
  for (const t of found) for (const idea of DISHES[t]?.ideas ?? []) add(idea);
  return out.slice(0, MAX);
}

/** How an idea reads on screen: the British spelling you'd type ("yoghurt"); searching it finds both. */
export const ideaLabel = (idea: string) => idea.replace(/yogurt/g, 'yoghurt');

/** Stand-ins for an ingredient you're swapping out. */
export function swapIdeas(ingredient: string): string[] {
  const n = normal(ingredient);
  const key = Object.keys(SWAPS).find((k) => ` ${n} `.includes(` ${k} `)) ?? Object.keys(SWAPS).find((k) => mentions(k, ingredient));
  return key ? SWAPS[key].filter((s) => !mentions(s, ingredient)).slice(0, MAX) : [];
}

/** How alike two recipe names are: the number of meaningful words they share. */
export function nameOverlap(a: string, b: string): number {
  const ta = new Set(terms(a));
  return terms(b).filter((t) => ta.has(t)).length;
}
