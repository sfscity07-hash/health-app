import { isDatabaseBehind } from '@/features/auth/errors';

/**
 * The Feedback chip at the top of the dashboard. Set to false and publish an
 * update to take it away; "Send feedback" stays in Profile (where you also
 * read everyone's).
 */
export const FEEDBACK_ON_DASHBOARD = true;

export type FeedbackKind = 'bug' | 'idea' | 'other';

export type Feedback = {
  id: string;
  user_id: string;
  email: string | null;
  kind: FeedbackKind;
  message: string;
  screen: string | null;
  app_version: string | null;
  device: string | null;
  created_at: string;
};

export const KINDS: { value: FeedbackKind; label: string; field: string; placeholder: string }[] = [
  {
    value: 'bug',
    label: 'Bug',
    field: 'What happened?',
    placeholder: 'What did you do, what happened, and what did you expect? e.g. "I tapped + on Lunch and it went into Dinner."',
  },
  { value: 'idea', label: 'Idea', field: 'Your idea', placeholder: 'What would make Fuel better for you?' },
  { value: 'other', label: 'Other', field: 'Your message', placeholder: 'Anything you want to say.' },
];

export const MAX_LENGTH = 4000;

/** Null when it can be sent, else what's wrong. */
export function feedbackProblem(message: string): string | null {
  const text = message.trim();
  if (!text) return 'Write a few words first.';
  if (text.length > MAX_LENGTH) return `That's ${text.length - MAX_LENGTH} characters too long.`;
  return null;
}

/** "Android 14 · Google Pixel 7", from what React Native knows about the phone. */
export function deviceLabel(os: string, version: string | number, constants: Record<string, unknown> = {}): string {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  if (os === 'android') {
    const brand = str(constants.Brand) || str(constants.Manufacturer);
    const model = str(constants.Model);
    const phone = [brand && !model.toLowerCase().startsWith(brand.toLowerCase()) ? cap(brand) : '', model].filter(Boolean).join(' ');
    return [`Android ${str(constants.Release) || version}`, phone].filter(Boolean).join(' · ').slice(0, 200);
  }
  if (os === 'ios') return `iOS ${version}`.slice(0, 200);
  return os === 'web' ? 'Web' : os;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** What to tell someone whose feedback didn't send. */
export function sendErrorMessage(error: unknown): string {
  const e = error as { message?: string } | null;
  if (/feedback_limit/.test(e?.message ?? '')) return 'That’s 20 messages today, the most for one day. Send the rest tomorrow.';
  if (isDatabaseBehind(error)) return 'Feedback needs the newest SQL file (feedback) run in Supabase first.';
  return 'Couldn’t send it. Check your connection and try again; your message is still here.';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Just now", "12 min ago", "Today, 14:05", "Yesterday, 09:12" or "3 Oct, 09:12". */
export function sentAt(iso: string, now: Date): string {
  const at = new Date(iso);
  const mins = Math.floor((now.getTime() - at.getTime()) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const time = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(now) - day(at)) / 86_400_000);
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  return `${at.getDate()} ${MONTHS[at.getMonth()]}${at.getFullYear() === now.getFullYear() ? '' : ` ${at.getFullYear()}`}, ${time}`;
}
