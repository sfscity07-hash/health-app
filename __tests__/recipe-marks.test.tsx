import { render, screen } from '@testing-library/react-native';

import { FoodRow } from '@/components/food/FoodRow';
import { MealCard } from '@/components/foodlog/MealCard';
import type { FoodLogEntry } from '@/features/dashboard/api';

const entry = (over: Partial<FoodLogEntry>): FoodLogEntry => ({
  id: 'e1',
  logged_at: '2026-10-09T13:00:00Z',
  meal: 'lunch',
  food_id: 'food-oats',
  name: 'Rolled oats',
  brand: null,
  quantity: 60,
  unit: 'g',
  grams: 60,
  kcal: 227.4,
  protein_g: 7.8,
  carbs_g: 40.8,
  fat_g: 3.9,
  fiber_g: 6,
  ...over,
});

describe('recipes stand out', () => {
  it('a recipe row in a list is tagged and read out as a recipe', async () => {
    await render(<FoodRow name="Paneer marinade" detail="50 g" kcal={151} recipe onPress={() => {}} onAdd={() => {}} />);
    expect(screen.getByText('Recipe')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^Paneer marinade, recipe, 50 g, 151 calories/ })).toBeOnTheScreen();
  });

  it('a plain food row has no recipe tag', async () => {
    await render(<FoodRow name="Rolled oats" detail="60 g" kcal={227} tag="USDA" onPress={() => {}} onAdd={() => {}} />);
    expect(screen.queryByText('Recipe')).toBeNull();
    expect(screen.getByText('USDA')).toBeOnTheScreen();
  });

  it('logged recipes are marked in the Food log, other foods are not', async () => {
    await render(
      <MealCard
        meal="lunch"
        entries={[entry({}), entry({ id: 'e2', food_id: 'r1', name: 'Paneer marinade', quantity: 50, grams: 50, kcal: 151.3 })]}
        recipeIds={new Set(['r1'])}
        onAdd={() => {}}
        onPressEntry={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /^Paneer marinade, recipe, 151 calories/ })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^Rolled oats, 227 calories/ })).toBeOnTheScreen();
    expect(screen.getAllByText(/^Recipe ·/)).toHaveLength(1);
  });
});
