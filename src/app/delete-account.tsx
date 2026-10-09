import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { ModalHeader } from '@/components/food/ModalHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { authErrorMessage } from '@/features/auth/errors';
import { cancelAll } from '@/features/reminders/notify';
import { requireSupabase } from '@/lib/supabase';
import { useToast } from '@/store/toast';
import { useTheme } from '@/theme/theme';
import { gutter, space } from '@/theme/tokens';

const CONFIRM = 'DELETE';

/** Deletes your account and everything in it, after you type DELETE. */
export default function DeleteAccountScreen() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const showToast = useToast((s) => s.show);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = typed.trim().toUpperCase() === CONFIRM;

  async function remove() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const sb = requireSupabase();
      const { error: rpcError } = await sb.rpc('delete_my_account');
      if (rpcError) throw rpcError;
      await cancelAll().catch(() => {});
      // The account is gone; drop the session on this phone and everything cached.
      await sb.auth.signOut({ scope: 'local' });
      queryClient.clear();
      showToast('Your account and all your data were deleted.', 'info');
    } catch (e) {
      setError(authErrorMessage(e));
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ModalHeader title="Delete account" onClose={() => router.back()} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text variant="title" accessibilityRole="header">
            Delete your account
          </Text>
          <Text variant="small" color="textSecondary">
            This permanently deletes your account and everything in it from Fuel’s database. It can’t be undone.
          </Text>
        </View>

        <Card style={styles.card}>
          {[
            'Every food, quick add and saved meal you logged',
            'Your weigh-ins, water and workouts',
            'Your foods, favorites and weekly check-ins',
            'Your goals, targets and settings',
          ].map((line) => (
            <View key={line} style={styles.line}>
              <Icon name="trash" size={16} color="warn" />
              <Text variant="small" style={styles.flex}>
                {line}
              </Text>
            </View>
          ))}
        </Card>

        <Button label="Export my data first" icon="arrowRight" variant="secondary" onPress={() => router.push('/export')} />

        <TextField
          label={`Type ${CONFIRM} to confirm`}
          value={typed}
          onChangeText={(v) => {
            setTyped(v);
            setError(null);
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={CONFIRM}
        />
        {error ? (
          <Text variant="small" color="warn" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <Button label="Delete my account forever" variant="danger" disabled={!ready} loading={busy} onPress={remove} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxl, paddingTop: space.sm, gap: space.lg },
  intro: { gap: space.xs },
  card: { padding: space.lg, gap: space.md },
  line: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
});
