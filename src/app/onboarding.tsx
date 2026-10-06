import { useMemo, useReducer, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInLeft, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { StepProgress } from '@/components/ui/StepProgress';
import { Text } from '@/components/ui/Text';
import { buildPlan, emptyDraft, parseNumber, stepError, stepsFor, type OnboardingDraft, type Step } from '@/features/onboarding/draft';
import { CALORIE_RANGE, RevealStep } from '@/features/onboarding/RevealStep';
import { AboutStep, ActivityStep, BodyStep, GoalStep, TargetStep, type StepProps } from '@/features/onboarding/steps';
import { useSaveOnboarding } from '@/features/profile/api';
import { authErrorMessage } from '@/features/auth/errors';
import { success } from '@/lib/haptics';
import { macroTargets } from '@/lib/nutrition';
import { supabase } from '@/lib/supabase';
import { cmToFeetInches, feetInchesToCm, kgToLb, lbToKg } from '@/lib/units';
import { useTheme } from '@/theme/theme';
import { gutter, space } from '@/theme/tokens';
import type { UnitSystem } from '@/types/profile';

const COPY: Record<Step, { eyebrow: string; title: string; subtitle?: string }> = {
  goal: { eyebrow: "Let's set you up", title: "What's your goal?", subtitle: 'Fuel builds your daily calories and macros around it.' },
  about: { eyebrow: 'About you', title: 'A bit about you', subtitle: 'Used only to estimate how much energy your body burns at rest.' },
  body: { eyebrow: 'Your body', title: 'Height and weight', subtitle: "Today's weight becomes the first point on your trend line." },
  activity: {
    eyebrow: 'Activity',
    title: 'How active is a typical day?',
    subtitle: 'Pick the closest match. Your weekly check-in corrects it from real data.',
  },
  target: { eyebrow: 'Your target', title: 'Where are you heading?', subtitle: 'Choose a goal weight and a pace you can keep up.' },
  reveal: { eyebrow: 'Your plan', title: 'Your daily budget' },
};

type Action =
  | { type: 'set'; key: keyof OnboardingDraft; value: OnboardingDraft[keyof OnboardingDraft] }
  | { type: 'units'; units: UnitSystem };

const oneDecimal = (n: number) => String(Math.round(n * 10) / 10);

function reducer(d: OnboardingDraft, a: Action): OnboardingDraft {
  if (a.type === 'set') return { ...d, [a.key]: a.value };
  if (a.units === d.units) return d;
  // Convert what's already typed so switching units never loses your answers.
  const toImperial = a.units === 'imperial';
  const convertWeight = (s: string) => {
    const n = parseNumber(s);
    return n === null ? s : oneDecimal(toImperial ? kgToLb(n) : lbToKg(n));
  };
  const next: OnboardingDraft = { ...d, units: a.units, weight: convertWeight(d.weight), goalWeight: convertWeight(d.goalWeight) };
  if (toImperial) {
    const cm = parseNumber(d.heightCm);
    if (cm !== null) {
      const { feet, inches } = cmToFeetInches(cm);
      next.heightFt = String(feet);
      next.heightIn = String(inches);
    }
  } else {
    const ft = parseNumber(d.heightFt);
    const inches = d.heightIn.trim() === '' ? 0 : parseNumber(d.heightIn);
    if (ft !== null && inches !== null) next.heightCm = String(Math.round(feetInchesToCm(ft, inches)));
  }
  return next;
}

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [draft, dispatch] = useReducer(reducer, emptyDraft);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [showError, setShowError] = useState(false);
  const save = useSaveOnboarding();

  const steps = stepsFor(draft.goal);
  const step = steps[Math.min(index, steps.length - 1)];
  const error = stepError(step, draft);
  const today = useMemo(() => new Date(), []);
  const plan = useMemo(() => (step === 'reveal' ? buildPlan(draft, today) : null), [step, draft, today]);

  // The budget can be nudged on the reveal step (kept as an offset from the
  // suggestion, so it resets cleanly if you go back and change an answer).
  const [adjustment, setAdjustment] = useState(0);
  const finalCalories = plan
    ? Math.min(CALORIE_RANGE.max, Math.max(CALORIE_RANGE.min, plan.target.calories + adjustment))
    : 0;
  const macros = plan ? macroTargets(finalCalories, plan.weightKg) : null;

  function goTo(next: number) {
    setDirection(next > index ? 1 : -1);
    setShowError(false);
    if (step === 'reveal') setAdjustment(0);
    setIndex(next);
  }

  function next() {
    if (stepError(step, draft)) {
      setShowError(true);
      return;
    }
    goTo(index + 1);
  }

  const set: StepProps['set'] = (key, value) => {
    dispatch({ type: 'set', key, value });
    setShowError(false);
  };

  // `patch` is the answer just given, since `draft` won't include it until the next render.
  const autoAdvance: StepProps['autoAdvance'] = (patch) => {
    if (stepError(step, { ...draft, ...patch })) return;
    setTimeout(() => goTo(index + 1), 220);
  };

  async function finish() {
    if (!plan || !macros) return;
    try {
      await save.mutateAsync({ plan, calories: finalCalories, macros, units: draft.units, today });
      success();
    } catch {
      // The error message below the button explains what happened.
    }
  }

  const stepProps: StepProps = { draft, set, setUnits: (units) => dispatch({ type: 'units', units }), autoAdvance };
  const copy = COPY[step];
  const Entering = direction === 1 ? FadeInRight : FadeInLeft;

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        {index > 0 ? (
          <IconButton icon="chevronLeft" label="Back" onPress={() => goTo(index - 1)} />
        ) : (
          <View style={styles.headerSpacer} />
        )}
        <StepProgress total={steps.length} current={index} />
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Animated.View key={step} entering={Entering.duration(260)} style={styles.step}>
          <View style={styles.titles}>
            <Text variant="label" color="accent">
              {copy.eyebrow}
            </Text>
            <Text variant="title" accessibilityRole="header">
              {copy.title}
            </Text>
            {copy.subtitle ? (
              <Text variant="body" color="textSecondary">
                {copy.subtitle}
              </Text>
            ) : null}
          </View>
          {step === 'goal' && <GoalStep {...stepProps} />}
          {step === 'about' && <AboutStep {...stepProps} />}
          {step === 'body' && <BodyStep {...stepProps} />}
          {step === 'activity' && <ActivityStep {...stepProps} />}
          {step === 'target' && <TargetStep {...stepProps} />}
          {step === 'reveal' && plan && macros ? (
            <RevealStep plan={plan} units={draft.units} calories={finalCalories} macros={macros} onChangeCalories={(c) => setAdjustment(c - plan.target.calories)} />
          ) : null}
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
        {showError && error ? (
          <Text variant="small" color="warn" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        {save.isError ? (
          <Text variant="small" color="warn" accessibilityLiveRegion="polite">
            {authErrorMessage(save.error)}
          </Text>
        ) : null}
        {step === 'reveal' ? (
          <Button label="Start tracking" loading={save.isPending} onPress={finish} />
        ) : (
          <Button label="Continue" onPress={next} />
        )}
        {index === 0 ? (
          <Button label="Use a different account" variant="ghost" onPress={() => supabase?.auth.signOut()} />
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingHorizontal: gutter, paddingBottom: space.sm },
  headerSpacer: { width: 40 },
  content: { paddingHorizontal: gutter, paddingTop: space.xl, paddingBottom: space.xxl },
  step: { gap: space.xxl },
  titles: { gap: space.sm },
  footer: { paddingHorizontal: gutter, paddingTop: space.md, gap: space.sm },
});
