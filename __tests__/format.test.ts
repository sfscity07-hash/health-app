import { formatDayLabel, formatInt, formatOne, greetingFor } from '@/lib/format';

describe('format', () => {
  it('rounds and groups thousands', () => {
    expect(formatInt(1950.4)).toBe('1,950');
    expect(formatInt(775)).toBe('775');
    expect(formatInt(12345678)).toBe('12,345,678');
    expect(formatInt(-1200)).toBe('-1,200');
  });

  it('formats weights to one decimal', () => {
    expect(formatOne(82.66)).toBe('82.7');
    expect(formatOne(78)).toBe('78.0');
  });

  it('builds the screen eyebrow', () => {
    expect(formatDayLabel(new Date(2026, 9, 6))).toBe('Tue · Oct 6');
  });

  it('greets by time of day', () => {
    expect(greetingFor(new Date(2026, 9, 6, 7, 30))).toBe('Good morning');
    expect(greetingFor(new Date(2026, 9, 6, 13, 0))).toBe('Good afternoon');
    expect(greetingFor(new Date(2026, 9, 6, 19, 12))).toBe('Good evening');
    expect(greetingFor(new Date(2026, 9, 6, 2, 0))).toBe('Good evening');
  });
});
