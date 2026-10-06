/** Rounds and adds thousands separators: 1950.4 → "1,950". */
export function formatInt(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? '-' : '';
  return sign + Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** One decimal place, used for weights: 82.66 → "82.7". */
export function formatOne(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Tue · Oct 6" — the eyebrow above screen titles. */
export function formatDayLabel(d: Date): string {
  return `${DAYS[d.getDay()]} · ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "Good morning" / "Good afternoon" / "Good evening". */
export function greetingFor(d: Date): string {
  const h = d.getHours();
  if (h < 5 || h >= 18) return 'Good evening';
  if (h < 12) return 'Good morning';
  return 'Good afternoon';
}
