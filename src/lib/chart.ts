/** Small helpers for drawing charts by hand with react-native-svg. */

/**
 * About `target` round tick values covering [min, max], stepping by 1, 2 or
 * 5 × a power of ten (e.g. 81, 82, 83, 84 for 80.4–84.9): whichever step
 * lands closest to the target count.
 */
export function niceTicks(min: number, max: number, target = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (max - min < 1e-9) return [Math.round(min * 10) / 10];
  const power = Math.pow(10, Math.floor(Math.log10((max - min) / target)));
  const ticksFor = (step: number) => {
    const out: number[] = [];
    for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
    return out;
  };
  const options = [1, 2, 5, 10, 20].map((m) => ticksFor(m * power)).filter((t) => t.length >= 2);
  return options.reduce((best, t) => (Math.abs(t.length - target) < Math.abs(best.length - target) ? t : best), options[0] ?? []);
}

/**
 * The value range to plot: the data with some breathing room, stretched to
 * include a reference value (a goal) only when it's reasonably close, so a
 * far-away goal doesn't flatten the line.
 */
export function valueDomain(values: number[], reference: number | null, minSpan: number): { min: number; max: number; includesReference: boolean } {
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  const span = Math.max(hi - lo, minSpan);
  const mid = (lo + hi) / 2;
  lo = Math.min(lo, mid - span / 2);
  hi = Math.max(hi, mid + span / 2);
  let includesReference = false;
  if (reference !== null && reference >= lo - span * 0.75 && reference <= hi + span * 0.75) {
    lo = Math.min(lo, reference);
    hi = Math.max(hi, reference);
    includesReference = true;
  }
  const pad = (hi - lo) * 0.12;
  return { min: lo - pad, max: hi + pad, includesReference };
}

/** Maps a value in [d0, d1] to a position in [r0, r1]. */
export const scale = (d0: number, d1: number, r0: number, r1: number) => (v: number) =>
  d1 === d0 ? (r0 + r1) / 2 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);

/** Index of the x position closest to `x` (positions sorted ascending). */
export function nearestIndex(xs: number[], x: number): number {
  if (xs.length === 0) return -1;
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] < x) lo = mid;
    else hi = mid;
  }
  return Math.abs(xs[lo] - x) <= Math.abs(xs[hi] - x) ? lo : hi;
}

/** An SVG path through the points with straight segments. */
export function linePath(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}
