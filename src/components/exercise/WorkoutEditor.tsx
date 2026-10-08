import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { EditorFooter } from '@/components/food/EditorFooter';
import { ModalHeader } from '@/components/food/ModalHeader';
import { PortionRuler } from '@/components/food/PortionRuler';
import { relativeDay } from '@/components/foodlog/DayNav';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useDeleteWorkout, useLogWorkout, useUpdateWorkout } from '@/features/exercise/api';
import {
  activeKcal,
  ADDBACK,
  DEFAULT_MINUTES,
  describeDuration,
  DURATION_RULER,
  FALLBACK_KG,
  parseKcal,
  parseMinutes,
  type Activity,
  type Workout,
} from '@/features/exercise/logic';
import { formatInt } from '@/lib/format';
import { success, tap } from '@/lib/haptics';
import { displayWeight } from '@/lib/units';
import { useToast } from '@/store/toast';
import { useTheme } from '@/theme/theme';
import { fonts, gutter, radius, space } from '@/theme/tokens';

type WorkoutEditorProps = {
  date: string;
  today: string;
  /** The activity from the list, or null when you type the calories yourself. */
  activity: Activity | null;
  /** The workout you're changing, if any. */
  existing?: Workout;
  /** Minutes to start at, e.g. from a recent workout. */
  startMinutes?: number;
  kg: number | null;
  units: 'metric' | 'imperial';
  addback: boolean;
};

/** Log a workout: pick how long and see the calories, or type the calories from your watch. */
export function WorkoutEditor({ date, today, activity, existing, startMinutes, kg, units, addback }: WorkoutEditorProps) {
  const { colors } = useTheme();
  const showToast = useToast((s) => s.show);
  const logWorkout = useLogWorkout();
  const updateWorkout = useUpdateWorkout();
  const deleteWorkout = useDeleteWorkout();

  const bodyKg = kg ?? FALLBACK_KG;
  const [minutes, setMinutes] = useState(existing?.duration_min ?? startMinutes ?? DEFAULT_MINUTES);
  const [typingMinutes, setTypingMinutes] = useState<string | null>(null);
  const computed = activity ? activeKcal(activity.met, bodyKg, minutes) : 0;
  // A saved workout whose calories are far from the formula had them typed in (your weight may have moved a little since).
  const typedBefore =
    existing !== undefined &&
    (!activity || !existing.duration_min || Math.abs(existing.kcal_burned - activeKcal(activity.met, bodyKg, existing.duration_min)) > existing.kcal_burned * 0.1 + 5);
  const [ownKcal, setOwnKcal] = useState(activity === null || typedBefore);
  const [kcalText, setKcalText] = useState(existing ? String(existing.kcal_burned) : '');
  const [name, setName] = useState(existing?.name ?? '');
  const [minutesText, setMinutesText] = useState(existing?.duration_min ? String(existing.duration_min) : '');
  const [error, setError] = useState<string | null>(null);

  const typedKcal = parseKcal(kcalText);
  const kcal = ownKcal ? (typedKcal.ok ? typedKcal.kcal : 0) : computed;
  const day = relativeDay(date, today);
  const dayWord = ['Today', 'Yesterday', 'Tomorrow'].includes(day) ? day.toLowerCase() : day;

  function commitMinutes() {
    if (typingMinutes === null) return;
    const parsed = parseMinutes(typingMinutes);
    setTypingMinutes(null);
    if (!parsed.ok) return setError(parsed.error);
    setMinutes(parsed.minutes);
    setError(null);
  }

  function save() {
    let duration: number | null = activity ? minutes : null;
    if (!activity && minutesText.trim()) {
      const m = parseMinutes(minutesText);
      if (!m.ok) return setError(m.error);
      duration = m.minutes;
    }
    if (ownKcal && !typedKcal.ok) return setError(typedKcal.error);
    const label = activity ? activity.name : name.trim() || 'Workout';
    const row = { exercise_id: activity?.id ?? null, name: label.slice(0, 80), duration_min: duration, kcal_burned: kcal };
    if (existing) {
      updateWorkout.mutate({ id: existing.id, date, before: existing.kcal_burned, patch: row });
      showToast('Saved changes');
    } else {
      logWorkout.mutate({ ...row, log_date: date });
      showToast(`Logged ${label}${duration ? ` · ${describeDuration(duration)}` : ''} · ${formatInt(kcal)} kcal`);
    }
    success();
    router.back();
  }

  function remove() {
    if (!existing) return;
    deleteWorkout.mutate({ id: existing.id, date, kcal: existing.kcal_burned });
    tap();
    showToast(`Deleted ${existing.name}`);
    router.back();
  }

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ModalHeader title={existing ? 'Workout' : `Exercise · ${day}`} onClose={() => router.back()} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {activity ? (
          <View style={styles.intro}>
            <Text variant="label">{activity.category}</Text>
            <Text variant="title" accessibilityRole="header">
              {activity.name}
            </Text>
          </View>
        ) : (
          <View style={styles.intro}>
            <Text variant="title" accessibilityRole="header">
              {existing ? existing.name : 'Type your calories'}
            </Text>
            <Text variant="small" color="textSecondary">
              Use the active calories your watch, app or machine shows.
            </Text>
          </View>
        )}

        <View style={styles.kcalBlock} accessible accessibilityLabel={`${formatInt(kcal)} calories burned`}>
          <View style={styles.kcalRow}>
            <AnimatedNumber value={kcal} variant="display" />
            <Text variant="heading" color="textSecondary">
              kcal
            </Text>
          </View>
          <Text variant="caption" color="textSecondary" align="center">
            {ownKcal
              ? 'Typed in'
              : `Active calories for ${displayWeight(bodyKg, units)}${kg === null ? ' (weigh in for a better number)' : ''}`}
          </Text>
        </View>

        {activity ? (
          <View style={styles.group}>
            <View style={styles.valueRow}>
              {typingMinutes !== null ? (
                <TextInput
                  autoFocus
                  value={typingMinutes}
                  onChangeText={setTypingMinutes}
                  onBlur={commitMinutes}
                  onSubmitEditing={commitMinutes}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  accessibilityLabel="Minutes"
                  selectionColor={colors.accent}
                  cursorColor={colors.accent}
                  style={[styles.input, { color: colors.text, borderColor: colors.accent }, Platform.OS === 'web' && styles.noWebOutline]}
                />
              ) : (
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={`${describeDuration(minutes)}. Tap to type the minutes.`}
                  ripple={null}
                  pressedScale={0.96}
                  onPress={() => setTypingMinutes(String(minutes))}
                  style={styles.valueButton}>
                  <Text variant="title" tabular>
                    {describeDuration(minutes)}
                  </Text>
                </PressableScale>
              )}
            </View>
            <PortionRuler
              unit={{ ...DURATION_RULER, max: Math.max(DURATION_RULER.max, Math.ceil(minutes / 30) * 30) }}
              value={minutes}
              onChange={(v) => {
                setMinutes(v);
                setError(null);
              }}
              background={colors.bg}
            />
          </View>
        ) : null}

        {!activity ? (
          <TextField
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Spin class"
            maxLength={80}
          />
        ) : null}

        {ownKcal ? (
          <View style={styles.fields}>
            <TextField
              label="Calories"
              value={kcalText}
              onChangeText={(v) => {
                setKcalText(v);
                setError(null);
              }}
              keyboardType="number-pad"
              suffix="kcal"
              placeholder={activity ? String(computed) : '300'}
              autoFocus={!existing && activity !== null}
              flex
            />
            {!activity ? (
              <TextField
                label="Minutes (optional)"
                value={minutesText}
                onChangeText={(v) => {
                  setMinutesText(v);
                  setError(null);
                }}
                keyboardType="number-pad"
                suffix="min"
                flex
              />
            ) : null}
          </View>
        ) : null}

        {activity ? (
          <Button
            label={ownKcal ? 'Work it out for me instead' : 'Type calories from my watch'}
            variant="ghost"
            onPress={() => {
              if (!ownKcal && !kcalText) setKcalText(String(computed));
              setOwnKcal((v) => !v);
              setError(null);
            }}
          />
        ) : null}

        <View style={[styles.note, { backgroundColor: colors.surface2, borderRadius: radius.md }]}>
          <Text variant="caption" color="textSecondary">
            {addback ? ADDBACK.on : 'Not added to your budget. You can change that on the Exercise screen or in Profile.'}
          </Text>
        </View>
      </ScrollView>

      <EditorFooter
        label={existing ? 'Save changes' : `Add to ${dayWord}`}
        trailing={`${formatInt(kcal)} kcal`}
        onPress={save}
        error={error}
        onDelete={existing ? remove : undefined}
        deleteLabel="Delete workout"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxl, paddingTop: space.sm, gap: space.xl },
  intro: { gap: space.xs },
  kcalBlock: { alignItems: 'center', gap: 2 },
  kcalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  group: { gap: space.sm },
  valueRow: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  valueButton: { paddingHorizontal: space.md, borderRadius: radius.md },
  input: { minWidth: 120, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 28, borderBottomWidth: 2, paddingVertical: 0 },
  noWebOutline: { outlineWidth: 0 },
  fields: { flexDirection: 'row', gap: space.md },
  note: { padding: space.md },
});
