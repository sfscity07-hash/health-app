import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { relativeDay } from '@/components/foodlog/DayNav';
import { AnimatedBar } from '@/components/ui/AnimatedBar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { ToastHost } from '@/components/ui/ToastHost';
import { emptyDay, useDaySummaries } from '@/features/dashboard/api';
import { useProfile, useUpdateProfile } from '@/features/profile/api';
import { useAddWater, useDeleteWater, useWaterLogs } from '@/features/water/api';
import {
  drinkUnit,
  formatDrink,
  formatLeft,
  formatVolume,
  MAX_GOAL_ML,
  MIN_GOAL_ML,
  parseDrink,
  reachesGoal,
  stepGoal,
  totalValue,
  volumeUnit,
  waterPresets,
} from '@/features/water/logic';
import { toISODate } from '@/lib/dates';
import { success, tick } from '@/lib/haptics';
import { useToast } from '@/store/toast';
import { useTheme } from '@/theme/theme';
import { gutter, radius, space } from '@/theme/tokens';

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** A day's water: one-tap amounts, any amount you type, each drink (to undo one), and your daily goal. */
export default function WaterSheet() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ date?: string }>();
  const today = toISODate(new Date());
  const date = params.date || today;
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const summary = useDaySummaries(date, date);
  const drinks = useWaterLogs(date);
  const addWater = useAddWater();
  const deleteWater = useDeleteWater();
  const showToast = useToast((s) => s.show);
  const [other, setOther] = useState('');
  const [error, setError] = useState<string | null>(null);

  const units = profile?.units ?? 'metric';
  const goal = profile?.water_goal_ml ?? 2500;
  const total = (summary.data?.[date] ?? emptyDay(date)).water_ml;
  const presets = waterPresets(units);
  const left = Math.max(0, goal - total);
  const count = (drinks.data ?? []).length;

  function add(ml: number) {
    addWater.mutate({ date, ml });
    if (reachesGoal(total, ml, goal)) {
      success();
      showToast(`Water goal hit · ${formatVolume(total + ml, units)}`);
    } else {
      tick();
    }
  }

  function addOther() {
    const parsed = parseDrink(other, units);
    if (!parsed.ok) return setError(parsed.error);
    add(parsed.ml);
    setOther('');
    setError(null);
  }

  function changeGoal(direction: 1 | -1) {
    const next = stepGoal(goal, direction, units);
    if (next !== goal) {
      tick();
      updateProfile.mutate({ water_goal_ml: next });
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.surface1, paddingTop: Platform.OS === 'web' ? insets.top + space.lg : space.xxl }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="label">{relativeDay(date, today)}</Text>
          <Text variant="title" accessibilityRole="header">
            Water
          </Text>
        </View>
        <IconButton icon="close" label="Close" size={36} onPress={() => router.back()} />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 96 }]}>
        <View
          style={styles.total}
          accessible
          accessibilityLabel={`${formatVolume(total, units)} of ${formatVolume(goal, units)}${left === 0 ? ', goal hit' : ''}`}>
          <View style={styles.totalRow}>
            <Text variant="display" tabular>
              {totalValue(total, units)}
            </Text>
            <Text variant="heading" color="textSecondary">
              {volumeUnit(units)}
            </Text>
          </View>
          <Text variant="small" color={left === 0 ? 'good' : 'textSecondary'}>
            {left === 0 ? `Goal hit · ${formatVolume(goal, units)}` : `${formatLeft(left, units)} to go of ${formatVolume(goal, units)}`}
          </Text>
          <View style={styles.bar}>
            <AnimatedBar fraction={goal > 0 ? total / goal : 0} color={colors.water} height={10} />
          </View>
        </View>

        <View style={styles.presets}>
          {presets.map((p) => (
            <PressableScale
              key={p.label}
              accessibilityRole="button"
              accessibilityLabel={`Add ${p.label.toLowerCase()}, ${formatDrink(p.ml, units)}`}
              pressedScale={0.94}
              onPress={() => add(p.ml)}
              style={[styles.preset, { backgroundColor: colors.surface2, borderColor: colors.hairline }]}>
              <Icon name="drop" size={18} color="water" />
              <Text variant="bodyStrong">+{formatDrink(p.ml, units)}</Text>
              <Text variant="caption" color="textSecondary">
                {p.label}
              </Text>
            </PressableScale>
          ))}
        </View>

        <View style={styles.otherRow}>
          <TextField
            label="Another amount"
            value={other}
            onChangeText={(v) => {
              setOther(v);
              setError(null);
            }}
            onSubmitEditing={addOther}
            keyboardType="decimal-pad"
            suffix={drinkUnit(units)}
            placeholder={units === 'imperial' ? '12' : '330'}
            flex
          />
          <Button label="Add" variant="secondary" onPress={addOther} />
        </View>
        {error ? (
          <Text variant="small" color="warn" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        <View>
          <View style={styles.sectionHead}>
            <Text variant="label">{date === today ? 'Today' : relativeDay(date, today)}</Text>
            <Text variant="label">
              {count} drink{count === 1 ? '' : 's'}
            </Text>
          </View>
          {(drinks.data ?? []).length === 0 && !drinks.isPending ? (
            <Text variant="small" color="textSecondary" style={styles.empty}>
              Nothing yet. Tap an amount above, or the Water tile on the dashboard to add a glass.
            </Text>
          ) : null}
          {[...(drinks.data ?? [])].reverse().map((d, i) => (
            <View key={d.id} style={[styles.drink, i > 0 && { borderTopColor: colors.hairline, borderTopWidth: StyleSheet.hairlineWidth * 2 }]}>
              <Icon name="drop" size={15} color="water" />
              <Text variant="body" style={styles.drinkAmount} tabular>
                {formatDrink(d.amount_ml, units)}
              </Text>
              <Text variant="caption" color="textTertiary" tabular>
                {timeOf(d.logged_at)}
              </Text>
              <IconButton
                icon="close"
                label={`Remove ${formatDrink(d.amount_ml, units)} from ${timeOf(d.logged_at)}`}
                size={30}
                onPress={() => {
                  if (d.id.startsWith('temp-')) return;
                  tick();
                  deleteWater.mutate({ id: d.id, date, ml: d.amount_ml });
                }}
              />
            </View>
          ))}
        </View>

        <View style={[styles.goal, { backgroundColor: colors.surface2 }]}>
          <View style={styles.goalText}>
            <Text variant="bodyStrong">Daily goal</Text>
            <Text variant="caption" color="textSecondary">
              About 2–3 L suits most adults; more on hot or active days.
            </Text>
          </View>
          <IconButton icon="minus" label="Lower the goal" size={34} onPress={() => changeGoal(-1)} disabled={goal <= MIN_GOAL_ML} />
          <Text variant="bodyStrong" tabular style={styles.goalValue}>
            {formatVolume(goal, units)}
          </Text>
          <IconButton icon="plus" label="Raise the goal" size={34} onPress={() => changeGoal(1)} disabled={goal >= MAX_GOAL_ML} />
        </View>
      </ScrollView>

      <ToastHost bottom={insets.bottom + 24} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: gutter },
  headerText: { flex: 1, gap: 2 },
  body: { paddingHorizontal: gutter, paddingTop: space.xl, gap: space.xl },
  total: { alignItems: 'center', gap: space.xs },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  bar: { alignSelf: 'stretch', marginTop: space.sm },
  presets: { flexDirection: 'row', gap: space.sm },
  preset: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  otherRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.xs },
  empty: { paddingVertical: space.sm },
  drink: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xs },
  drinkAmount: { flex: 1 },
  goal: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.lg },
  goalText: { flex: 1, gap: 2 },
  goalValue: { minWidth: 64, textAlign: 'center' },
});
