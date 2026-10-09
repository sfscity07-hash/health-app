import { addDays } from '@/lib/dates';

export type ReminderKey = 'weighIn' | 'lunch' | 'finish' | 'checkin';
export type ReminderSetting = { on: boolean; /** "HH:MM", 24-hour */ time: string };
export type ReminderSettings = Record<ReminderKey, ReminderSetting>;

export const REMINDERS: { key: ReminderKey; label: string; description: string }[] = [
  { key: 'weighIn', label: 'Morning weigh-in', description: 'Skipped on days you’ve already weighed in.' },
  { key: 'lunch', label: 'Log your lunch', description: 'Only if lunch isn’t logged by then.' },
  { key: 'finish', label: 'Finish your day', description: 'Skipped once you’ve tapped Finish today.' },
  { key: 'checkin', label: 'Weekly check-in', description: 'Mondays, until you’ve done it.' },
];

export const DEFAULT_REMINDERS: ReminderSettings = {
  weighIn: { on: false, time: '07:30' },
  lunch: { on: false, time: '13:30' },
  finish: { on: false, time: '21:00' },
  checkin: { on: false, time: '09:00' },
};

/** What's already done, so today's reminders for it are skipped. */
export type DoneToday = { weighedIn: boolean; lunchLogged: boolean; finished: boolean; checkedInThisWeek: boolean };

export type PlannedReminder = { key: ReminderKey; at: Date; title: string; body: string; /** Screen to open when tapped. */ url: string };

/** How many days ahead to schedule; reopening the app re-plans them. */
export const PLAN_DAYS = 7;

const parseTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return { h: Number.isFinite(h) ? h : 9, m: Number.isFinite(m) ? m : 0 };
};

/** "07:30" → "7:30 am". */
export function formatTime(t: string): string {
  const { h, m } = parseTime(t);
  const suffix = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** Moves a time by some minutes, wrapping around midnight. */
export function shiftTime(t: string, minutes: number): string {
  const { h, m } = parseTime(t);
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function message(key: ReminderKey, isToday: boolean, streak: number): Omit<PlannedReminder, 'key' | 'at'> {
  switch (key) {
    case 'weighIn':
      return { title: 'Morning weigh-in', body: 'Step on the scale before breakfast. Every weigh-in sharpens your trend.', url: '/weigh-in' };
    case 'lunch':
      return { title: 'Lunch not logged yet', body: 'Log it while you remember. Your recent foods are one tap away.', url: '/log?meal=lunch' };
    case 'finish':
      return {
        title: 'Finish your day',
        body: isToday && streak > 0 ? `Check today’s log and tap Finish today to make it ${streak + 1} days in a row.` : 'Check today’s log and tap Finish today to keep your streak going.',
        url: '/',
      };
    case 'checkin':
      return { title: 'Your weekly check-in is ready', body: 'See how last week went and set this week’s budget. About a minute.', url: '/checkin' };
  }
}

/**
 * The reminders to schedule for the next week. Today's are skipped once
 * you've done the thing (and any time already passed); the check-in is
 * Mondays only.
 */
export function planReminders(settings: ReminderSettings, now: Date, done: DoneToday, streak = 0, days = PLAN_DAYS): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  for (let d = 0; d < days; d++) {
    const day = addDays(now, d);
    const isToday = d === 0;
    for (const { key } of REMINDERS) {
      const s = settings[key];
      if (!s.on) continue;
      if (key === 'checkin' && day.getDay() !== 1) continue;
      if (isToday) {
        if (key === 'weighIn' && done.weighedIn) continue;
        if (key === 'lunch' && done.lunchLogged) continue;
        if (key === 'finish' && done.finished) continue;
        if (key === 'checkin' && done.checkedInThisWeek) continue;
      }
      const { h, m } = parseTime(s.time);
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0);
      if (at.getTime() <= now.getTime()) continue;
      out.push({ key, at, ...message(key, isToday, streak) });
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Any reminder switched on. */
export const anyOn = (s: ReminderSettings) => Object.values(s).some((r) => r.on);
