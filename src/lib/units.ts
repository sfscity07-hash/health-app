/**
 * Unit conversions. Everything is stored in metric (kg, cm, ml, g);
 * these helpers convert only for display and input.
 */

export const KG_PER_LB = 0.45359237;
export const CM_PER_INCH = 2.54;
export const ML_PER_FL_OZ = 29.5735295625;
export const G_PER_OZ = 28.349523125;

export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const lbToKg = (lb: number) => lb * KG_PER_LB;

export const mlToFlOz = (ml: number) => ml / ML_PER_FL_OZ;
export const flOzToMl = (oz: number) => oz * ML_PER_FL_OZ;

export const gToOz = (g: number) => g / G_PER_OZ;
export const ozToG = (oz: number) => oz * G_PER_OZ;

/** 178 cm → { feet: 5, inches: 10 } (inches rounded to the nearest whole inch). */
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = Math.round(cm / CM_PER_INCH);
  return { feet: Math.floor(totalInches / 12), inches: totalInches % 12 };
}

export function feetInchesToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * CM_PER_INCH;
}
