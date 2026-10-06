const pad = (n: number) => String(n).padStart(2, '0');

/** The calendar date in the phone's time zone as YYYY-MM-DD (never UTC). */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parses YYYY-MM-DD as a local calendar date. */
export function fromISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

/** Whole years between a birth date and a day, as people count birthdays. */
export function ageOn(birth: Date, on: Date): number {
  let age = on.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    on.getMonth() < birth.getMonth() || (on.getMonth() === birth.getMonth() && on.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/**
 * A birth date for someone who is `age` today. Onboarding only asks for age,
 * so we anchor the birthday on today's date; the age ticks over a year later.
 */
export function birthDateForAge(age: number, today: Date): Date {
  const d = new Date(today);
  d.setFullYear(today.getFullYear() - age);
  return d;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Feb 12" this year, "Feb 12, 2027" otherwise. */
export function formatShortDate(d: Date, today: Date = new Date()): string {
  const base = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === today.getFullYear() ? base : `${base}, ${d.getFullYear()}`;
}
