import { acsmVo2, defaultSpeed, estimateWorkout, gaitOf, keytel, restingPerMin, speedToDisplay, type Body } from '@/features/exercise/energy';
import type { Activity } from '@/features/exercise/logic';

// 30-year-old man, 180 cm, 82 kg: Mifflin-St Jeor 1,800 kcal a day, so 1.25 kcal a minute resting.
const you: Body = { kg: 82, sex: 'male', age: 30, heightCm: 180 };
const run: Activity = { id: 6, name: 'Running (10 km/h)', category: 'Running', met: 9.8 };
const walk: Activity = { id: 2, name: 'Walking, moderate (5 km/h)', category: 'Walking', met: 3.5 };
const hike: Activity = { id: 4, name: 'Hiking', category: 'Walking', met: 6 };
const weights: Activity = { id: 13, name: 'Weight training, general', category: 'Strength', met: 3.5 };

describe('your own resting burn', () => {
  it('comes from your stats, or the textbook 1 MET without them', () => {
    expect(restingPerMin(you)).toEqual({ kcal: 1.25, personal: true });
    expect(restingPerMin({ kg: 82, sex: null, age: null, heightCm: null }).kcal).toBeCloseTo(1.435);
  });
});

describe('speed and incline (ACSM)', () => {
  it('works out the oxygen cost of walking and running', () => {
    expect(acsmVo2(10, 0, 'run')).toBeCloseTo(36.83, 1);
    expect(acsmVo2(5, 0, 'walk')).toBeCloseTo(11.83, 1);
    // A 10% incline more than doubles the cost of a 5 km/h walk.
    expect(acsmVo2(5, 10, 'walk')).toBeCloseTo(26.83, 1);
    // Very fast "walking" costs what running does.
    expect(acsmVo2(8.5, 0, 'walk')).toBe(acsmVo2(8.5, 0, 'run'));
  });

  it('reads the speed from the activity, and knows hiking isn’t a treadmill', () => {
    expect(defaultSpeed(run)).toBe(10);
    expect(defaultSpeed({ name: 'Walking, brisk (6.5 km/h)', category: 'Walking' })).toBe(6.5);
    expect(gaitOf(run)).toBe('run');
    expect(gaitOf(walk)).toBe('walk');
    expect(gaitOf(hike)).toBeNull();
    expect(gaitOf(weights)).toBeNull();
    expect(speedToDisplay(16.09344, 'imperial')).toBeCloseTo(10);
  });
});

describe('workout calories', () => {
  it('uses speed for runs and walks, minus your own resting burn', () => {
    expect(estimateWorkout(run, 30, you)).toEqual({ kcal: 416, method: 'speed', personal: true });
    expect(estimateWorkout(walk, 45, you, { speedKmh: 5, inclinePct: 10 }).kcal).toBe(439);
  });

  it('prefers your heart rate when you give it (Keytel)', () => {
    expect(keytel(150, you)).toBeCloseTo(14.79, 2);
    expect(estimateWorkout(run, 30, you, { avgHr: 150 })).toMatchObject({ kcal: 406, method: 'heart-rate' });
    // Heart rate needs age and sex.
    expect(estimateWorkout(run, 30, { kg: 82, sex: null, age: null, heightCm: null }, { avgHr: 150 }).method).toBe('speed');
  });

  it('scales other activities by effort', () => {
    expect(estimateWorkout(weights, 60, you, { effort: 'hard' }).kcal).toBe(287);
    expect(estimateWorkout(weights, 60, you, { effort: 'easy' }).kcal).toBeLessThan(estimateWorkout(weights, 60, you).kcal);
    expect(estimateWorkout(weights, 60, { kg: 82, sex: null, age: null, heightCm: null })).toEqual({ kcal: 215, method: 'met', personal: false });
  });

  it('never goes below zero', () => {
    expect(estimateWorkout(run, 30, you, { avgHr: 60 }).kcal).toBe(0);
  });
});
