import { mealForTime } from '@/lib/meals';

const at = (h: number, m = 0) => new Date(2026, 9, 6, h, m);

describe('mealForTime', () => {
  it.each([
    [at(7, 42), 'breakfast'],
    [at(10, 29), 'breakfast'],
    [at(12, 58), 'lunch'],
    [at(16, 20), 'snack'],
    [at(19, 12), 'dinner'],
    [at(23, 0), 'snack'],
    [at(1, 0), 'snack'],
  ])('%s → %s', (date, meal) => {
    expect(mealForTime(date)).toBe(meal);
  });
});
