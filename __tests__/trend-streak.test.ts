import { daysBetween, toISODate, weekOf } from '@/lib/dates';
import { streaks } from '@/lib/streak';
import { nextMilestone, trendSeries, weeklyRate } from '@/lib/trend';

describe('trendSeries', () => {
  it('starts at the first weigh-in and moves 10% toward each new one', () => {
    const t = trendSeries([
      { date: '2026-10-01', kg: 80 },
      { date: '2026-10-02', kg: 81 },
    ]);
    expect(t[0].trend).toBe(80);
    expect(t[1].trend).toBeCloseTo(80.1, 5);
  });

  it('treats a gap like the missing days were there', () => {
    // 3 days: 1 − 0.9³ = 0.271 of the way
    const t = trendSeries([
      { date: '2026-10-01', kg: 80 },
      { date: '2026-10-04', kg: 81 },
    ]);
    expect(t[1].trend).toBeCloseTo(80.271, 3);
  });

  it('sorts unsorted input', () => {
    const t = trendSeries([
      { date: '2026-10-02', kg: 81 },
      { date: '2026-10-01', kg: 80 },
    ]);
    expect(t.map((p) => p.date)).toEqual(['2026-10-01', '2026-10-02']);
  });

  it('reports a weekly rate once there is a week of data', () => {
    const days = Array.from({ length: 15 }, (_, i) => ({ date: toISODate(new Date(2026, 8, 20 + i)), kg: 85 - 0.1 * i }));
    expect(weeklyRate(trendSeries(days.slice(0, 5)))).toBeNull();
    const rate = weeklyRate(trendSeries(days));
    expect(rate).toBeLessThan(0);
    expect(rate).toBeGreaterThan(-0.7);
  });
});

describe('nextMilestone', () => {
  it('finds the next 2.5 kg mark toward the goal', () => {
    expect(nextMilestone(83.1, 78)).toBe(82.5);
    expect(nextMilestone(82.5, 78)).toBe(80);
    expect(nextMilestone(79, 78)).toBe(78);
    expect(nextMilestone(71, 75)).toBe(72.5);
    expect(nextMilestone(78, 78)).toBeNull();
  });
});

describe('streaks', () => {
  const today = '2026-10-06';

  it('counts back from today when today is finished', () => {
    expect(streaks(['2026-10-04', '2026-10-05', '2026-10-06'], today)).toEqual({ current: 3, best: 3, closedToday: true });
  });

  it('keeps yesterday\'s streak alive until today is finished', () => {
    expect(streaks(['2026-10-04', '2026-10-05'], today)).toEqual({ current: 2, best: 2, closedToday: false });
  });

  it('resets after a missed day and remembers the best run', () => {
    const closed = ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-10-05', '2026-10-06'];
    expect(streaks(closed, today)).toEqual({ current: 2, best: 4, closedToday: true });
    expect(streaks(['2026-10-03'], today).current).toBe(0);
  });
});

describe('dates', () => {
  it('builds a Monday-to-Sunday week', () => {
    const week = weekOf(new Date(2026, 9, 6)).map(toISODate);
    expect(week[0]).toBe('2026-10-05');
    expect(week[6]).toBe('2026-10-11');
    expect(weekOf(new Date(2026, 9, 11)).map(toISODate)[0]).toBe('2026-10-05');
  });

  it('counts days between dates', () => {
    expect(daysBetween('2026-09-30', '2026-10-06')).toBe(6);
  });
});
