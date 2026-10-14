import { useEffect, type PropsWithChildren } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { Card } from '@/components/ui/Card';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

/**
 * Placeholders in the shape of what's loading, instead of a spinner. The whole
 * group breathes together (or holds still with Reduce motion on), and reads as
 * one "Loading" to a screen reader.
 */
export function SkeletonGroup({ label = 'Loading', style, children }: PropsWithChildren<{ label?: string; style?: StyleProp<ViewStyle> }>) {
  const reduce = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduce) {
      cancelAnimation(pulse);
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(withTiming(1, { duration: 850, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(pulse);
  }, [reduce, pulse]);
  const breathe = useAnimatedStyle(() => ({ opacity: 1 - pulse.value * 0.45 }));
  return (
    <Animated.View
      style={[styles.group, breathe, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}>
      {children}
    </Animated.View>
  );
}

/** One placeholder line or block. */
export function Bone({ width = '100%', height = 12, round = 6, style }: { width?: DimensionValue; height?: number; round?: number; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[{ width, height, borderRadius: round, backgroundColor: colors.surface2 }, style]} />;
}

/** A card with a title line and a few rows, in the shape of a meal or a list. */
export function CardSkeleton({ rows = 2, style }: { rows?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Card style={[styles.card, style]}>
      <View style={styles.head}>
        <Bone width="34%" height={14} />
        <Bone width={56} height={12} />
      </View>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.row}>
          <View style={styles.rowText}>
            <Bone width={i % 2 ? '52%' : '68%'} height={12} />
            <Bone width="30%" height={10} />
          </View>
          <Bone width={44} height={12} />
        </View>
      ))}
    </Card>
  );
}

/** Rows like a list of foods: name, a detail line and the + button. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <SkeletonGroup>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={[styles.row, styles.listRow]}>
          <View style={styles.rowText}>
            <Bone width={i % 2 ? '48%' : '64%'} height={13} />
            <Bone width="36%" height={10} />
          </View>
          <Bone width={34} height={34} round={17} />
        </View>
      ))}
    </SkeletonGroup>
  );
}

/** A food or entry screen while it opens: name, amount and the ruler. */
export function FoodSkeleton() {
  return (
    <SkeletonGroup>
      <Bone width="62%" height={22} />
      <Bone width="38%" height={12} />
      <View style={styles.amount}>
        <Bone width={120} height={40} round={10} />
        <Bone width="70%" height={12} />
      </View>
      <Bone height={64} round={12} />
      <Bone height={88} round={16} />
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  listRow: { paddingVertical: space.xs },
  amount: { alignItems: 'center', gap: space.sm, paddingVertical: space.lg },
  group: { gap: space.md },
  card: { padding: space.lg, gap: space.md },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowText: { flex: 1, gap: 6 },
});
