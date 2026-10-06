import { useEffect } from 'react';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { motion } from '@/theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type ProgressRingProps = {
  size: number;
  stroke: number;
  /** 0–1; animates whenever it changes. */
  fraction: number;
  color: string;
  trackColor: string;
  /** Dashed track for days that haven't happened yet. */
  dashed?: boolean;
};

/** A small circular progress ring, filled clockwise from 12 o'clock. */
export function ProgressRing({ size, stroke, fraction, color, trackColor, dashed }: ProgressRingProps) {
  const reduced = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const progress = useSharedValue(0);

  useEffect(() => {
    const target = Math.min(1, Math.max(0, fraction));
    progress.set(reduced ? target : withTiming(target, { duration: motion.fill, easing: Easing.out(Easing.cubic) }));
  }, [fraction, reduced, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.get()),
    opacity: progress.get() > 0.003 ? 1 : 0,
  }));

  return (
    <Svg width={size} height={size}>
      <Circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke={trackColor}
        strokeWidth={dashed ? 1.2 : stroke}
        strokeDasharray={dashed ? [2.2, 3.1] : undefined}
      />
      <AnimatedCircle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={[circumference, circumference]}
        transform={`rotate(-90 ${c} ${c})`}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}
