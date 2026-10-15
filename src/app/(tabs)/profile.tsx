import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { RemindersCard } from '@/components/profile/RemindersCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SwitchRow } from '@/components/ui/SwitchRow';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { ADDBACK } from '@/features/exercise/logic';
import { useProfile, useUpdateProfile } from '@/features/profile/api';
import { checkForUpdate, restart, updatesEnabled, versionLabel, type UpdateCheck } from '@/features/updates/ota';
import { useDrinkWaterSetting } from '@/features/water/api';
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
  const drinkSetting = useDrinkWaterSetting();
  const theme = usePreferences((s) => s.theme);
  const setTheme = usePreferences((s) => s.setTheme);
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const [update, setUpdate] = useState<UpdateCheck>('idle');

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
        <Text variant="caption">Your weekly check-in tunes these every Monday from what you eat and how your trend moves. You can also set them yourself.</Text>
        <Button label="Edit goals & targets" variant="secondary" icon="pencil" onPress={() => router.push('/goals')} />
        <Button label="Open weekly check-in" variant="ghost" icon="pulse" onPress={() => router.push('/checkin')} />
      </Card>

      <Card style={styles.section}>
        <Text variant="label">Exercise</Text>
        <SwitchRow
          label={ADDBACK.label}
          description={profile?.exercise_addback ? ADDBACK.on : ADDBACK.off}
          value={profile?.exercise_addback ?? false}
          onChange={(v) => updateProfile.mutate({ exercise_addback: v })}
        />
      </Card>

      {typeof profile?.ai_estimates === 'boolean' ? (
        <Card style={styles.section}>
          <Text variant="label">Nutrients</Text>
          <SwitchRow
            label="AI estimates for missing nutrients"
            description={
              profile.ai_estimates
                ? 'When a food’s label and USDA don’t list a vitamin, mineral or its caffeine, Claude estimates it once from the name, brand and macros. Marked AI wherever it shows.'
                : 'Off: foods without data show “no data” instead.'
            }
            value={profile.ai_estimates}
            onChange={(v) => updateProfile.mutate({ ai_estimates: v })}
          />
        </Card>
      ) : null}

      {drinkSetting.ready ? (
        <Card style={styles.section}>
          <Text variant="label">Water</Text>
          <SwitchRow
            label="Count water in drinks"
            description={
              drinkSetting.on
                ? 'Milk, tea, coffee, juice, buttermilk and soup you log add the water in them. Turn one off when you log it if it was cooked down, like milk in oats.'
                : 'Off: only water you add on the Water tile counts.'
            }
            value={drinkSetting.on}
            tint="water"
            onChange={(v) => updateProfile.mutate({ count_drink_water: v })}
          />
        </Card>
      ) : null}

      <RemindersCard />

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

      <Card style={styles.section}>
        <Text variant="label">Your data</Text>
        <Text variant="caption">Everything you log is yours. Export it as spreadsheets any time.</Text>
        <Button label="Export my data (CSV)" variant="secondary" icon="arrowRight" onPress={() => router.push('/export')} />
      </Card>

      <Card style={styles.section}>
        <Text variant="label">Feedback</Text>
        <Text variant="caption">Found a bug, or have an idea? It goes straight to the person who builds Fuel.</Text>
        <Button label="Send feedback" variant="secondary" icon="chat" onPress={() => router.push({ pathname: '/feedback', params: { from: 'profile' } })} />
      </Card>

      <Card style={styles.section}>
        <Text variant="label">Account</Text>
        <Button label="Sign out" variant="secondary" onPress={() => supabase?.auth.signOut()} />
        <Button label="Delete account" variant="ghost" icon="trash" onPress={() => router.push('/delete-account')} />
      </Card>

      <View style={styles.about}>
        <Text variant="label" align="center">
          Fuel {versionLabel(version)}
        </Text>
        {updatesEnabled ? (
          update === 'ready' ? (
            <Button label="Restart to update" icon="refresh" onPress={restart} />
          ) : (
            <>
              <Button
                label="Check for updates"
                variant="ghost"
                icon="refresh"
                loading={update === 'checking'}
                onPress={async () => {
                  setUpdate('checking');
                  setUpdate(await checkForUpdate());
                }}
              />
              {update === 'latest' || update === 'offline' ? (
                <Text variant="caption" align="center" accessibilityLiveRegion="polite">
                  {update === 'latest' ? 'You have the newest version.' : 'Couldn’t check. Are you online?'}
                </Text>
              ) : null}
            </>
          )
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { padding: space.lg, gap: space.md },
  targets: { flexDirection: 'row', justifyContent: 'space-between' },
  target: { gap: 2 },
  about: { gap: space.sm },
});
