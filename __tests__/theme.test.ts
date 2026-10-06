import { resolveScheme } from '@/theme/theme';
import { palettes } from '@/theme/tokens';

describe('theme', () => {
  it('defines every color in both themes', () => {
    expect(Object.keys(palettes.light).sort()).toEqual(Object.keys(palettes.dark).sort());
  });

  it('keeps the approved v2 palette', () => {
    expect(palettes.dark.bg).toBe('#07080C');
    expect(palettes.dark.accent).toBe('#8F9BFF');
    expect([palettes.dark.protein, palettes.dark.carbs, palettes.dark.fat]).toEqual(['#FF6F91', '#FFB547', '#2FD3B5']);
  });

  it('follows the phone setting unless the user picks a theme', () => {
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', null)).toBe('dark');
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });
});
