import Constants from 'expo-constants';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile, useUpdateProfile } from '@/features/profile/api';
import { formatInt } from '@/lib/format';
import { fiberTarget } from '@/lib/nutrition';
import { supabase } from '@/lib/supabase';
import { usePreferences, type ThemePreference } from '@/store/preferences';
import { space } from '@/theme/tokens';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

export default function ProfileScreen() {
  const { session } = useAuth();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const theme = usePreferences((s) => s.theme);
  const setTheme = usePreferences((s) => s.setTheme);
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const targets = profile
    ? [
        { label: 'Calories', value: `${formatInt(profile.calorie_target ?? 0)}`, unit: 'kcal' },
        { label: 'Protein', value: `${profile.protein_g ?? 0}`, unit: 'g' },
        { label: 'Carbs', value: `${profile.carbs_g ?? 0}`, unit: 'g' },
        { label: 'Fat', value: `${profile.fat_g ?? 0}`, unit: 'g' },
        { label: 'Fibre', value: `${fiberTarget(profile.calorie_target ?? 2000)}`, unit: 'g' },
      ]
    : [];

  return (
    <Screen eyebrow={session?.user.email ?? 'Settings'} title="Profile">
      <Card style={styles.section}>
        <Text variant="label">Daily targets</Text>
        <View style={styles.targets}>
          {targets.map((t) => (
            <View key={t.label} style={styles.target}>
              <Text variant="caption">{t.label}</Text>
              <Text variant="heading" tabular>
                {t.value}
                <Text variant="caption"> {t.unit}</Text>
              </Text>
            </View>
          ))}
        </View>
        <Text variant="caption">Editing goals arrives in Phase 12. Your weekly check-in will tune these automatically.</Text>
      </Card>

      <Card style={styles.section}>
        <Text variant="label">Appearance</Text>
        <SegmentedControl
          label="Theme"
          options={THEME_OPTIONS}
          value={theme}
          onChange={(value) => {
            setTheme(value);
            updateProfile.mutate({ theme: value });
          }}
        />
      </Card>

      <Button label="Sign out" variant="secondary" onPress={() => supabase?.auth.signOut()} />

      <Text variant="label" align="center">
        Fuel {version} · Phase 2
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { padding: space.lg, gap: space.md },
  targets: { flexDirection: 'row', justifyContent: 'space-between' },
  target: { gap: 2 },
});
