import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { tap, tick } from '@/lib/haptics';
import { useTheme } from '@/theme/theme';
import { motion, type ColorName } from '@/theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** How far the element shrinks while held. 1 turns the effect off. */
  pressedScale?: number;
  /** Android touch ripple color, drawn natively the instant a finger lands. `null` turns it off. */
  ripple?: ColorName | null;
  haptic?: 'tick' | 'tap' | 'none';
  /** Fire the haptic on touch-down (tab bars, + button) or on release (anything inside a scroll view). */
  hapticOn?: 'pressIn' | 'press';
};

/**
 * The one press primitive for the app. Feedback never waits on app code:
 * the Android ripple is native, and the shrink animation runs on the UI thread.
 */
export function PressableScale({
  style,
  children,
  pressedScale = 0.97,
  ripple = 'ripple',
  haptic = 'none',
  hapticOn = 'press',
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  ...rest
}: PressableScaleProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const buzz = haptic === 'tick' ? tick : haptic === 'tap' ? tap : null;

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      unstable_pressDelay={0}
      android_ripple={ripple && !disabled ? { color: colors[ripple], foreground: true } : null}
      onPressIn={(e) => {
        if (pressedScale !== 1) scale.set(withTiming(pressedScale, { duration: motion.press }));
        if (hapticOn === 'pressIn') buzz?.();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (pressedScale !== 1) scale.set(withSpring(1, { damping: 16, stiffness: 420, mass: 0.6 }));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (hapticOn === 'press') buzz?.();
        onPress?.(e);
      }}
      style={[{ overflow: 'hidden' }, style, animated]}>
      {children}
    </AnimatedPressable>
  );
}
