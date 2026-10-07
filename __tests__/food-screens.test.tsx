import { render, screen, userEvent } from '@testing-library/react-native';

import { FoodDetail } from '@/components/food/FoodDetail';
import { QuickAddForm } from '@/components/food/QuickAddForm';
import { relativeDay } from '@/components/foodlog/DayNav';
import type { FoodWithServings } from '@/features/food/api';

const bar: FoodWithServings = {
  id: 'f1',
  source: 'custom',
  name: 'Protein bar',
  brand: 'Grenade',
  kcal_100g: 350,
  protein_100g: 33.3,
  carbs_100g: 30,
  fat_100g: 13.3,
  fiber_100g: 10,
  default_serving_g: 60,
  default_serving_label: 'bar',
  servings: [],
};

const zero = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };
const targets = { kcal: 2000, protein_g: 150, carbs_g: 200, fat_g: 65, fiber_g: 28 };

describe('FoodDetail', () => {
  it('starts on one serving and logs what you picked', async () => {
    const onSubmit = jest.fn();
    await render(
      <FoodDetail food={bar} mode="add" initialMeal="lunch" before={zero} targets={targets} saving={false} onClose={jest.fn()} onSubmit={onSubmit} />,
    );
    // 60 g of a 350 kcal/100 g food.
    expect(screen.getByRole('button', { name: /Add to Lunch/ })).toBeOnTheScreen();
    expect(screen.getAllByText('210 kcal').length).toBeGreaterThan(0);
    // 6 g of fibre in one bar, against a 28 g day.
    expect(screen.getByText('6.0 g')).toBeOnTheScreen();
    expect(screen.getByText('21% of day')).toBeOnTheScreen();

    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'More bar' }));
    await user.press(screen.getByRole('radio', { name: 'Dinner' }));
    await user.press(screen.getByRole('button', { name: /Add to Dinner/ }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const choice = onSubmit.mock.calls[0][0];
    expect(choice).toMatchObject({ meal: 'dinner', qty: 1.25, grams: 75 });
    expect(choice.unit.label).toBe('bar');
    expect(choice.nutrients.kcal).toBeCloseTo(262.5);
  });

  it('keeps the amount of food when you switch to grams', async () => {
    const onSubmit = jest.fn();
    await render(
      <FoodDetail
        food={bar}
        mode="edit"
        initialUnit="bar"
        initialQty={2}
        initialMeal="snack"
        before={zero}
        targets={targets}
        saving={false}
        onClose={jest.fn()}
        onSubmit={onSubmit}
        onDelete={jest.fn()}
      />,
    );
    const user = userEvent.setup();
    await user.press(screen.getByRole('radio', { name: 'g' }));
    await user.press(screen.getByRole('button', { name: /Save changes/ }));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ qty: 120, grams: 120 });
  });

  it('offers grams and ounces for every food', async () => {
    await render(
      <FoodDetail food={bar} mode="add" initialMeal="lunch" before={zero} targets={targets} saving={false} onClose={jest.fn()} onSubmit={jest.fn()} />,
    );
    expect(screen.getByRole('radio', { name: 'bar' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'g' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'oz' })).toBeOnTheScreen();
  });

  it('adds a scoop to a food and logs by the scoop', async () => {
    const onAddUnit = jest.fn();
    const onSubmit = jest.fn();
    const powder = { ...bar, name: 'Whey', default_serving_label: null, default_serving_g: 100, kcal_100g: 400 };
    await render(
      <FoodDetail
        food={powder}
        mode="add"
        initialMeal="breakfast"
        before={zero}
        targets={targets}
        saving={false}
        onClose={jest.fn()}
        onSubmit={onSubmit}
        onAddUnit={onAddUnit}
      />,
    );
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Add a unit' }));
    await user.press(screen.getByRole('radio', { name: 'scoop' }));
    await user.type(screen.getByLabelText('1 scoop weighs'), '30');
    await user.press(screen.getByRole('button', { name: 'Add unit' }));

    expect(onAddUnit).toHaveBeenCalledWith({ label: 'scoop', grams: 30 });
    expect(screen.getByRole('radio', { name: 'scoop' })).toBeChecked();
    await user.press(screen.getByRole('button', { name: /Add to Breakfast/ }));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ qty: 1, grams: 30, unit: { label: 'scoop' } });
    expect(onSubmit.mock.calls[0][0].nutrients.kcal).toBe(120);
  });

  it('asks for a second tap before deleting', async () => {
    const onDelete = jest.fn();
    await render(
      <FoodDetail food={bar} mode="edit" initialMeal="snack" before={zero} targets={targets} saving={false} onClose={jest.fn()} onSubmit={jest.fn()} onDelete={onDelete} />,
    );
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Delete entry' }));
    expect(onDelete).not.toHaveBeenCalled();
    await user.press(screen.getByRole('button', { name: 'Tap again to delete' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

describe('QuickAddForm', () => {
  it('works out calories from macros when you leave calories empty', async () => {
    const onSubmit = jest.fn();
    await render(<QuickAddForm mode="add" initialMeal="dinner" before={zero} targets={targets} onClose={jest.fn()} onSubmit={onSubmit} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Protein'), '40');
    await user.type(screen.getByLabelText('Carbs'), '50');
    await user.type(screen.getByLabelText('Fat'), '20');
    await user.type(screen.getByLabelText('Fibre'), '9');
    await user.press(screen.getByRole('button', { name: /Add to Dinner/ }));
    expect(onSubmit).toHaveBeenCalledWith({
      meal: 'dinner',
      name: 'Quick add',
      nutrients: { kcal: 540, protein_g: 40, carbs_g: 50, fat_g: 20, fiber_g: 9 },
    });
  });

  it('explains what is missing instead of saving', async () => {
    const onSubmit = jest.fn();
    await render(<QuickAddForm mode="add" initialMeal="dinner" before={zero} targets={targets} onClose={jest.fn()} onSubmit={onSubmit} />);
    await userEvent.setup().press(screen.getByRole('button', { name: /Add to Dinner/ }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/Enter calories/)).toBeOnTheScreen();
  });
});

describe('relativeDay', () => {
  it('names recent days in words', () => {
    expect(relativeDay('2026-10-06', '2026-10-06')).toBe('Today');
    expect(relativeDay('2026-10-05', '2026-10-06')).toBe('Yesterday');
    expect(relativeDay('2026-10-02', '2026-10-06')).toBe('Friday');
    expect(relativeDay('2026-09-20', '2026-10-06')).toBe('Sep 20');
  });
});
