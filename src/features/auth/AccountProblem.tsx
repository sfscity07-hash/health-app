import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/theme';
import { gutter, space } from '@/theme/tokens';

/** Shown when you're signed in but your profile can't be loaded. */
export function AccountProblem({ onRetry, missingProfile }: { onRetry: () => void; missingProfile: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top + space.huge, paddingBottom: insets.bottom + space.xl }]}>
      <EmptyState
        icon="user"
        title={missingProfile ? 'Your profile is missing' : "Can't load your account"}
        body={
          missingProfile
            ? 'Your account exists but has no profile row. Check that the database setup ran (README, step 2), then try again.'
            : 'Check your internet connection. If your Supabase project was paused, restore it in the Supabase dashboard.'
        }
      />
      <View style={styles.actions}>
        <Button label="Try again" onPress={onRetry} />
        <Button label="Sign out" variant="ghost" onPress={() => supabase?.auth.signOut()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: gutter, justifyContent: 'space-between' },
  actions: { gap: space.sm },
});
