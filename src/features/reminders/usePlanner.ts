import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useCheckins } from '@/features/checkin/api';
import { checkinWeek } from '@/features/checkin/logic';
import { useClosures, useFoodLogs, useWeighIns } from '@/features/dashboard/api';
import { anyOn, planReminders, type DoneToday } from '@/features/reminders/logic';
import { cancelAll, hasPermission, onReminderTap, remindersSupported, schedule } from '@/features/reminders/notify';
import { toISODate } from '@/lib/dates';
import { streaks } from '@/lib/streak';
import { useReminderSettings } from '@/store/reminders';

/** Set once anything was scheduled, so turning everything off later knows to clear it. */
const SCHEDULED_KEY = 'fuel.reminders.scheduled';
const wasScheduled = () => {
  try {
    return globalThis.localStorage?.getItem(SCHEDULED_KEY) === '1';
  } catch {
    return false;
  }
};
const markScheduled = (on: boolean) => {
  try {
    if (on) globalThis.localStorage?.setItem(SCHEDULED_KEY, '1');
    else globalThis.localStorage?.removeItem(SCHEDULED_KEY);
  } catch {
    // Not fatal.
  }
};

/**
 * Keeps the phone's reminders in step with your day: each time you log,
 * weigh in, finish a day or open the app, the next week of reminders is
 * planned again, leaving out today's for anything you've already done.
 */
export function useReminderPlanner() {
  const settings = useReminderSettings((s) => s.settings);
  const today = toISODate(new Date());
  const logs = useFoodLogs(today);
  const weighIns = useWeighIns();
  const closures = useClosures();
  const checkins = useCheckins();
  const [wake, setWake] = useState(0);

  // Coming back to the app (perhaps on a new day) plans again.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setWake((w) => w + 1);
    });
    return () => sub.remove();
  }, []);

  const done: DoneToday = {
    weighedIn: (weighIns.data ?? []).some((w) => w.date === today),
    lunchLogged: (logs.data ?? []).some((e) => e.meal === 'lunch'),
    finished: (closures.data ?? []).includes(today),
    checkedInThisWeek: (checkins.data ?? []).some((c) => c.week_start === checkinWeek(new Date())),
  };
  const streak = streaks(closures.data ?? [], today).current;
  const ready = logs.isSuccess && weighIns.isSuccess && closures.isSuccess && checkins.isSuccess;
  const on = anyOn(settings);
  const signature = JSON.stringify({ settings, done, today, streak, wake });

  useEffect(() => {
    if (!remindersSupported || !ready) return;
    // A short pause so a burst of changes (logging a meal) plans once.
    const t = setTimeout(() => {
      (async () => {
        if (!on) {
          if (wasScheduled()) {
            await cancelAll();
            markScheduled(false);
          }
          return;
        }
        if (!(await hasPermission())) return;
        await schedule(planReminders(settings, new Date(), done, streak));
        markScheduled(true);
      })().catch(() => {
        // Reminders are a nicety; never let them break the app.
      });
    }, 800);
    return () => clearTimeout(t);
    // Everything the plan uses is in `signature`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, ready, on]);

  // Tapping a reminder opens the right screen.
  useEffect(() => {
    if (!remindersSupported || !on) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    onReminderTap((url) => router.push(url as never))
      .then((s) => {
        if (cancelled) s();
        else stop = s;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [on]);
}
