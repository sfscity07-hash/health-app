import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ModalHeader } from '@/components/food/ModalHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { ToastHost } from '@/components/ui/ToastHost';
import { authErrorMessage } from '@/features/auth/errors';
import { buildExport, EXPORTS, shareCsv, type ExportKind } from '@/features/export/api';
import { useProfile } from '@/features/profile/api';
import { formatInt } from '@/lib/format';
import { success } from '@/lib/haptics';
import { useToast } from '@/store/toast';
import { useTheme } from '@/theme/theme';
import { gutter, space } from '@/theme/tokens';

/** Your data, yours to keep: each part as a CSV file you can open in any spreadsheet. */
export default function ExportScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: profile } = useProfile();
  const showToast = useToast((s) => s.show);
  const [busy, setBusy] = useState<ExportKind | null>(null);

  async function run(kind: ExportKind) {
    if (busy) return;
    setBusy(kind);
    try {
      const out = await buildExport(kind, profile?.calorie_target ?? 2000);
      await shareCsv(out.filename, out.csv);
      success();
      showToast(`${out.filename} · ${formatInt(out.rows)} row${out.rows === 1 ? '' : 's'}`);
    } catch (e) {
      showToast(authErrorMessage(e), 'warn');
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ModalHeader title="Export" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 96 }]}>
        <View style={styles.intro}>
          <Text variant="title" accessibilityRole="header">
            Your data, as spreadsheets
          </Text>
          <Text variant="small" color="textSecondary">
            Each file opens in Google Sheets, Excel or Numbers. On your phone, pick where it goes: Drive, email, Files.
          </Text>
        </View>
        {EXPORTS.map((x) => (
          <Card key={x.kind} style={styles.card}>
            <Text variant="bodyStrong">{x.title}</Text>
            <Text variant="small" color="textSecondary">
              {x.description}
            </Text>
            <Button
              label={busy === x.kind ? 'Preparing…' : 'Export CSV'}
              icon="arrowRight"
              variant="secondary"
              loading={busy === x.kind}
              disabled={busy !== null && busy !== x.kind}
              onPress={() => run(x.kind)}
              accessibilityLabel={`Export ${x.title} as CSV`}
            />
          </Card>
        ))}
        <Text variant="caption" color="textTertiary">
          Weights are in kg, water in ml and energy in kcal, whatever units you use in the app.
        </Text>
      </ScrollView>
      <ToastHost bottom={insets.bottom + 24} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: gutter, gap: space.lg, paddingTop: space.sm },
  intro: { gap: space.xs },
  card: { padding: space.lg, gap: space.sm },
});
