import type { Checkin } from '@/features/checkin/logic';
import type { DaySummary } from '@/features/dashboard/api';
import { balanceText, balanceWord, deficitDay, deficitTotal, deficitWeek, expenditureOn, KCAL_PER_KG } from '@/features/deficit/logic';

const summary = (log_date: string, kcal_in: number, over: Partial<DaySummary> = {}): DaySummary => ({
  log_date,
  kcal_in,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  fiber_g: 0,
  food_entries: kcal_in > 0 ? 3 : 0,
  kcal_out: 0,
  water_ml: 0,
  drink_ml: 0,
  closed: false,
  ...over,
});

const checkin = (week_start: string, created_at: string, expenditure_kcal: number | null): Checkin => ({
  week_start,
  created_at,
  days_logged: 7,
  avg_intake_kcal: 2000,
  trend_change_kg: -0.4,
  expenditure_kcal,
  old_target: 2000,
  suggested_target: 1950,
  new_target: 1950,
  decision: 'accepted',
});

describe('a day’s deficit', () => {
  it('is what you burned minus what you ate', () => {
    const d = deficitDay({ date: '2026-10-12', today: '2026-10-13', summary: summary('2026-10-12', 2160), expenditure: 2800, budget: 1950, addback: false });
    expect(d).toMatchObject({ burn: 2800, eaten: 2160, deficit: 640, planned: 850, partial: false, isToday: false });
  });

  it('turns into a surplus when you eat more than you burn', () => {
    const d = deficitDay({ date: '2026-10-12', today: '2026-10-13', summary: summary('2026-10-12', 3100), expenditure: 2800, budget: 1950, addback: false });
    expect(d.deficit).toBe(-300);
    expect(balanceWord(d.deficit!)).toBe('Surplus');
  });

  it('is "so far" today until you finish the day', () => {
    const today = deficitDay({ date: '2026-10-13', today: '2026-10-13', summary: summary('2026-10-13', 700), expenditure: 2800, budget: 1950, addback: false });
    expect(today).toMatchObject({ deficit: 2100, partial: true });
    const finished = deficitDay({ date: '2026-10-13', today: '2026-10-13', summary: summary('2026-10-13', 1900), expenditure: 2800, budget: 1950, addback: false, closed: true });
    expect(finished.partial).toBe(false);
  });

  it('has no number on a day with nothing logged', () => {
    const d = deficitDay({ date: '2026-10-10', today: '2026-10-13', summary: undefined, expenditure: 2800, budget: 1950, addback: false });
    expect(d.deficit).toBeNull();
    expect(d.planned).toBe(850);
  });

  it('counts exercise in what you burned only when you add it to your budget', () => {
    const s = summary('2026-10-12', 2400, { kcal_out: 300 });
    expect(deficitDay({ date: '2026-10-12', today: '2026-10-13', summary: s, expenditure: 2800, budget: 1950, addback: false }).deficit).toBe(400);
    const withExercise = deficitDay({ date: '2026-10-12', today: '2026-10-13', summary: s, expenditure: 2800, budget: 1950, addback: true });
    expect(withExercise.deficit).toBe(700);
    // Eating your budget plus the exercise still leaves the same planned deficit.
    expect(withExercise.planned).toBe(850);
  });
});

describe('which expenditure applies to a day', () => {
  const checkins = [checkin('2026-09-28', '2026-09-28T07:00:00Z', 2900), checkin('2026-10-05', '2026-10-05T07:00:00Z', 2750)];

  it('uses the check-in that reviewed the day', () => {
    expect(expenditureOn('2026-09-20', checkins, 2700)).toBe(2900);
    expect(expenditureOn('2026-10-01', checkins, 2700)).toBe(2750);
  });

  it('uses today’s estimate since the last check-in', () => {
    expect(expenditureOn('2026-10-08', checkins, 2700)).toBe(2700);
  });

  it('skips check-ins without an estimate', () => {
    expect(expenditureOn('2026-10-01', [checkin('2026-10-05', '2026-10-05T07:00:00Z', null)], 2700)).toBe(2700);
  });
});

describe('the week', () => {
  const summaries: Record<string, DaySummary> = {
    '2026-10-07': summary('2026-10-07', 1900),
    '2026-10-08': summary('2026-10-08', 3100),
    '2026-10-10': summary('2026-10-10', 2000),
    '2026-10-11': summary('2026-10-11', 2200),
    '2026-10-12': summary('2026-10-12', 1800),
    '2026-10-13': summary('2026-10-13', 600),
  };
  const week = deficitWeek({ today: '2026-10-13', summaries, expenditureFor: () => 2800, budgetFor: () => 1950, addback: false });

  it('runs seven days, ending today', () => {
    expect(week.map((d) => d.date)).toEqual(['2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13']);
    expect(week.map((d) => d.deficit)).toEqual([900, -300, null, 800, 600, 1000, 2200]);
  });

  it('adds up finished logged days only, and turns it into kg of fat', () => {
    const t = deficitTotal(week)!;
    expect(t.days).toBe(5);
    expect(t.total).toBe(900 - 300 + 800 + 600 + 1000);
    expect(t.average).toBe(600);
    expect(t.kg).toBeCloseTo(3000 / KCAL_PER_KG);
  });

  it('has no total before a full day is logged', () => {
    expect(deficitTotal(week.slice(6))).toBeNull();
  });
});

describe('wording', () => {
  it('says deficit, surplus or about even', () => {
    expect(balanceText(640)).toBe('640 kcal deficit');
    expect(balanceText(-1200)).toBe('1,200 kcal surplus');
    expect(balanceText(12)).toBe('about even');
  });
});
