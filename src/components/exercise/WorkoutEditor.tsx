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
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Stepper } from '@/components/ui/Stepper';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useDeleteWorkout, useLogWorkout, useUpdateWorkout } from '@/features/exercise/api';
import {
  defaultSpeed,
  EFFORT_OPTIONS,
  estimateWorkout,
  gaitOf,
  MAX_INCLINE,
  SPEED_RANGE,
  speedFromDisplay,
  speedToDisplay,
  speedUnit,
  type Body,
  type Effort,
} from '@/features/exercise/energy';
import {
  activeKcal,
  ADDBACK,
  DEFAULT_MINUTES,
  describeDuration,
  DURATION_RULER,
  parseKcal,
  parseMinutes,
  type Activity,
  type Workout,
} from '@/features/exercise/logic';
import { parseNumber } from '@/features/onboarding/draft';
import { formatInt } from '@/lib/format';
import { success, tap, tick } from '@/lib/haptics';
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
  /** Where to start, e.g. from a recent workout. */
  start?: Partial<Pick<Workout, 'duration_min' | 'speed_kmh' | 'incline_pct' | 'effort' | 'avg_hr'>>;
  body: Body;
  units: 'metric' | 'imperial';
  addback: boolean;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Log a workout: how long and how hard, and see the calories for your body; or type the calories from your watch. */
export function WorkoutEditor({ date, today, activity, existing, start, body, units, addback }: WorkoutEditorProps) {
  const { colors } = useTheme();
  const showToast = useToast((s) => s.show);
  const logWorkout = useLogWorkout();
  const updateWorkout = useUpdateWorkout();
  const deleteWorkout = useDeleteWorkout();

  const from = existing ?? start ?? {};
  const gait = activity ? gaitOf(activity) : null;
  const [minutes, setMinutes] = useState(from.duration_min ?? DEFAULT_MINUTES);
  const [typingMinutes, setTypingMinutes] = useState<string | null>(null);
  const [speedKmh, setSpeedKmh] = useState(from.speed_kmh ?? (activity ? defaultSpeed(activity) : 5));
  const [incline, setIncline] = useState(from.incline_pct ?? 0);
  const [effort, setEffort] = useState<Effort>(from.effort ?? 'moderate');
  const [hrText, setHrText] = useState(from.avg_hr ? String(from.avg_hr) : '');
  const hrValue = parseNumber(hrText);
  const avgHr = hrValue !== null && hrValue >= 40 && hrValue <= 230 ? Math.round(hrValue) : null;

  const details = { speedKmh: gait ? speedKmh : null, inclinePct: gait ? incline : null, effort: gait ? null : effort, avgHr };
  const estimate = activity ? estimateWorkout(activity, minutes, body, details) : null;

  // A saved workout far from both the old and the new way of working it out had its calories typed in.
  const typedBefore = (() => {
    if (!existing) return false;
    if (!activity || !existing.duration_min) return true;
    const near = (n: number) => Math.abs(existing.kcal_burned - n) <= existing.kcal_burned * 0.1 + 5;
    const now = estimateWorkout(activity, existing.duration_min, body, {
      speedKmh: existing.speed_kmh,
      inclinePct: existing.incline_pct,
      effort: existing.effort,
      avgHr: existing.avg_hr,
    }).kcal;
    return !near(now) && !near(activeKcal(activity.met, body.kg, existing.duration_min));
  })();
  const [ownKcal, setOwnKcal] = useState(activity === null || typedBefore);
  const [kcalText, setKcalText] = useState(existing ? String(existing.kcal_burned) : '');
  const [name, setName] = useState(existing?.name ?? '');
  const [minutesText, setMinutesText] = useState(existing?.duration_min ? String(existing.duration_min) : '');
  const [error, setError] = useState<string | null>(null);

  const typedKcal = parseKcal(kcalText);
  const kcal = ownKcal ? (typedKcal.ok ? typedKcal.kcal : 0) : (estimate?.kcal ?? 0);
  const day = relativeDay(date, today);
  const dayWord = ['Today', 'Yesterday', 'Tomorrow'].includes(day) ? day.toLowerCase() : day;
  const sUnit = speedUnit(units);
  const shownSpeed = round1(speedToDisplay(speedKmh, units));
  const range = gait ? SPEED_RANGE[gait] : SPEED_RANGE.walk;

  /** What went into the number, so it never feels like a black box. */
  const basis = (() => {
    if (ownKcal || !estimate) return 'Typed in';
    const you = [displayWeight(body.kg, units), body.age ? `${body.age} y` : null, body.sex].filter(Boolean).join(', ');
    const how =
      estimate.method === 'heart-rate'
        ? `${avgHr} bpm average`
        : estimate.method === 'speed'
          ? `${shownSpeed} ${sUnit}${incline ? `, ${incline}% incline` : ''}`
          : `${EFFORT_OPTIONS.find((o) => o.value === effort)?.label.toLowerCase()} effort`;
    return `Active calories for ${you} · ${how}${estimate.personal ? '' : ' · add your stats for a closer number'}`;
  })();

  function commitMinutes() {
    if (typingMinutes === null) return;
    const parsed = parseMinutes(typingMinutes);
    setTypingMinutes(null);
    if (!parsed.ok) return setError(parsed.error);
    setMinutes(parsed.minutes);
    setError(null);
  }

  const stepSpeed = (dir: 1 | -1) => {
    tick();
    const next = round1(speedToDisplay(speedKmh, units) + dir * 0.5);
    setSpeedKmh(Math.min(range.max, Math.max(range.min, round1(speedFromDisplay(next, units)))));
  };
  const stepIncline = (dir: 1 | -1) => {
    tick();
    setIncline((i) => Math.min(MAX_INCLINE, Math.max(0, i + dir)));
  };

  function save() {
    let duration: number | null = activity ? minutes : null;
    if (!activity && minutesText.trim()) {
      const m = parseMinutes(minutesText);
      if (!m.ok) return setError(m.error);
      duration = m.minutes;
    }
    if (ownKcal && !typedKcal.ok) return setError(typedKcal.error);
    if (hrText.trim() && avgHr === null) return setError('Heart rate should be between 40 and 230 bpm, or leave it empty.');
    const label = activity ? activity.name : name.trim() || 'Workout';
    // The details only mean something when Fuel worked the number out.
    const used = activity && !ownKcal;
    const detail = {
      speed_kmh: used && gait ? speedKmh : null,
      incline_pct: used && gait ? incline : null,
      effort: used && !gait ? effort : null,
      avg_hr: used ? avgHr : null,
    };
    const base = { exercise_id: activity?.id ?? null, name: label.slice(0, 80), duration_min: duration, kcal_burned: kcal };
    if (existing) {
      // Send a detail when it's set, or when clearing one the workout had (so a database without these columns still works).
      const patch = { ...base } as typeof base & Partial<typeof detail>;
      for (const k of Object.keys(detail) as (keyof typeof detail)[]) {
        if (detail[k] !== null || (existing[k] !== null && existing[k] !== undefined)) (patch as Record<string, unknown>)[k] = detail[k];
      }
      updateWorkout.mutate({ id: existing.id, date, before: existing.kcal_burned, patch });
      showToast('Saved changes');
    } else {
      logWorkout.mutate({ ...base, ...detail, log_date: date });
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

        <View style={styles.kcalBlock} accessible accessibilityLabel={`${formatInt(kcal)} calories burned. ${basis}`}>
          <View style={styles.kcalRow}>
            <AnimatedNumber value={kcal} variant="display" />
            <Text variant="heading" color="textSecondary">
              kcal
            </Text>
          </View>
          <Text variant="caption" color="textSecondary" align="center">
            {basis}
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

        {activity && !ownKcal ? (
          <View style={styles.group}>
            {gait ? (
              <>
                <Stepper
                  label="Speed"
                  value={`${shownSpeed.toFixed(1)} ${sUnit}`}
                  onMinus={() => stepSpeed(-1)}
                  onPlus={() => stepSpeed(1)}
                  minDisabled={speedKmh <= range.min}
                  maxDisabled={speedKmh >= range.max}
                  hint={avgHr ? 'Heart rate is used instead' : undefined}
                />
                <Stepper
                  label="Incline"
                  value={`${incline}%`}
                  onMinus={() => stepIncline(-1)}
                  onPlus={() => stepIncline(1)}
                  minDisabled={incline <= 0}
                  maxDisabled={incline >= MAX_INCLINE}
                  hint="Treadmill or hills"
                />
              </>
            ) : (
              <View style={styles.group}>
                <Text variant="caption" color="textSecondary">
                  How hard{avgHr ? ' (heart rate is used instead)' : ''}
                </Text>
                <SegmentedControl label="Effort" options={EFFORT_OPTIONS} value={effort} onChange={setEffort} />
              </View>
            )}
            <TextField
              label="Average heart rate (optional)"
              value={hrText}
              onChangeText={(v) => {
                setHrText(v);
                setError(null);
              }}
              keyboardType="number-pad"
              suffix="bpm"
              placeholder="From your watch"
              maxLength={3}
            />
          </View>
        ) : null}

        {!activity ? <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. Spin class" maxLength={80} /> : null}

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
              placeholder={estimate ? String(estimate.kcal) : '300'}
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
              if (!ownKcal && !kcalText) setKcalText(String(estimate?.kcal ?? ''));
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
