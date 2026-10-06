import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  useFonts,
} from '@expo-google-fonts/geist';
import { GeistMono_400Regular, GeistMono_500Medium } from '@expo-google-fonts/geist-mono';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AccountProblem } from '@/features/auth/AccountProblem';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/api';
import { usePreferences } from '@/store/preferences';
import { ThemeProvider, useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

const EDITOR = { presentation: 'modal', animation: 'slide_from_right' } as const;

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    GeistMono_400Regular,
    GeistMono_500Medium,
  });
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }));

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ThemeProvider>
              <RootStack />
            </ThemeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootStack() {
  const { scheme, colors } = useTheme();
  const { session, initializing } = useAuth();
  const profile = useProfile();
  const setTheme = usePreferences((s) => s.setTheme);

  const signedIn = Boolean(session);
  // Keep the splash screen up until we know which screen to show.
  const ready = !initializing && (!signedIn || !profile.isPending);
  const onboarded = Boolean(profile.data?.onboarded_at);
  const savedTheme = profile.data?.theme;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  useEffect(() => {
    if (savedTheme) setTheme(savedTheme);
  }, [savedTheme, setTheme]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
  }, [colors.bg]);

  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, background: colors.bg, card: colors.bg, primary: colors.accent, text: colors.text },
    };
  }, [scheme, colors]);

  if (!ready) return null;
  if (signedIn && (profile.isError || profile.data === null)) {
    return <AccountProblem onRetry={() => profile.refetch()} missingProfile={profile.data === null} />;
  }

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="log"
            options={{
              presentation: 'formSheet',
              animation: 'default',
              sheetAllowedDetents: [0.92],
              sheetCornerRadius: radius.sheet,
              sheetGrabberVisible: true,
              contentStyle: { backgroundColor: colors.surface1 },
            }}
          />
          {/* Editors open on top of the logger (or a screen), and go back to it when done. */}
          <Stack.Screen name="quick-add" options={EDITOR} />
          <Stack.Screen name="food/new" options={EDITOR} />
          <Stack.Screen name="food/[id]" options={EDITOR} />
          <Stack.Screen name="entry/[id]" options={EDITOR} />
        </Stack.Protected>
      </Stack>
    </NavigationThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
