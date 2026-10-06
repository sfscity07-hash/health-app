import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useTheme } from '@/theme/theme';
import { motion } from '@/theme/tokens';

/** A thin progress bar whose fill slides to its new length on the UI thread. */
export function AnimatedBar({ fraction, color, height = 4 }: { fraction: number; color: string; height?: number }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const width = useSharedValue(0);

  useEffect(() => {
    const target = Math.min(1, Math.max(0, fraction)) * 100;
    width.set(reduced ? target : withTiming(target, { duration: motion.fill, easing: Easing.out(Easing.cubic) }));
  }, [fraction, reduced, width]);

  const fill = useAnimatedStyle(() => ({ width: `${width.get()}%` }));

  return (
    <View style={[styles.track, { height, borderRadius: height, backgroundColor: colors.surface3 }]}>
      <Animated.View style={[styles.fill, { borderRadius: height, backgroundColor: color }, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { overflow: 'hidden' },
  fill: { height: '100%' },
});
