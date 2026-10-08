import { parseNumber } from '@/features/onboarding/draft';
import { flOzToMl, mlToFlOz } from '@/lib/units';

export type Units = 'metric' | 'imperial';

/** What the database accepts for one drink, and for the daily goal. */
export const MAX_DRINK_ML = 5000;
export const MIN_GOAL_ML = 500;
export const MAX_GOAL_ML = 6000;

export type WaterPreset = { label: string; ml: number };

/** The one-tap amounts: a glass first (the dashboard tile adds that), then bottles. */
export function waterPresets(units: Units): WaterPreset[] {
  if (units === 'imperial') {
    return [
      { label: 'Glass', ml: Math.round(flOzToMl(8)) },
      { label: 'Bottle', ml: 500 },
      { label: 'Large', ml: Math.round(flOzToMl(24)) },
    ];
  }
  return [
    { label: 'Glass', ml: 250 },
    { label: 'Bottle', ml: 500 },
    { label: 'Large', ml: 750 },
  ];
}

const oz = (ml: number) => mlToFlOz(ml);
const trim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** One drink: "250 ml", or "8 fl oz" / "16.9 fl oz". */
export function formatDrink(ml: number, units: Units): string {
  if (units === 'imperial') return `${trim(Math.round(oz(ml) * 10) / 10)} fl oz`;
  return `${Math.round(ml)} ml`;
}

/** A day's total, without the unit: "1.25" (litres) or "42" (fl oz). */
export function totalValue(ml: number, units: Units): string {
  return units === 'imperial' ? String(Math.round(oz(ml))) : (ml / 1000).toFixed(2);
}

/** A goal or total with its unit: "2.5 L" or "85 fl oz". */
export function formatVolume(ml: number, units: Units): string {
  if (units === 'imperial') return `${Math.round(oz(ml))} fl oz`;
  // Whole decilitres show one decimal (2.5 L, 1.1 L), anything else two (1.75 L).
  return `${(ml / 1000).toFixed(Math.round(ml) % 100 === 0 ? 1 : 2)} L`;
}

/** What's left to drink: "750 ml to go", but "1.17 L to go" (fl oz either way). */
export const formatLeft = (ml: number, units: Units) => (units === 'metric' && ml >= 1000 ? formatVolume(ml, units) : formatDrink(ml, units));

export const volumeUnit = (units: Units) => (units === 'imperial' ? 'fl oz' : 'L');
export const drinkUnit = (units: Units) => (units === 'imperial' ? 'fl oz' : 'ml');

/** How much the goal moves per − / + tap: 250 ml, or 8 fl oz. */
export const goalStep = (units: Units) => (units === 'imperial' ? flOzToMl(8) : 250);

/** The next goal after a − / + tap, kept in range and on round numbers. */
export function stepGoal(goalMl: number, direction: 1 | -1, units: Units): number {
  const step = goalStep(units);
  const next = Math.round(goalMl / step + direction) * step;
  return Math.round(Math.min(MAX_GOAL_ML, Math.max(MIN_GOAL_ML, next)));
}

/** Glasses for the tile's row of segments. */
export function glassCount(goalMl: number, glassMl: number) {
  return Math.max(1, Math.min(16, Math.round(goalMl / glassMl)));
}

/** A typed amount in your units → ml, or a sentence saying what's wrong. */
export function parseDrink(text: string, units: Units): { ok: true; ml: number } | { ok: false; error: string } {
  const value = parseNumber(text);
  if (value === null || value <= 0) return { ok: false, error: `Type an amount in ${drinkUnit(units)}.` };
  const ml = Math.round(units === 'imperial' ? flOzToMl(value) : value);
  if (ml > MAX_DRINK_ML) return { ok: false, error: `That’s more than ${formatVolume(MAX_DRINK_ML, units)} in one go. Check the number.` };
  return { ok: true, ml: Math.max(1, ml) };
}

/** True when this drink takes the day from under the goal to at or over it. */
export const reachesGoal = (beforeMl: number, addedMl: number, goalMl: number) => goalMl > 0 && beforeMl < goalMl && beforeMl + addedMl >= goalMl;
