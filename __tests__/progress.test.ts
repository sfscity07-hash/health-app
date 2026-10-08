import type { DaySummary } from '@/features/dashboard/api';
import { emptyDay } from '@/features/dashboard/api';
import { badges, calorieWeek, daysTo, heatmap, isNear, journey, macroSplit, newlyEarned, positionOf, proteinDays, type BadgeInput } from '@/features/progress/logic';

jest.mock('@/lib/supabase', () => ({ supabase: null, requireSupabase: jest.fn() }));

const day = (date: string, over: Partial<DaySummary> = {}): DaySummary => ({ ...emptyDay(date), food_entries: 3, ...over });

describe('goal journey', () => {
  it('measures the way from start to goal, with 2.5 kg milestones in the order you pass them', () => {
    const j = journey(86.2, 83.1, 78)!;
    expect(j.doneKg).toBeCloseTo(3.1);
    expect(j.fraction).toBeCloseTo(3.1 / 8.2);
    expect(j.milestones).toEqual([85, 82.5, 80]);
    expect(j.next).toBe(82.5);
    expect(positionOf(j, 78)).toBe(1);
  });

  it('works for gaining, and stops at the goal', () => {
    const j = journey(62, 63.4, 66)!;
    expect(j.milestones).toEqual([62.5, 65]);
    expect(j.next).toBe(65);
    expect(journey(86, 77.8, 78)!.next).toBeNull();
    expect(journey(78.2, 78, 78)).toBeNull();
  });

  it('never counts going the wrong way as progress', () => {
    expect(journey(80, 81, 75)!.doneKg).toBe(0);
  });

  it('says how many days to a milestone at the current pace', () => {
    expect(daysTo(83.1, 82.5, -0.4)).toBe(11);
    expect(daysTo(83.1, 82.5, 0.2)).toBeNull();
    expect(daysTo(83.1, 82.5, null)).toBeNull();
  });
});

describe('calories and macros', () => {
  it('compares each of the last 7 days with the budget it had', () => {
    const summaries = { '2026-10-02': day('2026-10-02', { kcal_in: 2150 }), '2026-10-08': day('2026-10-08', { kcal_in: 900 }) };
    const week = calorieWeek('2026-10-08', summaries, (d) => (d < '2026-10-05' ? 2000 : 1850));
    expect(week).toHaveLength(7);
    expect(week[0]).toMatchObject({ date: '2026-10-02', kcal: 2150, budget: 2000, over: true });
    expect(week[6]).toMatchObject({ isToday: true, budget: 1850, over: false });
    expect(week[1].logged).toBe(false);
  });

  it('averages the macro split over logged days', () => {
    const s = macroSplit([day('a', { protein_g: 150, carbs_g: 200, fat_g: 60 }), day('b', { protein_g: 130, carbs_g: 180, fat_g: 70 }), day('c', { food_entries: 0 })])!;
    expect(s.days).toBe(2);
    expect(s.protein_g).toBe(140);
    expect(s.share.protein + s.share.carbs + s.share.fat).toBeCloseTo(1);
    expect(macroSplit([day('x', { food_entries: 0 })])).toBeNull();
    expect(proteinDays([day('a', { protein_g: 153 }), day('b', { protein_g: 140 }), day('c', { protein_g: 200, food_entries: 0 })], 160)).toBe(1);
  });
});

describe('consistency', () => {
  it('lays out 13 weeks, Monday first, with finished over logged and future days marked', () => {
    const summaries = { '2026-10-06': day('2026-10-06'), '2026-10-07': day('2026-10-07') };
    const h = heatmap('2026-10-08', summaries, new Set(['2026-10-07']));
    expect(h.columns).toHaveLength(13);
    const now = h.columns[12];
    expect(now.monday).toBe('2026-10-05');
    expect(now.days.map((d) => d.level)).toEqual(['none', 'logged', 'finished', 'none', 'future', 'future', 'future']);
    expect(h.logged).toBe(2);
    expect(h.finished).toBe(1);
  });
});

describe('milestones', () => {
  const base: BadgeInput = {
    goal: 'lose',
    units: 'metric',
    loggedThisWeek: 4,
    perfectWeekBefore: false,
    streak: { current: 25, best: 25 },
    proteinDays: 6,
    movedKg: 3.1,
    journeyFraction: 0.38,
    checkins: 1,
  };

  it('shows progress before you earn them, and glows when close', () => {
    const list = badges(base);
    const by = (k: string) => list.find((b) => b.key === k)!;
    expect(by('streak-7').done).toBe(true);
    expect(by('streak-30')).toMatchObject({ done: false, count: '25 / 30' });
    expect(isNear(by('streak-30'))).toBe(true);
    expect(isNear(by('protein-week'))).toBe(true);
    expect(by('first-step')).toMatchObject({ title: 'First 5 kg', count: '3.1 / 5' });
    expect(by('halfway').count).toBe('38 / 50%');
    expect(isNear(by('perfect-week'))).toBe(false);
  });

  it('keeps streak badges once earned, and uses your units', () => {
    const list = badges({ ...base, streak: { current: 2, best: 31 }, units: 'imperial' });
    expect(list.find((b) => b.key === 'streak-30')!.done).toBe(true);
    expect(list.find((b) => b.key === 'first-step')!.title).toBe('First 10 lb');
  });

  it('skips weight badges when maintaining', () => {
    expect(badges({ ...base, goal: 'maintain', journeyFraction: null }).map((b) => b.key)).toEqual(['perfect-week', 'streak-7', 'streak-30', 'protein-week', 'checkins']);
  });

  it('celebrates each new one once, and nothing on the first visit', () => {
    expect(newlyEarned(['streak-7', 'mile-85'], null)).toEqual([]);
    expect(newlyEarned(['streak-7', 'mile-85'], ['streak-7'])).toEqual(['mile-85']);
  });
});
