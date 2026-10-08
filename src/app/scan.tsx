import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useFoundFoods } from '@/features/search/api';
import { barcodeProblem, lookupBarcode } from '@/features/search/barcode';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { success, tick } from '@/lib/haptics';
import { useTheme } from '@/theme/theme';
import { gutter, radius, space } from '@/theme/tokens';

const WINDOW_W = 280;
const WINDOW_H = 168;
const MASK = 'rgba(0,0,0,0.62)';
const WHITE = '#FFFFFF';

type Phase =
  | { kind: 'scanning' }
  | { kind: 'typing' }
  | { kind: 'looking'; code: string }
  | { kind: 'missing'; code: string }
  | { kind: 'incomplete'; code: string; name: string | null; brand: string | null }
  | { kind: 'error'; code: string };

/** The line that sweeps the scan window, so it's clear the camera is reading. */
function ScanLine() {
  const reduced = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (!reduced) y.set(withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [reduced, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: 12 + y.get() * (WINDOW_H - 24) }] }));
  const { colors } = useTheme();
  return <Animated.View pointerEvents="none" style={[styles.line, { backgroundColor: colors.accent, shadowColor: colors.accent }, style]} />;
}

/** The four corner brackets of the scan window. */
function Corners() {
  return (
    <>
      <View style={[styles.corner, styles.tl]} />
      <View style={[styles.corner, styles.tr]} />
      <View style={[styles.corner, styles.bl]} />
      <View style={[styles.corner, styles.br]} />
    </>
  );
}

/**
 * Point the camera at a barcode. Your own foods come up instantly, then
 * Open Food Facts and USDA; if nobody knows it, you can create it with the
 * barcode filled in. You can also type the number.
 */
export default function ScanScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ date?: string; meal?: string }>();
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const keepFound = useFoundFoods((s) => s.keep);
  const [phase, setPhase] = useState<Phase>({ kind: 'scanning' });
  const [torch, setTorch] = useState(false);
  const [typed, setTyped] = useState('');
  const [typedError, setTypedError] = useState<string | null>(null);
  const busy = useRef(false);
  const lookup = useRef<AbortController | null>(null);

  // Leaving the screen cancels a lookup, so it can't navigate somewhere afterwards.
  useEffect(() => () => lookup.current?.abort(), []);

  const date = params.date ?? '';
  const meal = params.meal ?? '';
  const granted = Boolean(permission?.granted);
  const scanning = phase.kind === 'scanning';

  async function lookUp(code: string) {
    if (busy.current) return;
    busy.current = true;
    tick();
    setPhase({ kind: 'looking', code });
    const controller = new AbortController();
    lookup.current = controller;
    try {
      const result = await lookupBarcode(code, controller.signal);
      if (controller.signal.aborted) return;
      if (result.kind === 'saved') {
        success();
        router.replace({ pathname: '/food/[id]', params: { id: result.foodId, date, meal } });
      } else if (result.kind === 'found') {
        success();
        keepFound(result.food);
        router.replace({ pathname: '/food/preview', params: { key: result.food.key, date, meal } });
      } else if (result.kind === 'incomplete') {
        setPhase({ kind: 'incomplete', code, name: result.name, brand: result.brand });
      } else {
        setPhase({ kind: 'missing', code });
      }
    } catch {
      if (!controller.signal.aborted) setPhase({ kind: 'error', code });
    }
  }

  function scanAgain() {
    busy.current = false;
    setPhase({ kind: 'scanning' });
  }

  function onScanned(result: BarcodeScanningResult) {
    const code = result.data.replace(/\D/g, '');
    if (code.length >= 8) lookUp(code);
  }

  function submitTyped() {
    const code = typed.replace(/\s/g, '');
    const problem = barcodeProblem(code);
    if (problem) {
      setTypedError(problem);
      return;
    }
    lookUp(code);
  }

  function createFood(code: string, name?: string | null) {
    router.replace({ pathname: '/food/new', params: { date, meal, barcode: code, name: name ?? '' } });
  }

  const sheet = (() => {
    switch (phase.kind) {
      case 'looking':
        return (
          <View style={styles.row}>
            <ActivityIndicator color={colors.accent} />
            <Text variant="bodyStrong">Looking up {phase.code}…</Text>
          </View>
        );
      case 'missing':
        return (
          <>
            <Text variant="heading">Nobody knows this one yet</Text>
            <Text variant="small" color="textSecondary">
              Barcode {phase.code} isn’t in your foods, Open Food Facts or USDA. Add it once from the label and it’ll scan straight away next time.
            </Text>
            <Button label="Create this food" icon="plus" onPress={() => createFood(phase.code)} />
            <Button label="Scan again" variant="ghost" onPress={scanAgain} />
          </>
        );
      case 'incomplete':
        return (
          <>
            <Text variant="heading">{phase.name ? `Found ${phase.name}` : 'Found it'}, but no nutrition</Text>
            <Text variant="small" color="textSecondary">
              {phase.brand ? `${phase.brand} · ` : ''}It’s listed on Open Food Facts without calories and macros. Copy them from the label once and it’s saved for next time.
            </Text>
            <Button label="Add the label" icon="plus" onPress={() => createFood(phase.code, phase.name)} />
            <Button label="Scan again" variant="ghost" onPress={scanAgain} />
          </>
        );
      case 'error':
        return (
          <>
            <Text variant="heading">Couldn’t look it up</Text>
            <Text variant="small" color="textSecondary">
              The food databases didn’t answer. Check your connection and try again.
            </Text>
            <Button
              label="Try again"
              onPress={() => {
                busy.current = false;
                lookUp(phase.code);
              }}
            />
            <Button label="Scan again" variant="ghost" onPress={scanAgain} />
          </>
        );
      case 'typing':
        return (
          <>
            <TextField
              label="Barcode number"
              value={typed}
              onChangeText={(v) => {
                setTyped(v);
                setTypedError(null);
              }}
              keyboardType="number-pad"
              placeholder="e.g. 5000159484695"
              autoFocus
              maxLength={14}
              error={typedError}
              onSubmitEditing={submitTyped}
            />
            <Button label="Look it up" onPress={submitTyped} disabled={typed.trim().length < 8} />
            {granted ? <Button label="Use the camera" variant="ghost" onPress={() => setPhase({ kind: 'scanning' })} /> : null}
          </>
        );
      default:
        if (permission && !granted) {
          return permission.canAskAgain ? (
            <>
              <Text variant="heading">Scan barcodes with your camera</Text>
              <Text variant="small" color="textSecondary">
                Fuel only reads the barcode. Nothing is recorded or saved.
              </Text>
              <Button label="Allow camera" icon="scan" onPress={() => requestPermission()} />
              <Button label="Type the number instead" variant="ghost" onPress={() => setPhase({ kind: 'typing' })} />
            </>
          ) : (
            <>
              <Text variant="heading">Camera is off for Fuel</Text>
              <Text variant="small" color="textSecondary">
                Turn it on in your phone’s settings to scan barcodes, or type the number under the bars.
              </Text>
              <Button label="Open settings" onPress={() => Linking.openSettings()} />
              <Button label="Type the number instead" variant="ghost" onPress={() => setPhase({ kind: 'typing' })} />
            </>
          );
        }
        return <Button label="Type the number instead" variant="secondary" onPress={() => setPhase({ kind: 'typing' })} />;
    }
  })();

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />
      {granted && focused ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
          onBarcodeScanned={scanning ? onScanned : undefined}
        />
      ) : null}

      {/* Dark mask with a clear window in the middle. */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.mask, styles.maskTop]} />
        <View style={styles.middle}>
          <View style={[styles.mask, styles.flex]} />
          <View style={styles.window}>
            <Corners />
            {granted && scanning ? <ScanLine /> : null}
          </View>
          <View style={[styles.mask, styles.flex]} />
        </View>
        <View style={[styles.mask, styles.maskBottom]}>
          <Text variant="small" style={styles.hint} align="center">
            {granted ? 'Line up the barcode inside the frame' : 'Barcode scanner'}
          </Text>
        </View>
      </View>

      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <IconButton icon="close" label="Close" onPress={() => router.back()} />
        <Text variant="smallStrong" style={styles.title}>
          Scan a barcode
        </Text>
        {granted ? (
          <IconButton
            icon="bolt"
            label={torch ? 'Turn torch off' : 'Turn torch on'}
            accessibilityState={{ selected: torch }}
            iconColor={torch ? 'carbs' : 'text'}
            filled={torch}
            onPress={() => setTorch((t) => !t)}
          />
        ) : (
          <View style={styles.spacer} />
        )}
      </View>

      <View style={[styles.sheet, { backgroundColor: colors.surface1, paddingBottom: insets.bottom + space.lg }]}>
        {phase.kind === 'scanning' && granted ? (
          <View style={styles.row}>
            <Icon name="scan" size={18} color="accent" />
            <Text variant="small" color="textSecondary" style={styles.flex}>
              Works with the barcodes on packaged food. Your own foods come up first.
            </Text>
          </View>
        ) : null}
        {sheet}
      </View>
    </KeyboardAvoidingView>
  );
}

const CORNER = 26;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  flex: { flex: 1 },
  mask: { backgroundColor: MASK },
  maskTop: { flex: 0.8 },
  maskBottom: { flex: 1.4, paddingTop: space.lg, paddingHorizontal: gutter },
  middle: { flexDirection: 'row', height: WINDOW_H },
  window: { width: WINDOW_W, height: WINDOW_H, borderRadius: radius.lg, overflow: 'hidden' },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: WHITE },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: radius.lg },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: radius.lg },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: radius.lg },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: radius.lg },
  line: { position: 'absolute', left: 14, right: 14, height: 2, borderRadius: 1, shadowOpacity: 0.9, shadowRadius: 8, elevation: 4 },
  hint: { color: WHITE, opacity: 0.85 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: gutter - 4 },
  title: { color: WHITE },
  spacer: { width: 40 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: gutter,
    paddingTop: space.lg,
    gap: space.sm + 2,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
