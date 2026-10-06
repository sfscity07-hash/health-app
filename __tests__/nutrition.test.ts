import {
  bmr,
  calorieTarget,
  dailyDelta,
  macroTargets,
  maintenanceCalories,
  projectedGoalDate,
  weeksToGoal,
} from '@/lib/nutrition';

// Hand-checked: 10×80 + 6.25×180 − 5×30 + 5 = 1780
const man = { sex: 'male' as const, age: 30, heightCm: 180, weightKg: 80 };
// 10×60 + 6.25×165 − 5×25 − 161 = 1345.25
const woman = { sex: 'female' as const, age: 25, heightCm: 165, weightKg: 60 };

describe('bmr (Mifflin-St Jeor)', () => {
  it('matches the published formula', () => {
    expect(bmr(man)).toBe(1780);
    expect(bmr(woman)).toBeCloseTo(1345.25, 2);
  });
});

describe('maintenance and goal adjustment', () => {
  it('multiplies resting energy by the activity factor', () => {
    expect(maintenanceCalories({ ...man, activity: 'moderate' })).toBeCloseTo(2759, 0);
    expect(maintenanceCalories({ ...woman, activity: 'sedentary' })).toBeCloseTo(1614.3, 1);
  });

  it('converts a weekly rate into a daily deficit or surplus', () => {
    expect(dailyDelta('lose', 0.5)).toBe(-550);
    expect(dailyDelta('gain', 0.25)).toBe(275);
    expect(dailyDelta('maintain', 0.5)).toBe(0);
  });
});

describe('calorieTarget', () => {
  it('subtracts the deficit and rounds to 10 kcal', () => {
    // 2759 − 550 = 2209 → 2210
    expect(calorieTarget({ ...man, activity: 'moderate', goal: 'lose', kgPerWeek: 0.5 })).toEqual({
      calories: 2210,
      maintenance: 2759,
      delta: -550,
      raisedToMinimum: false,
    });
  });

  it('never suggests less than the safe minimum', () => {
    // 1614 − 1100 = 514 → raised to 1200
    const t = calorieTarget({ ...woman, activity: 'sedentary', goal: 'lose', kgPerWeek: 1 });
    expect(t.calories).toBe(1200);
    expect(t.raisedToMinimum).toBe(true);
  });

  it('adds a surplus when gaining', () => {
    expect(calorieTarget({ ...man, activity: 'moderate', goal: 'gain', kgPerWeek: 0.25 }).calories).toBe(3030);
  });
});

describe('macroTargets', () => {
  it('sets protein by body weight, fat at 30%, and carbs to fill the rest', () => {
    // protein 1.8×80 = 144 g; fat 0.3×2210/9 = 73.7 → 74 g; carbs (2210 − 576 − 666)/4 = 242 g
    expect(macroTargets(2210, 80)).toEqual({ protein_g: 144, fat_g: 74, carbs_g: 242 });
  });

  it('caps protein at 35% of calories', () => {
    // 1.8×150 = 270 g, but 35% of 1500 kcal is 131 g
    expect(macroTargets(1500, 150).protein_g).toBe(131);
  });

  it('adds up to roughly the calorie budget', () => {
    const m = macroTargets(1950, 83);
    const kcal = m.protein_g * 4 + m.carbs_g * 4 + m.fat_g * 9;
    expect(Math.abs(kcal - 1950)).toBeLessThan(10);
  });
});

describe('goal timing', () => {
  it('works out weeks and a projected date', () => {
    expect(weeksToGoal(87.5, 78, 0.5)).toBe(19);
    expect(projectedGoalDate(new Date(2026, 9, 6), 87.5, 78, 0.5)).toEqual(new Date(2027, 1, 16)); // 133 days after Oct 6
    expect(weeksToGoal(80, 80, 0.5)).toBeNull();
    expect(projectedGoalDate(new Date(2026, 9, 6), 80, 75, 0)).toBeNull();
  });
});
