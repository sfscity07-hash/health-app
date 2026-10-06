import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useTheme } from '@/theme/theme';

export type Burst = { id: number; x: number; y: number };

type Piece = { angle: number; speed: number; spin: number; delay: number; color: string; w: number };

function Particle({ x, y, piece }: { x: number; y: number; piece: Piece }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withDelay(piece.delay, withTiming(1, { duration: 1300, easing: Easing.out(Easing.quad) })));
  }, [t, piece.delay]);
  const style = useAnimatedStyle(() => {
    const p = t.get();
    return {
      opacity: p === 0 ? 0 : 1 - p * p,
      transform: [
        { translateX: Math.cos(piece.angle) * piece.speed * p },
        { translateY: Math.sin(piece.angle) * piece.speed * p + 320 * p * p },
        { rotate: `${piece.spin * p}deg` },
      ],
    };
  });
  return <Animated.View style={[styles.piece, { left: x, top: y, width: piece.w, backgroundColor: piece.color }, style]} />;
}

/** A short burst of confetti from a point, in the app's palette. Skipped when motion is reduced. */
export function Confetti({ burst }: { burst: Burst | null }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const pieces = useMemo<Piece[]>(() => {
    if (!burst) return [];
    const palette = [colors.accent, colors.protein, colors.carbs, colors.fat, colors.flame];
    // Deterministic per burst so re-renders don't reshuffle the pieces mid-flight.
    let seed = burst.id * 9301 + 49297;
    const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    return Array.from({ length: 30 }, (_, i) => ({
      angle: -Math.PI / 2 + (rand() - 0.5) * Math.PI * 1.25,
      speed: 90 + rand() * 140,
      spin: (rand() - 0.5) * 900,
      delay: rand() * 60,
      color: palette[i % palette.length],
      w: 5 + rand() * 3,
    }));
  }, [burst, colors]);

  if (!burst || reduced) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <Particle key={`${burst.id}-${i}`} x={burst.x} y={burst.y} piece={p} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', height: 9, borderRadius: 2 },
});
