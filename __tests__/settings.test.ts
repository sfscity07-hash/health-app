import { checkinRows, csvCell, dailyRows, everythingRows, toCsv } from '@/features/export/csv';
import { fits, goalWeightProblem, gramsFor, macrosFor, percentOf, stepMacro } from '@/features/goals/logic';
import { DEFAULT_REMINDERS, formatTime, planReminders, shiftTime, type DoneToday, type ReminderSettings } from '@/features/reminders/logic';

jest.mock('@/lib/supabase', () => ({ supabase: null, requireSupabase: jest.fn() }));

describe('goals & targets', () => {
  it('lets carbs fill the calories protein and fat leave', () => {
    expect(macrosFor(2000, 160, 65)).toEqual({ protein_g: 160, fat_g: 65, carbs_g: 194 });
    expect(macrosFor(1500, 200, 100).carbs_g).toBe(0);
    expect(fits(2000, 160, 65)).toBe(true);
    expect(fits(1500, 250, 70)).toBe(false);
  });

  it('steps macros by 5 g or by 5% of calories', () => {
    expect(stepMacro(2000, 160, 4, 'grams', 1)).toBe(165);
    expect(percentOf(2000, 150, 4)).toBe(30);
    // 30% → 35% of 2,000 kcal is 175 g of protein.
    expect(stepMacro(2000, 150, 4, 'percent', 1)).toBe(175);
    expect(gramsFor(2000, 30, 9)).toBe(67);
  });

  it('catches a goal weight that points the wrong way', () => {
    expect(goalWeightProblem('lose', 82, 85)).toMatch(/above your trend/);
    expect(goalWeightProblem('gain', 82, 80)).toMatch(/below your trend/);
    expect(goalWeightProblem('lose', 82, 78)).toBeNull();
  });
});

describe('reminders', () => {
  const on: ReminderSettings = {
    weighIn: { on: true, time: '07:30' },
    lunch: { on: true, time: '13:30' },
    finish: { on: true, time: '21:00' },
    checkin: { on: true, time: '09:00' },
  };
  const nothingDone: DoneToday = { weighedIn: false, lunchLogged: false, finished: false, checkedInThisWeek: false };
  // Monday Oct 12, 2026, 08:00.
  const monday8am = new Date(2026, 9, 12, 8, 0);

  it('plans a week ahead, skipping times already past and the check-in except on Mondays', () => {
    const plan = planReminders(on, monday8am, nothingDone);
    const today = plan.filter((p) => p.at.getDate() === 12).map((p) => p.key);
    expect(today).toEqual(['checkin', 'lunch', 'finish']);
    expect(plan.filter((p) => p.key === 'checkin')).toHaveLength(1);
    expect(plan.filter((p) => p.key === 'weighIn')).toHaveLength(6);
    expect(plan[0].url).toBe('/checkin');
  });

  it('leaves out today’s reminder for anything already done', () => {
    const plan = planReminders(on, monday8am, { weighedIn: true, lunchLogged: true, finished: false, checkedInThisWeek: true }, 26);
    const today = plan.filter((p) => p.at.getDate() === 12);
    expect(today.map((p) => p.key)).toEqual(['finish']);
    expect(today[0].body).toMatch(/27 days in a row/);
    // Tomorrow's lunch reminder is still planned.
    expect(plan.some((p) => p.key === 'lunch' && p.at.getDate() === 13)).toBe(true);
  });

  it('plans nothing when every reminder is off', () => {
    expect(planReminders(DEFAULT_REMINDERS, monday8am, nothingDone)).toEqual([]);
  });

  it('shows and moves times', () => {
    expect(formatTime('07:30')).toBe('7:30 am');
    expect(formatTime('13:05')).toBe('1:05 pm');
    expect(formatTime('00:15')).toBe('12:15 am');
    expect(shiftTime('23:50', 15)).toBe('00:05');
    expect(shiftTime('00:00', -15)).toBe('23:45');
  });
});

describe('CSV export', () => {
  it('quotes what needs quoting and defuses spreadsheet formulas', () => {
    expect(csvCell('Ben & Jerry’s')).toBe('Ben & Jerry’s');
    expect(csvCell('Oats, rolled')).toBe('"Oats, rolled"');
    expect(csvCell('6" sub')).toBe('"6"" sub"');
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell(227.444)).toBe('227.44');
    expect(csvCell(null)).toBe('');
    expect(csvCell(true)).toBe('yes');
    expect(toCsv(['a', 'b'], [[1, 'x']])).toBe('﻿a,b\r\n1,x\r\n');
  });

  it('puts everything on one dated list, oldest first', () => {
    const rows = everythingRows({
      food: [{ log_date: '2026-10-08', logged_at: '2026-10-08T12:00:00', meal: 'lunch', name: 'Ramen', quantity: 1, unit: 'serving', kcal: 502 }],
      weight: [{ log_date: '2026-10-08', weight_kg: 82.4 }],
      water: [{ log_date: '2026-10-07', logged_at: '2026-10-07T09:00:00', amount_ml: 250 }],
      exercise: [{ log_date: '2026-10-08', created_at: '2026-10-08T18:00:00', name: 'Running', duration_min: 30, kcal_burned: 416 }],
    });
    expect(rows.map((r) => r[2])).toEqual(['water', 'weight', 'food', 'exercise']);
    expect(rows[2].slice(0, 6)).toEqual(['2026-10-08', '12:00', 'food', 'lunch', 'Ramen', undefined]);
  });

  it('adds the trend and each day’s budget to the daily totals', () => {
    const rows = dailyRows(
      [{ log_date: '2026-10-07', kcal_in: 1900, food_entries: 4, closed: true }],
      [
        { date: '2026-10-07', kg: 82.6 },
        { date: '2026-10-08', kg: 82.2 },
      ],
      (d) => (d < '2026-10-08' ? 1950 : 1850),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(['2026-10-07', 1900, 1950, 0, 0, 0, 0, 4, 0, 0, true, 82.6, 82.6]);
    expect(rows[1][2]).toBe(1850);
    expect(rows[1][12]).toBeCloseTo(82.56);
    expect(checkinRows([{ week_start: '2026-10-12', new_target: 1850 }])[0][0]).toBe('2026-10-12');
  });
});
