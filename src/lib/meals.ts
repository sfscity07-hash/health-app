export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type Meal = (typeof MEALS)[number];

export const MEAL_LABEL: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

/** Meals in the order a day runs, for meal pickers. */
export const MEAL_OPTIONS: { value: Meal; label: string }[] = MEALS.map((m) => ({ value: m, label: MEAL_LABEL[m] }));

export const isMeal = (v: unknown): v is Meal => typeof v === 'string' && (MEALS as readonly string[]).includes(v);

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
