export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type Meal = (typeof MEALS)[number];

export const MEAL_LABEL: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

/** The meal the logger opens on, based on the time of day. */
export function mealForTime(d: Date): Meal {
  const minutes = d.getHours() * 60 + d.getMinutes();
  if (minutes < 4 * 60) return 'snack';
  if (minutes < 10 * 60 + 30) return 'breakfast';
  if (minutes < 14 * 60 + 30) return 'lunch';
  if (minutes < 17 * 60) return 'snack';
  if (minutes < 21 * 60 + 30) return 'dinner';
  return 'snack';
}
