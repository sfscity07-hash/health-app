import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { EditorFooter } from '@/components/food/EditorFooter';
import { DayNav, relativeDay } from '@/components/foodlog/DayNav';
import { IconButton } from '@/components/ui/IconButton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Text } from '@/components/ui/Text';
import { useFoodLogs } from '@/features/dashboard/api';
import { useLogEntries } from '@/features/food/api';
import { copyEntries, mealSummary, totalOf } from '@/features/meals/logic';
import { addDays, fromISODate, toISODate } from '@/lib/dates';
import { formatInt } from '@/lib/format';
import { success } from '@/lib/haptics';
import { isMeal, MEAL_LABEL, MEAL_OPTIONS, MEALS, type Meal } from '@/lib/meals';
import { useToast } from '@/store/toast';
import { useTheme } from '@/theme/theme';
import { gutter, space } from '@/theme/tokens';

/** How far ahead you can copy, e.g. to plan tomorrow's lunch. */
const DAYS_AHEAD = 7;

/** Copy one meal, or a whole day, to another day. */
export default function CopySheet() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ from: string; meal?: string }>();
  const today = toISODate(new Date());
  const from = params.from || today;
  const meal: Meal | null = isMeal(params.meal) ? params.meal : null;
  const [target, setTarget] = useState(from === today ? toISODate(addDays(new Date(), 1)) : today);
  const [slot, setSlot] = useState<Meal>(meal ?? 'breakfast');
  const logs = useFoodLogs(from);
  const logEntries = useLogEntries();
  const showToast = useToast((s) => s.show);

  const entries = (logs.data ?? []).filter((e) => !e.id.startsWith('temp-') && (meal === null || e.meal === meal));
  const totals = totalOf(entries.map((e) => ({ nutrients: e })));
  const what = meal ? MEAL_LABEL[meal].toLowerCase() : 'this day';
  // "today", "tomorrow", but "Friday" and "Oct 12" keep their capitals.
  const day = relativeDay(target, today);
  const where = ['Today', 'Tomorrow', 'Yesterday'].includes(day) ? day.toLowerCase() : day;
  const max = toISODate(addDays(fromISODate(today), DAYS_AHEAD));

  function copy() {
    if (entries.length === 0) return;
    logEntries.mutate(copyEntries(entries, target, meal ? slot : undefined));
    success();
    showToast(`Copied ${what} to ${where} · ${formatInt(totals.kcal)} kcal`);
    router.back();
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.surface1 }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="label">From {relativeDay(from, today)}</Text>
          <Text variant="title" accessibilityRole="header">
            Copy {what}
          </Text>
        </View>
        <IconButton icon="close" label="Close" size={36} onPress={() => router.back()} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.group}>
          <Text variant="caption" color="textSecondary">
            To
          </Text>
          <View style={styles.dayRow}>
            <DayNav date={target} today={today} max={max} onChange={setTarget} />
          </View>
        </View>

        {meal ? (
          <View style={styles.group}>
            <Text variant="caption" color="textSecondary">
              As
            </Text>
            <SegmentedControl label="Meal" options={MEAL_OPTIONS} value={slot} onChange={setSlot} />
          </View>
        ) : null}

        <View style={styles.group}>
          <Text variant="caption" color="textSecondary">
            {mealSummary(entries.length, totals.kcal)}
          </Text>
          {logs.isPending ? <ActivityIndicator color={colors.accent} /> : null}
          {(meal ? entries : MEALS.flatMap((m) => entries.filter((e) => e.meal === m))).map((e) => (
            <View key={e.id} style={[styles.item, { borderTopColor: colors.hairline }]}>
              <Text variant="body" numberOfLines={1} style={styles.itemName}>
                {e.name}
              </Text>
              {!meal ? (
                <Text variant="caption" color="textTertiary">
                  {MEAL_LABEL[e.meal]}
                </Text>
              ) : null}
              <Text variant="smallStrong" color="textSecondary" tabular>
                {formatInt(e.kcal)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <EditorFooter
        label={meal ? `Copy to ${where}’s ${MEAL_LABEL[slot].toLowerCase()}` : `Copy to ${where}`}
        trailing={`${formatInt(totals.kcal)} kcal`}
        onPress={copy}
        error={!logs.isPending && entries.length === 0 ? 'There’s nothing to copy here.' : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: space.xxl },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: gutter, gap: space.md },
  headerText: { flex: 1, gap: 3 },
  body: { paddingHorizontal: gutter, paddingTop: space.xl, paddingBottom: space.xl, gap: space.xl },
  group: { gap: space.sm },
  dayRow: { flexDirection: 'row' },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 2, borderTopWidth: StyleSheet.hairlineWidth * 2 },
  itemName: { flex: 1 },
});
