/**
 * Design tokens for Fuel. Values come from the approved v2 design preview
 * (docs/PLAN.md → Design system). Dark is the primary theme.
 */

const dark = {
  bg: '#07080C',
  surface1: '#0F1117',
  surface2: '#161922',
  surface3: '#1F2330',
  bar: '#2A2F40',
  hairline: 'rgba(255,255,255,0.07)',
  hairlineStrong: 'rgba(255,255,255,0.13)',
  highlight: 'rgba(255,255,255,0.035)',
  text: '#F2F3F8',
  textSecondary: '#9297AD',
  textTertiary: '#646980',
  accent: '#8F9BFF',
  accentInk: '#0A0C1A',
  accentSoft: 'rgba(143,155,255,0.14)',
  accentGlow: 'rgba(143,155,255,0.5)',
  protein: '#FF6F91',
  carbs: '#FFB547',
  fat: '#2FD3B5',
  good: '#4ADE9B',
  warn: '#FF8A5C',
  flame: '#FF9A3C',
  water: '#5CB8FF',
  glass: 'rgba(24,27,37,0.94)',
  segmentOn: '#2A2E3D',
  scrim: 'rgba(0,0,0,0.5)',
};

export type ThemeColors = typeof dark;

const light: ThemeColors = {
  bg: '#F3F4F8',
  surface1: '#FFFFFF',
  surface2: '#EEF0F5',
  surface3: '#E3E6EE',
  bar: '#D3D7E2',
  hairline: 'rgba(16,18,30,0.08)',
  hairlineStrong: 'rgba(16,18,30,0.15)',
  highlight: 'rgba(255,255,255,0)',
  text: '#11131B',
  textSecondary: '#5E6379',
  textTertiary: '#9297AA',
  accent: '#4F5BE0',
  accentInk: '#FFFFFF',
  accentSoft: 'rgba(79,91,224,0.10)',
  accentGlow: 'rgba(79,91,224,0.32)',
  protein: '#E3466C',
  carbs: '#D98E0B',
  fat: '#0F9F86',
  good: '#16A361',
  warn: '#E0602F',
  flame: '#F07A1A',
  water: '#2E8FE0',
  glass: 'rgba(255,255,255,0.96)',
  segmentOn: '#FFFFFF',
  scrim: 'rgba(16,18,30,0.28)',
};

export const palettes = { dark, light } as const;
export type SchemeName = keyof typeof palettes;
export type ColorName = keyof ThemeColors;

/** 4-pt spacing scale. */
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

/** Screen side gutter used by every tab. */
export const gutter = space.lg + 2;

export const radius = {
  sm: 9,
  md: 12,
  lg: 16,
  xl: 22,
  sheet: 30,
  pill: 999,
} as const;

export const fonts = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
  mono: 'GeistMono_400Regular',
  monoMedium: 'GeistMono_500Medium',
} as const;

/**
 * Type scale. Letter spacing is in px (React Native has no `em`), derived
 * from the design's em values at each size.
 */
export const typeScale = {
  display: { fontFamily: fonts.semibold, fontSize: 60, lineHeight: 62, letterSpacing: -3.3 },
  hero: { fontFamily: fonts.semibold, fontSize: 40, lineHeight: 44, letterSpacing: -2.2 },
  title: { fontFamily: fonts.semibold, fontSize: 25, lineHeight: 30, letterSpacing: -0.9 },
  heading: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22, letterSpacing: -0.4 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, letterSpacing: 0 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21, letterSpacing: -0.15 },
  small: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, letterSpacing: 0 },
  smallStrong: { fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, letterSpacing: 0 },
  caption: { fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 15, letterSpacing: 0 },
  label: { fontFamily: fonts.mono, fontSize: 10, lineHeight: 13, letterSpacing: 0.8 },
} as const;

export type TypeVariant = keyof typeof typeScale;

export const motion = {
  /** Gauge, rings and bars filling. */
  fill: 1000,
  /** Numbers counting to a new value. */
  count: 850,
  /** Sheets and toasts. */
  sheet: 450,
} as const;
