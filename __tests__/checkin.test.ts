import { budgetOn, checkinWeek, consistencyText, isCheckinDue, paceText, previousCheckin, reviewDates, reviewWeek, type Checkin } from '@/features/checkin/logic';
import { addDays, toISODate } from '@/lib/dates';
import { confidenceText, countsAsLogged, daysToGoal, estimateExpenditure, suggestBudget, type DayIntake } from '@/lib/expenditure';
import type { WeighIn } from '@/lib/trend';

const END = new Date(2026, 9, 11); // Sunday Oct 11
const iso = (offset: number) => toISODate(addDays(END, offset));

/** `n` days ending on END, eating `kcal` a day, and daily weigh-ins losing `kgPerDay`. */
function history(n: number, kcal: number, startKg: number, kgPerDay: number) {
  const days: DayIntake[] = [];
  const weighIns: WeighIn[] = [];
  for (let i = n - 1; i >= 0; i--) {
    days.push({ date: iso(-i), kcal, entries: 4, closed: false });
    weighIns.push({ date: iso(-i), kg: startKg - kgPerDay * (n - 1 - i) });
  }
  return { days, weighIns };
}

describe('expenditure', () => {
  it('works out what you burn from intake and trend, once there’s enough data', () => {
    // 6 weeks eating 2,000 while losing 0.5 kg a week (≈ 550 kcal/day deficit) → about 2,550.
    const { days, weighIns } = history(42, 2000, 85, 0.5 / 7);
    const r = estimateExpenditure({ days, weighIns, end: iso(0), previous: 2550, formula: 2500 });
    expect(r.loggedDays).toBe(21);
    expect(r.fromData).not.toBeNull();
    expect(r.fromData!).toBeGreaterThan(2450);
    expect(r.fromData!).toBeLessThan(2650);
    expect(r.dataWeight).toBeCloseTo(0.8);
    expect(r.kcal).toBeGreaterThan(2450);
  });

  it('starts from the formula and moves at most 300 kcal a week', () => {
    // Really burning ~2,550 but the formula said 2,100.
    const { days, weighIns } = history(42, 2000, 85, 0.5 / 7);
    const r = estimateExpenditure({ days, weighIns, end: iso(0), previous: 2100, formula: 2100 });
    expect(r.kcal).toBe(2400);
  });

  it('stays on the previous estimate without a week of logs and a few weigh-ins', () => {
    const { days, weighIns } = history(5, 1800, 85, 0.1);
    const r = estimateExpenditure({ days, weighIns, end: iso(0), previous: 2400, formula: 2400 });
    expect(r.fromData).toBeNull();
    expect(r.dataWeight).toBe(0);
    expect(r.kcal).toBe(2400);
    expect(confidenceText(r)).toBe('Formula estimate · learns after 2 more logged days');
  });

  it('ignores half-logged days, but trusts a finished light day', () => {
    expect(countsAsLogged({ date: 'x', kcal: 500, entries: 1, closed: false }, 2400)).toBe(false);
    expect(countsAsLogged({ date: 'x', kcal: 500, entries: 1, closed: true }, 2400)).toBe(true);
    expect(countsAsLogged({ date: 'x', kcal: 0, entries: 0, closed: true }, 2400)).toBe(false);
  });

  it('suggests a budget for your goal, never under the safe minimum', () => {
    expect(suggestBudget({ expenditure: 2600, goal: 'lose', kgPerWeek: 0.5, sex: 'male' })).toBe(2050);
    expect(suggestBudget({ expenditure: 2600, goal: 'recomp', kgPerWeek: 0, sex: 'male' })).toBe(2340);
    expect(suggestBudget({ expenditure: 2600, goal: 'maintain', kgPerWeek: 0, sex: 'male' })).toBe(2600);
    expect(suggestBudget({ expenditure: 1600, goal: 'lose', kgPerWeek: 1, sex: 'female' })).toBe(1200);
  });

  it('says how long until the goal on a budget', () => {
    // 550 kcal/day deficit → 1 kg every 14 days; 4 kg to go → 56 days.
    expect(daysToGoal({ trendKg: 82, goalKg: 78, expenditure: 2600, budget: 2050 })).toBe(56);
    expect(daysToGoal({ trendKg: 82, goalKg: 78, expenditure: 2600, budget: 2700 })).toBeNull();
    expect(daysToGoal({ trendKg: 78.1, goalKg: 78, expenditure: 2600, budget: 2050 })).toBe(0);
  });
});

describe('weekly check-in', () => {
  const thursday = new Date(2026, 9, 8);
  const monday = new Date(2026, 9, 12);

  it('looks back on the 7 days ending yesterday, keyed by this week’s Monday', () => {
    expect(checkinWeek(thursday)).toBe('2026-10-05');
    expect(checkinWeek(monday)).toBe('2026-10-12');
    expect(reviewDates(monday)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']);
  });

  it('is due from Monday until done, but not in your first week', () => {
    const joined = '2026-10-06T09:00:00Z';
    expect(isCheckinDue({ today: thursday, onboardedAt: joined, checkins: [] })).toBe(false);
    expect(isCheckinDue({ today: monday, onboardedAt: joined, checkins: [] })).toBe(true);
    expect(isCheckinDue({ today: monday, onboardedAt: joined, checkins: [{ week_start: '2026-10-12' }] })).toBe(false);
  });

  it('starts from the last check-in before this week', () => {
    const c = (week_start: string, expenditure_kcal: number): Checkin => ({
      week_start,
      expenditure_kcal,
      days_logged: 7,
      avg_intake_kcal: 2000,
      trend_change_kg: -0.4,
      old_target: 2000,
      suggested_target: 2050,
      new_target: 2050,
      decision: 'accepted',
    });
    const list = [c('2026-09-28', 2500), c('2026-10-05', 2560), c('2026-10-12', 2600)];
    expect(previousCheckin(list, '2026-10-12')?.expenditure_kcal).toBe(2560);
    expect(previousCheckin(list, '2026-09-28')).toBeNull();
  });

  it('judges each day against the budget it had', () => {
    const c = (week_start: string, created_at: string, old_target: number, new_target: number): Checkin => ({
      week_start,
      created_at,
      old_target,
      new_target,
      suggested_target: new_target,
      days_logged: 7,
      avg_intake_kcal: null,
      trend_change_kg: null,
      expenditure_kcal: null,
      decision: 'accepted',
    });
    // 1,950 at the start; 1,900 from Monday Sep 28; 1,850 from Thursday Oct 8 (checked in late that week).
    const list = [c('2026-09-28', '2026-09-28T08:00:00', 1950, 1900), c('2026-10-05', '2026-10-08T19:00:00', 1900, 1850)];
    expect(budgetOn('2026-09-20', list, 1850)).toBe(1950);
    expect(budgetOn('2026-10-06', list, 1850)).toBe(1900);
    expect(budgetOn('2026-10-08', list, 1850)).toBe(1850);
    expect(budgetOn('2026-10-20', list, 1880)).toBe(1880);
    expect(budgetOn('2026-10-20', [], 1950)).toBe(1950);
  });

  it('counts the logged days of the week', () => {
    const dates = reviewDates(monday);
    const days: DayIntake[] = [
      { date: dates[0], kcal: 2100, entries: 5, closed: false },
      { date: dates[1], kcal: 1900, entries: 4, closed: true },
      { date: dates[2], kcal: 300, entries: 1, closed: false },
    ];
    const r = reviewWeek(dates, days, 2400);
    expect(r.daysLogged).toBe(2);
    expect(r.avgIntake).toBe(2000);
    expect(r.logged.map((d) => d.logged)).toEqual([true, true, false, false, false, false, false]);
    expect(consistencyText(7)).toMatch(/perfect/);
    expect(consistencyText(2)).toMatch(/missing/);
  });

  it('compares the week with your plan, kindly', () => {
    const weight = (kg: number) => `${kg} kg`;
    expect(paceText({ goal: 'lose', changeKg: -0.5, planKgPerWeek: 0.5, weight })).toBe('Right on your 0.5 kg/week plan.');
    expect(paceText({ goal: 'lose', changeKg: -0.2, planKgPerWeek: 0.5, weight })).toMatch(/slower/);
    expect(paceText({ goal: 'lose', changeKg: 0.3, planKgPerWeek: 0.5, weight })).toMatch(/other way/);
    expect(paceText({ goal: 'lose', changeKg: null, planKgPerWeek: 0.5, weight })).toMatch(/Weigh in/);
  });
});
