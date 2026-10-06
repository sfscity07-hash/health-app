import { buildPlan, emptyDraft, heightCmOf, parseNumber, stepError, stepsFor, weightKgOf, type OnboardingDraft } from '@/features/onboarding/draft';
import { ageOn, birthDateForAge, toISODate } from '@/lib/dates';

const complete: OnboardingDraft = {
  ...emptyDraft,
  goal: 'lose',
  sex: 'male',
  age: '30',
  heightCm: '180',
  weight: '80',
  activity: 'moderate',
  goalWeight: '75',
  kgPerWeek: 0.5,
};

describe('parsing', () => {
  it('accepts dots and commas and rejects junk', () => {
    expect(parseNumber('82.5')).toBe(82.5);
    expect(parseNumber(' 82,5 ')).toBe(82.5);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('8o')).toBeNull();
    expect(parseNumber('-5')).toBeNull();
  });

  it('reads imperial height and weight', () => {
    const d = { ...emptyDraft, units: 'imperial' as const, heightFt: '5', heightIn: '10', weight: '176' };
    expect(heightCmOf(d)).toBeCloseTo(177.8, 1);
    expect(weightKgOf(d)).toBeCloseTo(79.83, 2);
    expect(heightCmOf({ ...d, heightIn: '' })).toBeCloseTo(152.4, 1);
    expect(heightCmOf({ ...d, heightIn: '12' })).toBeNull();
  });
});

describe('steps and validation', () => {
  it('skips the target step when maintaining or recomping', () => {
    expect(stepsFor('maintain')).not.toContain('target');
    expect(stepsFor('recomp')).not.toContain('target');
    expect(stepsFor('lose')).toContain('target');
  });

  it('explains what is missing on each step', () => {
    expect(stepError('goal', emptyDraft)).toMatch(/goal/);
    expect(stepError('about', { ...complete, age: '12' })).toMatch(/16 to 99/);
    expect(stepError('body', { ...complete, heightCm: '18' })).toMatch(/height looks off/);
    expect(stepError('target', { ...complete, goalWeight: '85' })).toMatch(/below your current weight/);
    expect(stepError('target', { ...complete, goal: 'gain', goalWeight: '75' })).toMatch(/above your current weight/);
    expect(stepError('target', { ...complete, kgPerWeek: null })).toMatch(/pace/);
    for (const s of stepsFor('lose')) expect(stepError(s, complete)).toBeNull();
  });
});

describe('buildPlan', () => {
  it('returns null until every step is complete', () => {
    expect(buildPlan({ ...complete, activity: null }, new Date(2026, 9, 6))).toBeNull();
  });

  it('produces targets and a goal date', () => {
    const plan = buildPlan(complete, new Date(2026, 9, 6));
    expect(plan?.target.calories).toBe(2210);
    expect(plan?.macros).toEqual({ protein_g: 144, fat_g: 74, carbs_g: 242 });
    // 5 kg at 0.5 kg/week = 10 weeks = 70 days after Oct 6
    expect(plan?.goalDate).toEqual(new Date(2026, 11, 15));
  });

  it('has no pace or goal date when maintaining', () => {
    const plan = buildPlan({ ...complete, goal: 'maintain', goalWeight: '', kgPerWeek: null }, new Date(2026, 9, 6));
    expect(plan?.kgPerWeek).toBe(0);
    expect(plan?.goalDate).toBeNull();
    expect(plan?.target.calories).toBe(2760);
  });
});

describe('recomp plan', () => {
  it('has no pace or goal weight and uses recomp protein', () => {
    const plan = buildPlan({ ...complete, goal: 'recomp', goalWeight: '', kgPerWeek: null }, new Date(2026, 9, 6));
    expect(plan?.kgPerWeek).toBe(0);
    expect(plan?.goalWeightKg).toBeNull();
    expect(plan?.target.calories).toBe(2480);
    expect(plan?.macros.protein_g).toBe(176);
  });
});

describe('dates', () => {
  it('uses the local calendar date', () => {
    expect(toISODate(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('round-trips an age through a birth date', () => {
    const today = new Date(2026, 9, 6);
    expect(ageOn(birthDateForAge(30, today), today)).toBe(30);
    expect(ageOn(new Date(1996, 9, 7), today)).toBe(29);
  });
});
