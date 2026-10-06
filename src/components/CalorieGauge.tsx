import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useTheme } from '@/theme/theme';
import { motion } from '@/theme/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const START = 135;
const SWEEP = 270;
const TICKS = 54;

type CalorieGaugeProps = {
  /** How full the arc is, 0–1. Animates whenever it changes. */
  fraction: number;
  size?: number;
  /** Over budget turns the arc orange. */
  over?: boolean;
  children?: ReactNode;
};

/**
 * The 270° instrument gauge from the design. The arc and its end point
 * animate on the UI thread, so they stay smooth even while the app is busy.
 */
export function CalorieGauge({ fraction, size = 240, over = false, children }: CalorieGaugeProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const c = size / 2;
  const r = size / 2 - 26;
  const arcLength = 2 * Math.PI * r * (SWEEP / 360);
  const point = (deg: number, radius: number) => {
    const a = (deg * Math.PI) / 180;
    return [c + radius * Math.cos(a), c + radius * Math.sin(a)] as const;
  };
  const [x1, y1] = point(START, r);
  const [x2, y2] = point(START + SWEEP, r);
  const arc = `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 1 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  const tone = over ? colors.warn : colors.accent;

  const progress = useSharedValue(0);
  useEffect(() => {
    const target = Math.min(1, Math.max(0, fraction));
    progress.set(reduced ? target : withTiming(target, { duration: motion.fill, easing: Easing.out(Easing.cubic) }));
  }, [fraction, reduced, progress]);

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: arcLength * (1 - progress.get()),
    opacity: progress.get() > 0.004 ? 1 : 0,
  }));
  const glowProps = useAnimatedProps(() => ({
    strokeDashoffset: arcLength * (1 - progress.get()),
    opacity: progress.get() > 0.004 ? 0.18 : 0,
  }));
  const capProps = useAnimatedProps(() => {
    const a = ((START + SWEEP * progress.get()) * Math.PI) / 180;
    return { cx: c + r * Math.cos(a), cy: c + r * Math.sin(a), opacity: progress.get() > 0.004 ? 1 : 0 };
  });

  return (
    <View style={{ width: size, height: size * 0.88 }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <G>
          {Array.from({ length: TICKS + 1 }, (_, i) => {
            const major = i % 6 === 0;
            const [ax, ay] = point(START + (SWEEP * i) / TICKS, r + (major ? 11 : 14));
            const [bx, by] = point(START + (SWEEP * i) / TICKS, r + 20);
            return (
              <Line
                key={i}
                x1={ax}
                y1={ay}
                x2={bx}
                y2={by}
                stroke={colors.textTertiary}
                strokeOpacity={major ? 0.75 : 0.4}
                strokeWidth={1.2}
                strokeLinecap="round"
              />
            );
          })}
        </G>
        <Path d={arc} fill="none" stroke={colors.surface2} strokeWidth={12} strokeLinecap="round" />
        <AnimatedPath
          d={arc}
          fill="none"
          stroke={tone}
          strokeWidth={24}
          strokeLinecap="round"
          strokeDasharray={[arcLength, arcLength]}
          animatedProps={glowProps}
        />
        <AnimatedPath
          d={arc}
          fill="none"
          stroke={tone}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={[arcLength, arcLength]}
          animatedProps={arcProps}
        />
        <AnimatedCircle r={4} fill="#FFFFFF" animatedProps={capProps} />
      </Svg>
      <View style={[styles.center, { width: size, height: size }]} pointerEvents="none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: 'absolute', top: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
});
