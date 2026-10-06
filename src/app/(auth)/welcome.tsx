import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/BrandMark';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Text } from '@/components/ui/Text';
import { isSupabaseConfigured } from '@/lib/env';
import { useTheme } from '@/theme/theme';
import { gutter, space } from '@/theme/tokens';

const POINTS = [
  'A budget that adapts to your real metabolism',
  'Log a meal in three taps, or scan the barcode',
  'A weekly check-in that keeps you on pace',
];

export default function WelcomeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top + space.xxxl, paddingBottom: insets.bottom + space.xl }]}>
      <View style={styles.top}>
        <BrandMark size={52} />
        <View style={styles.headline}>
          <Text variant="label">Fuel</Text>
          <Text variant="hero" accessibilityRole="header">
            Calorie tracking that learns you.
          </Text>
        </View>
        <View style={styles.points}>
          {POINTS.map((p) => (
            <View key={p} style={styles.point}>
              <View style={[styles.dot, { backgroundColor: colors.accent }]} />
              <Text variant="body" color="textSecondary">
                {p}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        {isSupabaseConfigured ? null : (
          <EmptyState
            icon="user"
            title="Connect Supabase first"
            body="Add your Supabase URL and key to the .env file, then restart the app. The README walks through it."
          />
        )}
        <Button
          label="Create account"
          disabled={!isSupabaseConfigured}
          onPress={() => router.push('/sign-up')}
        />
        <Button
          label="I already have an account"
          variant="ghost"
          disabled={!isSupabaseConfigured}
          onPress={() => router.push('/sign-in')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: gutter, justifyContent: 'space-between' },
  top: { gap: space.xxxl },
  headline: { gap: space.sm },
  points: { gap: space.md },
  point: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dot: { width: 6, height: 6, borderRadius: 3 },
  actions: { gap: space.sm },
});
