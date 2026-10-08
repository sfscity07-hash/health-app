import { useEffect, useMemo } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { Text } from '@/components/ui/Text';
import { tick } from '@/lib/haptics';
import { formatQty, type PortionUnit } from '@/lib/portion';
import { useTheme } from '@/theme/theme';

const SPRING = { damping: 22, stiffness: 240, mass: 0.7 };
const FADE = 64;

/** What the ruler measures: a portion unit, or any scale such as body weight. */
export type RulerScale = Pick<PortionUnit, 'label' | 'step' | 'max' | 'spacing' | 'major'> & {
  /** Where the ruler starts (0 for portions; e.g. 62 for a weight ruler). */
  min?: number;
};

type PortionRulerProps = {
  unit: RulerScale;
  value: number;
  onChange: (value: number) => void;
  /** Color behind the ruler, used for the fade at its edges. */
  background: string;
};

/**
 * A ruler you drag to set an amount. It follows your finger on the UI thread
 * and ticks (with a haptic) at each step, like a physical scale dial.
 */
export function PortionRuler({ unit, value, onChange, background }: PortionRulerProps) {
  const { colors } = useTheme();
  const { step, spacing, max, major } = unit;
  const min = unit.min ?? 0;
  // Portions can't be zero, so a ruler starting at 0 stops at one step.
  const floor = min === 0 ? step : min;
  const width = useSharedValue(0);
  const offset = useSharedValue(0);
  const start = useSharedValue(0);
  const current = useSharedValue(value);
  const dragging = useSharedValue(false);

  // Follow changes made elsewhere (typing a number, switching units, the −/+ buttons).
  useEffect(() => {
    current.set(value);
    if (!dragging.get() && width.get() > 0) {
      offset.set(withSpring(width.get() / 2 - ((value - min) / step) * spacing, SPRING));
    }
  }, [value, step, spacing, min, current, dragging, width, offset]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    width.set(w);
    offset.set(w / 2 - ((current.get() - min) / step) * spacing);
  };

  const emit = (v: number) => {
    tick();
    onChange(v);
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-4, 4])
    .failOffsetY([-14, 14])
    .onBegin(() => {
      dragging.set(true);
      start.set(offset.get());
    })
    .onUpdate((e) => {
      const center = width.get() / 2;
      const highest = center - ((floor - min) / step) * spacing; // position of the smallest allowed value
      const lowest = center - ((max - min) / step) * spacing;
      const next = Math.min(highest, Math.max(lowest, start.get() + e.translationX));
      offset.set(next);
      const snapped = Math.round((min + Math.round((center - next) / spacing) * step) * 100) / 100;
      if (snapped !== current.get()) {
        current.set(snapped);
        scheduleOnRN(emit, snapped);
      }
    })
    .onFinalize(() => {
      dragging.set(false);
      offset.set(withSpring(width.get() / 2 - ((current.get() - min) / step) * spacing, SPRING));
    });

  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));

  const ticks = useMemo(() => {
    const count = Math.round((max - min) / step);
    return Array.from({ length: count + 1 }, (_, i) => {
      const isMajor = i % major === 0;
      return (
        <View key={i} style={[styles.tick, { left: i * spacing }, isMajor ? styles.major : null]}>
          <View style={[styles.line, { height: isMajor ? 22 : 12, backgroundColor: isMajor ? colors.textSecondary : colors.textTertiary }]} />
          {isMajor ? (
            <Text variant="label" style={styles.tickLabel}>
              {formatQty(min + i * step)}
            </Text>
          ) : null}
        </View>
      );
    });
  }, [max, min, step, major, spacing, colors]);

  return (
    <GestureDetector gesture={pan}>
      <View
        style={styles.root}
        onLayout={onLayout}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Amount"
        accessibilityValue={{ text: `${formatQty(value)} ${unit.label}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          const next = e.nativeEvent.actionName === 'increment' ? value + step : value - step;
          onChange(Math.min(max, Math.max(floor, Math.round(next * 100) / 100)));
        }}>
        <Animated.View style={[styles.ticks, slide]}>{ticks}</Animated.View>
        <Svg pointerEvents="none" width={FADE} height="100%" style={styles.fadeLeft}>
          <Defs>
            <LinearGradient id="rulerFadeL" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={background} stopOpacity={1} />
              <Stop offset="1" stopColor={background} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#rulerFadeL)" />
        </Svg>
        <Svg pointerEvents="none" width={FADE} height="100%" style={styles.fadeRight}>
          <Defs>
            <LinearGradient id="rulerFadeR" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={background} stopOpacity={0} />
              <Stop offset="1" stopColor={background} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#rulerFadeR)" />
        </Svg>
        <View pointerEvents="none" style={[styles.needle, { backgroundColor: colors.accent, shadowColor: colors.accent }]} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { height: 64, overflow: 'hidden' },
  ticks: { position: 'absolute', top: 8, left: 0, height: 56 },
  tick: { position: 'absolute', top: 0, width: 24, marginLeft: -12, alignItems: 'center' },
  major: {},
  line: { width: 1.5, borderRadius: 1 },
  tickLabel: { marginTop: 6 },
  fadeLeft: { position: 'absolute', left: 0, top: 0 },
  fadeRight: { position: 'absolute', right: 0, top: 0 },
  needle: {
    position: 'absolute',
    left: '50%',
    marginLeft: -1.5,
    top: 3,
    width: 3,
    height: 34,
    borderRadius: 2,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 3,
  },
});
