import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';

import { usePreferences } from '@/store/preferences';
import { palettes, type SchemeName, type ThemeColors } from '@/theme/tokens';

type Theme = {
  scheme: SchemeName;
  colors: ThemeColors;
};

const ThemeContext = createContext<Theme>({ scheme: 'dark', colors: palettes.dark });

/** Resolves the theme preference ("system", "light", "dark") against the OS setting. */
export function resolveScheme(
  preference: 'system' | SchemeName,
  system: string | null | undefined,
): SchemeName {
  if (preference !== 'system') return preference;
  return system === 'light' ? 'light' : 'dark';
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const system = useColorScheme();
  const preference = usePreferences((s) => s.theme);
  const scheme = resolveScheme(preference, system);
  const value = useMemo(() => ({ scheme, colors: palettes[scheme] }), [scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
