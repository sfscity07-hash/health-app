import Constants, { ExecutionEnvironment } from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ModalHeader } from '@/components/food/ModalHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { ToastHost } from '@/components/ui/ToastHost';
import { loadErrorMessage } from '@/features/auth/errors';
import { useFeedbackList, useFeedbackReader, useSendFeedback } from '@/features/feedback/api';
import { deviceLabel, feedbackProblem, KINDS, MAX_LENGTH, sendErrorMessage, sentAt, type Feedback, type FeedbackKind } from '@/features/feedback/logic';
import { versionLabel } from '@/features/updates/ota';
import { success } from '@/lib/haptics';
import { useToast } from '@/store/toast';
import { useTheme } from '@/theme/theme';
import { gutter, radius, space, type ColorName } from '@/theme/tokens';

const KIND_COLOR: Record<FeedbackKind, ColorName> = { bug: 'warn', idea: 'accent', other: 'textSecondary' };

/** The app version and phone sent with each message, so a bug can be found. */
function sentWith() {
  const expoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  return {
    app_version: `${versionLabel(Constants.expoConfig?.version ?? '1.0.0')}${expoGo ? ' · Expo Go' : ''}`.slice(0, 120),
    device: deviceLabel(Platform.OS, Platform.Version, Platform.constants as unknown as Record<string, unknown>),
  };
}

/**
 * Feedback and bug reports. Everyone can send and see what they sent;
 * accounts listed in feedback_readers see everyone's here.
 */
export default function FeedbackScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const showToast = useToast((s) => s.show);
  const send = useSendFeedback();
  const list = useFeedbackList();
  const reader = useFeedbackReader().data === true;
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const info = KINDS.find((k) => k.value === kind) ?? KINDS[0];
  const meta = sentWith();
  const now = new Date();
  const items = list.data ?? [];

  function submit() {
    const problem = feedbackProblem(message);
    setError(problem);
    if (problem || send.isPending) return;
    send.mutate(
      { kind, message, screen: from ? String(from).slice(0, 60) : null, ...meta },
      {
        onSuccess: () => {
          success();
          setMessage('');
          showToast('Thanks! Sent.');
        },
        onError: (e) => setError(sendErrorMessage(e)),
      },
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ModalHeader title="Feedback" onClose={() => router.back()} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 96 }]}>
        <View style={styles.intro}>
          <Text variant="title" accessibilityRole="header">
            Feedback & bugs
          </Text>
          <Text variant="small" color="textSecondary">
            Something broken, confusing or missing? Tell us here. It goes straight to the person who builds Fuel.
          </Text>
        </View>

        <SegmentedControl label="What is it?" options={KINDS.map(({ value, label }) => ({ value, label }))} value={kind} onChange={setKind} />
        <TextField
          label={info.field}
          placeholder={info.placeholder}
          value={message}
          onChangeText={(t) => {
            setMessage(t);
            if (error) setError(null);
          }}
          multiline
          maxLength={MAX_LENGTH + 200}
          error={error}
        />
        <Text variant="caption" color="textTertiary">
          Sent with your email, the app version ({meta.app_version}) and your phone ({meta.device}), so a bug can be found.
        </Text>
        <Button label="Send" icon="arrowRight" loading={send.isPending} disabled={!message.trim()} onPress={submit} />

        {list.isPending ? (
          <ListSkeleton rows={2} />
        ) : list.isError ? (
          <Text variant="small" color="textSecondary">
            {loadErrorMessage(list.error, 'Couldn’t load the feedback list.')}
          </Text>
        ) : items.length > 0 || reader ? (
          <View style={styles.section}>
            <Text variant="label">{reader ? `Everyone's feedback · ${items.length}` : 'What you’ve sent'}</Text>
            {items.length === 0 ? (
              <Text variant="small" color="textSecondary">
                Nothing yet.
              </Text>
            ) : (
              items.map((f) => <FeedbackCard key={f.id} item={f} reader={reader} now={now} />)
            )}
          </View>
        ) : null}
      </ScrollView>
      <ToastHost bottom={insets.bottom + 24} />
    </KeyboardAvoidingView>
  );
}

function FeedbackCard({ item, reader, now }: { item: Feedback; reader: boolean; now: Date }) {
  const { colors } = useTheme();
  const kind = KINDS.find((k) => k.value === item.kind)?.label ?? item.kind;
  const details = [item.app_version, item.device, item.screen ? `from ${item.screen}` : null].filter(Boolean).join(' · ');
  return (
    <Card style={styles.card}>
      <View style={styles.cardHead}>
        <View style={[styles.kind, { backgroundColor: colors.surface2 }]}>
          <Text variant="caption" color={KIND_COLOR[item.kind] ?? 'textSecondary'}>
            {kind}
          </Text>
        </View>
        <Text variant="caption" color="textSecondary" style={styles.flex} numberOfLines={1}>
          {reader ? (item.email ?? 'unknown') : ''}
        </Text>
        <Text variant="caption" color="textTertiary">
          {sentAt(item.created_at, now)}
        </Text>
      </View>
      <Text variant="body" selectable>
        {item.message}
      </Text>
      {reader && details ? (
        <Text variant="caption" color="textTertiary" selectable>
          {details}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: gutter, gap: space.lg },
  intro: { gap: space.xs, marginTop: space.sm },
  section: { gap: space.sm, marginTop: space.md },
  card: { padding: space.lg, gap: space.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  kind: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill },
  flex: { flex: 1 },
});
