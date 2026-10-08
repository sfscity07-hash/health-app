import { buildInsights, type InsightInput } from '@/features/dashboard/insights';
import { withWeighIn } from '@/features/weight/api';
import { agoText, goalProjection, goodDirection, parseWeight, pointsInRange, weightRuler } from '@/features/weight/logic';
import { linePath, nearestIndex, niceTicks, scale, valueDomain } from '@/lib/chart';
import { trendSeries } from '@/lib/trend';

jest.mock('@/lib/supabase', () => ({ supabase: null, requireSupabase: jest.fn() }));

describe('typing a weight', () => {
  it('reads kg or lb and stores kg', () => {
    expect(parseWeight('82.4', 'metric')).toEqual({ ok: true, kg: 82.4 });
    expect(parseWeight('181.6', 'imperial')).toEqual({ ok: true, kg: 82.37 });
    expect(parseWeight('82,4', 'metric')).toEqual({ ok: true, kg: 82.4 });
  });

  it('catches numbers that can’t be a body weight', () => {
    expect(parseWeight('8.24', 'metric')).toMatchObject({ ok: false, error: expect.stringMatching(/20–400 kg/) });
    expect(parseWeight('heavy', 'metric')).toMatchObject({ ok: false });
    expect(parseWeight('900', 'imperial')).toMatchObject({ ok: false, error: expect.stringMatching(/44–882 lb/) });
  });

  it('puts the ruler around where you are, in 0.1 kg or 0.2 lb steps', () => {
    expect(weightRuler(82.4, 'metric')).toMatchObject({ min: 62, max: 103, step: 0.1, label: 'kg' });
    expect(weightRuler(181.6, 'imperial')).toMatchObject({ min: 141, max: 222, step: 0.2, label: 'lb' });
    // Never below what the database accepts.
    expect(weightRuler(30, 'metric').min).toBe(20);
  });
});

describe('weigh-in history', () => {
  const series = trendSeries([
    { date: '2026-09-01', kg: 85 },
    { date: '2026-09-20', kg: 84 },
    { date: '2026-10-01', kg: 83.2 },
    { date: '2026-10-07', kg: 82.6 },
  ]);

  it('keeps one weigh-in per day, oldest first', () => {
    const list = withWeighIn([{ date: '2026-10-07', kg: 82.6 }, { date: '2026-10-01', kg: 83 }], { date: '2026-10-07', kg: 82.1 });
    expect(list).toEqual([
      { date: '2026-10-01', kg: 83 },
      { date: '2026-10-07', kg: 82.1 },
    ]);
  });

  it('shows the chosen range, with the trend worked out on everything', () => {
    const month = pointsInRange(series, '1m', new Date(2026, 9, 8));
    expect(month.map((p) => p.date)).toEqual(['2026-09-20', '2026-10-01', '2026-10-07']);
    // The trend at the start of the range still remembers September 1st.
    expect(month[0].trend).toBeGreaterThan(84);
    expect(pointsInRange(series, 'all', new Date(2026, 9, 8))).toHaveLength(4);
  });

  it('says how long ago in words', () => {
    expect(agoText('2026-10-08', '2026-10-08')).toBe('today');
    expect(agoText('2026-10-07', '2026-10-08')).toBe('yesterday');
    expect(agoText('2026-10-03', '2026-10-08')).toBe('5 days ago');
    expect(agoText('2026-09-10', '2026-10-08')).toBe('4 weeks ago');
  });
});

describe('goal projection', () => {
  const today = new Date(2026, 9, 8);

  it('uses your real pace when the trend is heading for the goal', () => {
    const p = goalProjection({ trendKg: 82, goalKg: 78, weeklyRateKg: -0.5, planKgPerWeek: 0.25, today });
    expect(p).toMatchObject({ kind: 'date', basis: 'trend', kgPerWeek: 0.5 });
    expect(p.kind === 'date' && p.date.toDateString()).toBe(new Date(2026, 11, 3).toDateString());
  });

  it('falls back to the planned pace without a week of data', () => {
    expect(goalProjection({ trendKg: 82, goalKg: 78, weeklyRateKg: null, planKgPerWeek: 0.5, today })).toMatchObject({ kind: 'date', basis: 'plan' });
  });

  it('says so when the trend is moving away, or the goal is reached', () => {
    expect(goalProjection({ trendKg: 82, goalKg: 78, weeklyRateKg: 0.3, planKgPerWeek: 0.5, today })).toEqual({ kind: 'away' });
    expect(goalProjection({ trendKg: 78.1, goalKg: 78, weeklyRateKg: -0.3, planKgPerWeek: 0.5, today })).toEqual({ kind: 'reached' });
    expect(goalProjection({ trendKg: 82, goalKg: null, weeklyRateKg: -0.3, planKgPerWeek: 0.5, today })).toEqual({ kind: 'none' });
  });

  it('knows which way is good for each goal', () => {
    expect(goodDirection('lose')).toBe('down');
    expect(goodDirection('recomp')).toBe('down');
    expect(goodDirection('gain')).toBe('up');
    expect(goodDirection('maintain')).toBeNull();
  });
});

describe('chart maths', () => {
  it('picks round tick values', () => {
    expect(niceTicks(80.4, 84.9)).toEqual([81, 82, 83, 84]);
    expect(niceTicks(176, 190)).toEqual([180, 185, 190]);
    expect(niceTicks(82.1, 82.6)).toEqual([82.2, 82.4, 82.6]);
  });

  it('includes a goal only when it’s close enough not to flatten the line', () => {
    expect(valueDomain([82, 83, 84], 81, 1).includesReference).toBe(true);
    const far = valueDomain([82, 83, 84], 60, 1);
    expect(far.includesReference).toBe(false);
    expect(far.min).toBeGreaterThan(80);
  });

  it('gives a flat week some height instead of a hairline', () => {
    const d = valueDomain([82, 82, 82], null, 1);
    expect(d.max - d.min).toBeGreaterThanOrEqual(1);
  });

  it('maps values to pixels and finds the nearest day under your finger', () => {
    const y = scale(80, 84, 200, 0);
    expect(y(80)).toBe(200);
    expect(y(82)).toBe(100);
    expect(nearestIndex([0, 10, 20, 30], 14)).toBe(1);
    expect(nearestIndex([0, 10, 20, 30], 16)).toBe(2);
    expect(nearestIndex([0, 10, 20, 30], 99)).toBe(3);
    expect(linePath([{ x: 0, y: 1 }, { x: 10, y: 2 }])).toBe('M0.0 1.0 L10.0 2.0');
  });
});

describe('weigh-in nudge', () => {
  const base: InsightInput = {
    isToday: true,
    hour: 7,
    budget: 2000,
    eatenKcal: 0,
    foodEntries: 0,
    protein: { eaten: 0, target: 150 },
    streak: 3,
    closedToday: false,
    goal: 'lose',
    trendKg: 82,
    goalWeightKg: 78,
    milestoneKg: 80,
    weight: (kg) => `${kg} kg`,
  };

  it('asks for a weigh-in on mornings you haven’t weighed in', () => {
    expect(buildInsights({ ...base, weighedToday: false })[0].key).toBe('weigh');
    expect(buildInsights({ ...base, weighedToday: true }).some((i) => i.key === 'weigh')).toBe(false);
    expect(buildInsights({ ...base, weighedToday: false, hour: 15 }).some((i) => i.key === 'weigh')).toBe(false);
  });
});
