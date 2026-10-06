import Constants from 'expo-constants';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Text } from '@/components/ui/Text';
import { isSupabaseConfigured } from '@/lib/env';
import { usePreferences, type ThemePreference } from '@/store/preferences';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

export default function ProfileScreen() {
  const { colors } = useTheme();
  const theme = usePreferences((s) => s.theme);
  const setTheme = usePreferences((s) => s.setTheme);
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen eyebrow="Settings" title="Profile">
      <Card style={styles.section}>
        <Text variant="label">Appearance</Text>
        <SegmentedControl label="Theme" options={THEME_OPTIONS} value={theme} onChange={setTheme} />
      </Card>

      <Card style={styles.section}>
        <Text variant="label">Cloud sync</Text>
        <View style={styles.status}>
          <View style={[styles.dot, { backgroundColor: isSupabaseConfigured ? colors.good : colors.warn }]} />
          <Text variant="bodyStrong">{isSupabaseConfigured ? 'Connected to Supabase' : 'Not connected yet'}</Text>
        </View>
        <Text variant="small" color="textSecondary">
          {isSupabaseConfigured
            ? 'Your account and data will sync once sign-in arrives in Phase 2.'
            : 'Add your Supabase URL and key to the .env file, then restart the app. The README walks through it.'}
        </Text>
      </Card>

      <Text variant="label" align="center">
        Fuel {version} · Phase 1
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { padding: space.lg, gap: space.md },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
