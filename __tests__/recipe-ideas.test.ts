import { ideaLabel, ingredientIdeas, mentions, nameOverlap, swapIdeas } from '@/features/recipes/suggest';

describe('ingredient ideas from a recipe’s name', () => {
  it('starts with the foods the name mentions, then what the dish usually has', () => {
    expect(ingredientIdeas('Paneer tikka marinade', [])).toEqual(['paneer', 'yogurt', 'ginger garlic paste', 'lemon juice', 'mustard oil', 'ghee']);
  });

  it('leaves out what is already in the recipe, whatever it is called there', () => {
    expect(ingredientIdeas('Paneer tikka marinade', ['Paneer', 'Ghee, clarified butter', 'Greek Yoghurt'])).toEqual(['ginger garlic paste', 'lemon juice', 'mustard oil']);
  });

  it('keeps two-word foods together', () => {
    expect(ingredientIdeas('Soya chaap tikka', [])[0]).toBe('soya chaap');
    expect(ingredientIdeas('Overnight oats', [])).toEqual(['oats', 'milk', 'yogurt', 'chia seeds', 'honey']);
  });

  it('searches the dish word itself when it is a food', () => {
    expect(ingredientIdeas('Dal tadka', [])).toEqual(['dal', 'toor dal', 'moong dal', 'ghee', 'onion', 'tomato', 'cumin seeds', 'garlic']);
    expect(ingredientIdeas('Chicken curry', []).slice(0, 3)).toEqual(['chicken', 'onion', 'tomato']);
  });

  it('ignores words that say nothing about what is in it', () => {
    expect(ingredientIdeas("Mom's special healthy paneer bowl", [])).toEqual(['paneer']);
    expect(ingredientIdeas('', [])).toEqual([]);
  });

  it('stops at eight ideas', () => {
    expect(ingredientIdeas('Chicken paneer burrito taco salad', []).length).toBe(8);
  });
});

describe('swap ideas', () => {
  it('suggests the usual stand-ins', () => {
    expect(swapIdeas('Paneer')).toEqual(['tofu', 'soya chaap', 'chicken breast', 'cottage cheese']);
    expect(swapIdeas('Soya Chaap')).toEqual(['paneer', 'tofu', 'soya chunks']);
  });

  it('never suggests what you are swapping out', () => {
    expect(swapIdeas('Ghee, clarified butter')).toEqual(['olive oil', 'cooking spray']);
    expect(swapIdeas('Greek Yoghurt')).toEqual(['low fat yogurt', 'hung curd']);
  });

  it('has nothing for foods it does not know', () => {
    expect(swapIdeas('Dragon fruit')).toEqual([]);
  });
});

describe('matching names', () => {
  it('sees British and American spellings as the same food', () => {
    expect(mentions('yogurt', 'Greek Yoghurt')).toBe(true);
    expect(mentions('ghee', 'Ghee, clarified butter')).toBe(true);
    expect(mentions('oil', 'Toilet roll')).toBe(false);
  });

  it('finds a similar saved recipe by the words the names share', () => {
    expect(nameOverlap('Paneer tikka marinade', 'Paneer marinade')).toBe(2);
    expect(nameOverlap('Paneer tikka marinade', 'Paneer taco')).toBe(1);
    expect(nameOverlap('Paneer tikka marinade', 'Overnight oats')).toBe(0);
  });

  it('shows the spelling you would type', () => {
    expect(ideaLabel('greek yogurt')).toBe('greek yoghurt');
  });
});
