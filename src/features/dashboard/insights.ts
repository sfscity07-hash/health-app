import type { IconName } from '@/components/ui/Icon';
import { formatInt } from '@/lib/format';
import type { Goal } from '@/types/profile';

/** A sentence made of plain and bold parts, so the card can emphasise the number that matters. */
export type Rich = { text: string; bold?: boolean }[];
export type Insight = { key: string; title: string; icon: IconName; body: Rich };

export type InsightInput = {
  isToday: boolean;
  hour: number;
  budget: number;
  eatenKcal: number;
  foodEntries: number;
  protein: { eaten: number; target: number };
  streak: number;
  closedToday: boolean;
  goal: Goal | null;
  trendKg: number | null;
  goalWeightKg: number | null;
  milestoneKg: number | null;
  /** Formats a kg value in the user's units, e.g. "82.5 kg" or "181.9 lb". */
  weight: (kg: number) => string;
};

/** Up to four short, honest observations for the dashboard card. None of them scold. */
export function buildInsights(i: InsightInput): Insight[] {
  const out: Insight[] = [];
  const left = Math.round(i.budget - i.eatenKcal);

  if (i.isToday && i.foodEntries === 0) {
    out.push({
      key: 'start',
      title: 'Start the day',
      icon: 'fork',
      body: [{ text: 'Log your first meal and the gauge starts moving. ' }, { text: 'Tap +', bold: true }, { text: ' to begin.' }],
    });
  }

  if (i.foodEntries > 0) {
    const proteinLeft = Math.round(i.protein.target - i.protein.eaten);
    out.push(
      proteinLeft <= 0
        ? { key: 'protein', title: 'Protein', icon: 'target', body: [{ text: 'Protein target hit', bold: true }, { text: '. That is what keeps muscle while you diet.' }] }
        : {
            key: 'protein',
            title: 'Protein',
            icon: 'target',
            body: [{ text: `${proteinLeft} g of protein`, bold: true }, { text: ' to go. Spreading it over your next meals is easiest.' }],
          },
    );
  }

  if (i.isToday && i.foodEntries > 0) {
    if (left >= 0) {
      out.push({
        key: 'room',
        title: i.hour >= 16 ? 'Dinner' : 'Budget',
        icon: 'fork',
        body: [{ text: 'You have ' }, { text: `${formatInt(left)} kcal left`, bold: true }, { text: i.hour >= 16 ? ' for the rest of today.' : ' today.' }],
      });
    } else {
      out.push({
        key: 'room',
        title: 'Over budget',
        icon: 'fork',
        body: [
          { text: "You're " },
          { text: `${formatInt(-left)} kcal over`, bold: true },
          { text: ' today. One high day barely moves your trend, so log it and carry on.' },
        ],
      });
    }
  }

  if (i.isToday) {
    out.push(
      i.closedToday
        ? { key: 'streak', title: 'Streak', icon: 'flame', body: [{ text: `${i.streak}-day streak.`, bold: true }, { text: ' See you tomorrow.' }] }
        : i.streak > 0
          ? {
              key: 'streak',
              title: 'Streak',
              icon: 'flame',
              body: [{ text: `${i.streak}-day streak.`, bold: true }, { text: ` Finish today to make it ${i.streak + 1}.` }],
            }
          : { key: 'streak', title: 'Streak', icon: 'flame', body: [{ text: 'Tap ' }, { text: 'Finish today', bold: true }, { text: ' tonight to start a streak.' }] },
    );
  }

  if (i.trendKg !== null && i.milestoneKg !== null) {
    out.push({
      key: 'milestone',
      title: 'Next milestone',
      icon: 'flag',
      body: [
        { text: i.weight(Math.abs(i.trendKg - i.milestoneKg)), bold: true },
        { text: ` to ${i.weight(i.milestoneKg)}, your next milestone.` },
      ],
    });
  }

  return out.slice(0, 4);
}
