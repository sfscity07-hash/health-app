import { buildInsights, type InsightInput } from '@/features/dashboard/insights';
import { displayWeight } from '@/lib/units';

const base: InsightInput = {
  isToday: true,
  hour: 19,
  budget: 1950,
  eatenKcal: 1175,
  foodEntries: 8,
  protein: { eaten: 98, target: 160 },
  streak: 23,
  closedToday: false,
  goal: 'lose',
  trendKg: 82.7,
  goalWeightKg: 78,
  milestoneKg: 82.5,
  weight: (kg) => displayWeight(kg, 'metric'),
};

const text = (i: ReturnType<typeof buildInsights>[number]) => i.body.map((p) => p.text).join('');

describe('buildInsights', () => {
  it('covers protein, remaining budget, streak and the next milestone', () => {
    const list = buildInsights(base);
    expect(list.map((i) => i.key)).toEqual(['protein', 'room', 'streak', 'milestone']);
    expect(text(list[0])).toBe('62 g of protein to go. Spreading it over your next meals is easiest.');
    expect(text(list[1])).toBe('You have 775 kcal left for the rest of today.');
    expect(text(list[2])).toBe('23-day streak. Finish today to make it 24.');
    expect(text(list[3])).toBe('0.2 kg to 82.5 kg, your next milestone.');
  });

  it('nudges you to log when the day is empty', () => {
    const list = buildInsights({ ...base, foodEntries: 0, eatenKcal: 0, protein: { eaten: 0, target: 160 } });
    expect(list[0].key).toBe('start');
    expect(list.some((i) => i.key === 'protein')).toBe(false);
  });

  it('stays supportive when over budget', () => {
    const list = buildInsights({ ...base, eatenKcal: 2100 });
    expect(text(list.find((i) => i.key === 'room')!)).toMatch(/150 kcal over today\. One high day barely moves your trend/);
  });

  it('shows past days without today-only prompts', () => {
    const list = buildInsights({ ...base, isToday: false });
    expect(list.map((i) => i.key)).toEqual(['protein', 'milestone']);
  });
});
