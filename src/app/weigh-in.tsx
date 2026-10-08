import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EditorFooter } from '@/components/food/EditorFooter';
import { PortionRuler } from '@/components/food/PortionRuler';
import { DayNav } from '@/components/foodlog/DayNav';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useWeighIns } from '@/features/dashboard/api';
import { useProfile } from '@/features/profile/api';
import { useDeleteWeighIn, useSaveWeighIn, withWeighIn } from '@/features/weight/api';
import { agoText, parseWeight, toDisplay, unitLabel, weightRuler, type Units } from '@/features/weight/logic';
import { fromISODate, toISODate } from '@/lib/dates';
import { formatDayLabel } from '@/lib/format';
import { success, tap } from '@/lib/haptics';
import { trendSeries, type WeighIn } from '@/lib/trend';
import { useToast } from '@/store/toast';
import { useTheme } from '@/theme/theme';
import { fonts, gutter, radius, space } from '@/theme/tokens';

const roundTo = (v: number, step: number) => Math.round(Math.round(v / step) * step * 100) / 100;

type EditorProps = { date: string; today: string; units: Units; list: WeighIn[] };

/** The number, the ruler and the save button for one day. Remounted when the day changes. */
function WeighInEditor({ date, today, units, list }: EditorProps) {
  const { colors } = useTheme();
  const save = useSaveWeighIn();
  const remove = useDeleteWeighIn();
  const showToast = useToast((s) => s.show);

  const existing = list.find((w) => w.date === date);
  const previous = [...list].reverse().find((w) => w.date < date) ?? list[list.length - 1];
  const startKg = existing?.kg ?? previous?.kg ?? 75;
  const unit = unitLabel(units);
  const [ruler, setRuler] = useState(() => weightRuler(toDisplay(startKg, units), units));
  const [value, setValue] = useState(() => roundTo(toDisplay(startKg, units), ruler.step));
  const [typing, setTyping] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trend = useMemo(() => trendSeries(list), [list]);
  const lastTrend = trend[trend.length - 1];
  const fmt = (kg: number) => `${toDisplay(kg, units).toFixed(1)} ${unit}`;

  function commitTyping() {
    if (typing === null) return;
    const parsed = parseWeight(typing, units);
    setTyping(null);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    const shown = Math.round(toDisplay(parsed.kg, units) * 100) / 100;
    // A number off the ruler moves the ruler to it.
    if (shown < ruler.min || shown > ruler.max) setRuler(weightRuler(shown, units));
    setValue(shown);
    setError(null);
  }

  function submit() {
    const parsed = parseWeight(String(value), units);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    save.mutate({ date, kg: parsed.kg });
    success();
    const after = trendSeries(withWeighIn(list, { date, kg: parsed.kg }));
    const t = after[after.length - 1];
    showToast(`Weighed in · ${fmt(parsed.kg)}${t ? ` · trend ${fmt(t.trend)}` : ''}`);
    router.back();
  }

  function del() {
    remove.mutate({ date });
    tap();
    showToast('Deleted that weigh-in');
    router.back();
  }

  return (
    <>
      <View style={styles.body}>
        <View style={styles.valueRow}>
          {typing !== null ? (
            <TextInput
              autoFocus
              value={typing}
              onChangeText={setTyping}
              onBlur={commitTyping}
              onSubmitEditing={commitTyping}
              keyboardType="decimal-pad"
              selectTextOnFocus
              accessibilityLabel={`Weight in ${unit}`}
              selectionColor={colors.accent}
              cursorColor={colors.accent}
              style={[styles.input, { color: colors.text, borderColor: colors.accent }, Platform.OS === 'web' && styles.noWebOutline]}
            />
          ) : (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`${value} ${unit}. Tap to type your weight.`}
              ripple={null}
              pressedScale={0.96}
              onPress={() => setTyping(value.toFixed(1))}
              style={styles.valueButton}>
              <Text variant="display">{value.toFixed(1)}</Text>
              <Text variant="heading" color="textSecondary">
                {unit}
              </Text>
            </PressableScale>
          )}
        </View>
        <PortionRuler key={`${ruler.min}-${ruler.max}`} unit={ruler} value={value} onChange={setValue} background={colors.surface1} />

        <View style={styles.context}>
          {lastTrend ? (
            <Text variant="small" color="textSecondary" align="center" tabular>
              Trend {fmt(lastTrend.trend)}
              {previous && previous.date !== date ? ` · last weigh-in ${fmt(previous.kg)}, ${agoText(previous.date, today)}` : ''}
            </Text>
          ) : null}
          {error ? (
            <Text variant="small" color="warn" align="center" accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
        </View>

        <View style={[styles.tip, { backgroundColor: colors.surface2 }]}>
          <Text variant="caption" color="textSecondary">
            Weigh in first thing in the morning, after the bathroom and before eating. Day-to-day jumps are mostly water; the trend shows
            where you’re really heading.
          </Text>
        </View>
      </View>

      <EditorFooter
        label={existing ? 'Update weigh-in' : 'Save weigh-in'}
        trailing={`${value.toFixed(1)} ${unit}`}
        onPress={submit}
        onDelete={existing ? del : undefined}
      />
    </>
  );
}

/** Log your weight for today, or a day you missed. */
export default function WeighInSheet() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ date?: string }>();
  const today = toISODate(new Date());
  const [date, setDate] = useState(params.date && params.date <= today ? params.date : today);
  const { data: profile } = useProfile();
  const weighIns = useWeighIns();
  const units: Units = profile?.units ?? 'metric';

  return (
    <View style={[styles.root, { backgroundColor: colors.surface1, paddingTop: Platform.OS === 'web' ? insets.top + space.lg : space.xxl }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="label">{date === today ? 'Today' : formatDayLabel(fromISODate(date))}</Text>
          <Text variant="title" accessibilityRole="header">
            Weigh-in
          </Text>
        </View>
        <DayNav date={date} today={today} onChange={setDate} />
        <IconButton icon="close" label="Close" size={36} onPress={() => router.back()} />
      </View>
      {weighIns.isPending ? (
        <ActivityIndicator color={colors.accent} accessibilityLabel="Loading" style={styles.loading} />
      ) : (
        <WeighInEditor key={date} date={date} today={today} units={units} list={weighIns.data ?? []} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: gutter },
  headerText: { flex: 1, gap: 2 },
  loading: { marginTop: space.xxl },
  body: { flex: 1, paddingHorizontal: gutter, paddingTop: space.xl, gap: space.lg },
  valueRow: { alignItems: 'center', minHeight: 70, justifyContent: 'center' },
  valueButton: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: space.md, borderRadius: radius.md },
  input: { minWidth: 160, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 52, borderBottomWidth: 2, paddingVertical: 0 },
  noWebOutline: { outlineWidth: 0 },
  context: { gap: space.xs, minHeight: 20 },
  tip: { padding: space.md, borderRadius: radius.md },
});
