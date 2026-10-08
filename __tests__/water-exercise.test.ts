import {
  activeKcal,
  activityMatches,
  describeDuration,
  groupActivities,
  intensity,
  parseKcal,
  parseMinutes,
  recentWorkouts,
  workoutSummary,
  type Activity,
  type Workout,
} from '@/features/exercise/logic';
import { formatDrink, formatLeft, formatVolume, glassCount, parseDrink, reachesGoal, stepGoal, totalValue, waterPresets } from '@/features/water/logic';

describe('water', () => {
  it('offers a glass first, in your units', () => {
    expect(waterPresets('metric').map((p) => p.ml)).toEqual([250, 500, 750]);
    expect(waterPresets('imperial').map((p) => formatDrink(p.ml, 'imperial'))).toEqual(['8 fl oz', '16.9 fl oz', '24 fl oz']);
  });

  it('shows amounts the way you’d say them', () => {
    expect(formatDrink(330, 'metric')).toBe('330 ml');
    expect(formatLeft(750, 'metric')).toBe('750 ml');
    expect(formatLeft(1170, 'metric')).toBe('1.17 L');
    expect(totalValue(1250, 'metric')).toBe('1.25');
    expect(formatVolume(2500, 'metric')).toBe('2.5 L');
    expect(formatVolume(1750, 'metric')).toBe('1.75 L');
    expect(formatVolume(1100, 'metric')).toBe('1.1 L');
    expect(totalValue(1250, 'imperial')).toBe('42');
    expect(formatVolume(2500, 'imperial')).toBe('85 fl oz');
  });

  it('steps the goal by a glass, on round numbers, within limits', () => {
    expect(stepGoal(2500, 1, 'metric')).toBe(2750);
    expect(stepGoal(2500, -1, 'metric')).toBe(2250);
    expect(stepGoal(500, -1, 'metric')).toBe(500);
    expect(stepGoal(6000, 1, 'metric')).toBe(6000);
    // 2.5 L is about 84.5 fl oz; one step up lands on 96 fl oz (12 glasses of 8).
    expect(formatVolume(stepGoal(2500, 1, 'imperial'), 'imperial')).toBe('96 fl oz');
  });

  it('reads a typed amount', () => {
    expect(parseDrink('330', 'metric')).toEqual({ ok: true, ml: 330 });
    expect(parseDrink('12', 'imperial')).toEqual({ ok: true, ml: 355 });
    expect(parseDrink('0', 'metric')).toMatchObject({ ok: false });
    expect(parseDrink('lots', 'metric')).toMatchObject({ ok: false });
    expect(parseDrink('9000', 'metric')).toMatchObject({ ok: false, error: expect.stringMatching(/5.0 L/) });
  });

  it('knows when a drink hits the goal, once', () => {
    expect(reachesGoal(2250, 250, 2500)).toBe(true);
    expect(reachesGoal(2500, 250, 2500)).toBe(false);
    expect(reachesGoal(1000, 250, 2500)).toBe(false);
    expect(glassCount(2500, 250)).toBe(10);
    expect(glassCount(2500, 237)).toBe(11);
  });
});

describe('exercise', () => {
  const run: Activity = { id: 6, name: 'Running (10 km/h)', category: 'Running', met: 9.8 };
  const list: Activity[] = [
    { id: 1, name: 'Walking, brisk (6.5 km/h)', category: 'Walking', met: 5 },
    run,
    { id: 10, name: 'Stationary bike, moderate', category: 'Cycling', met: 6.8 },
    { id: 13, name: 'Weight training, general', category: 'Strength', met: 3.5 },
  ];

  it('works out active calories: what the workout burns on top of resting', () => {
    // (9.8 − 1) × 80 kg × 0.5 h = 352
    expect(activeKcal(run.met, 80, 30)).toBe(352);
    expect(activeKcal(3.5, 70, 60)).toBe(175);
    expect(activeKcal(1, 70, 60)).toBe(0);
  });

  it('says durations and intensity in words', () => {
    expect(describeDuration(45)).toBe('45 min');
    expect(describeDuration(60)).toBe('1 h');
    expect(describeDuration(95)).toBe('1 h 35 min');
    expect(intensity(2.5)).toBe('Light');
    expect(intensity(5)).toBe('Moderate');
    expect(intensity(8)).toBe('Hard');
    expect(intensity(11.8)).toBe('Very hard');
    expect(workoutSummary([{ kcal_burned: 300, duration_min: 45 }, { kcal_burned: 200, duration_min: 30 }])).toBe('2 workouts · 1 h 15 min');
    expect(workoutSummary([{ kcal_burned: 300, duration_min: null }])).toBe('1 workout');
  });

  it('finds activities by the start of any word', () => {
    expect(activityMatches('run', run)).toBe(true);
    expect(activityMatches('bike', list[2])).toBe(true);
    expect(activityMatches('weights', list[3])).toBe(true);
    expect(activityMatches('gym', list[3])).toBe(true);
    expect(activityMatches('jog', run)).toBe(true);
    expect(activityMatches('swim', run)).toBe(false);
    expect(groupActivities(list, 'walk').map((g) => g.category)).toEqual(['Walking']);
    expect(groupActivities(list).map((g) => g.category)).toEqual(['Walking', 'Running', 'Cycling', 'Strength']);
  });

  it('reads typed minutes and calories', () => {
    expect(parseMinutes('45')).toEqual({ ok: true, minutes: 45 });
    expect(parseMinutes('0')).toMatchObject({ ok: false });
    expect(parseMinutes('2000')).toMatchObject({ ok: false });
    expect(parseKcal('412')).toEqual({ ok: true, kcal: 412 });
    expect(parseKcal('')).toMatchObject({ ok: false });
    expect(parseKcal('20000')).toMatchObject({ ok: false });
  });

  it('keeps one of each recent workout, newest first', () => {
    const w = (id: string, created_at: string, over: Partial<Workout>): Workout => ({
      id,
      log_date: created_at.slice(0, 10),
      exercise_id: 6,
      name: 'Running (10 km/h)',
      duration_min: 30,
      kcal_burned: 352,
      created_at,
      ...over,
    });
    const history = [
      w('a', '2026-10-01T07:00:00Z', {}),
      w('b', '2026-10-05T07:00:00Z', { duration_min: 45, kcal_burned: 528 }),
      w('c', '2026-10-06T18:00:00Z', { exercise_id: null, name: 'Spin class', duration_min: null, kcal_burned: 410 }),
      w('d', '2026-10-07T18:00:00Z', { exercise_id: null, name: 'spin class ', duration_min: null, kcal_burned: 380 }),
    ];
    expect(recentWorkouts(history).map((x) => x.id)).toEqual(['d', 'b']);
  });
});
