import type { TabListProps, TabTriggerSlotProps } from 'expo-router/ui';
import { router } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Icon, type IconName } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { tick } from '@/lib/haptics';
import { mealForTime } from '@/lib/meals';
import { useDay, viewedDate } from '@/store/day';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

const BAR_HEIGHT = 58;
const SWITCH_ON_PRESS_IN = Platform.OS !== 'web';
const FADE_HEIGHT = 118;

/**
 * The floating frosted pill with four tabs, plus the round + button that
 * opens the food logger. Used as the `asChild` target of `TabList`.
 */
export function FloatingTabBar({ children, style, ...rest }: TabListProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = insets.bottom + space.lg;
  return (
    <View pointerEvents="box-none" style={[styles.overlay, { height: FADE_HEIGHT + insets.bottom }]}>
      <Svg pointerEvents="none" width="100%" height={FADE_HEIGHT + insets.bottom} style={styles.fade}>
        <Defs>
          <LinearGradient id="tabFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.bg} stopOpacity={0} />
            <Stop offset="0.72" stopColor={colors.bg} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#tabFade)" />
      </Svg>
      <View style={[styles.row, { bottom }]} pointerEvents="box-none">
        <View
          {...rest}
          accessibilityRole="tablist"
          style={[styles.pill, { backgroundColor: colors.glass, borderColor: colors.hairlineStrong }, style]}>
          {children}
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Log food"
          haptic="tap"
          hapticOn="pressIn"
          pressedScale={0.92}
          ripple="rippleOnAccent"
          onPress={() =>
            router.push({ pathname: '/log', params: { date: viewedDate(useDay.getState().picked), meal: mealForTime(new Date()) } })
          }
          style={[styles.fab, { backgroundColor: colors.accent }]}>
          <Icon name="plus" size={24} color="accentInk" strokeWidth={2.2} />
        </PressableScale>
      </View>
    </View>
  );
}

type TabButtonProps = TabTriggerSlotProps & { icon: IconName; label: string };

/**
 * Switches tab on touch-down rather than on release, like the system tab
 * bars do, so changing tabs never waits for your finger to lift.
 */
export function TabButton({ icon, label, isFocused, onPress, onPressIn, ...rest }: TabButtonProps) {
  const { colors } = useTheme();
  return (
    <PressableScale
      {...rest}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: Boolean(isFocused) }}
      pressedScale={0.9}
      onPressIn={(e) => {
        onPressIn?.(e);
        if (SWITCH_ON_PRESS_IN && !isFocused) {
          tick();
          onPress?.(e);
        }
      }}
      // On the web a tab is also a link, so it must handle the click itself.
      onPress={SWITCH_ON_PRESS_IN ? undefined : onPress}
      style={[styles.tab, isFocused && { backgroundColor: colors.surface3 }]}>
      <Icon name={icon} size={21} color={isFocused ? 'text' : 'textTertiary'} strokeWidth={1.7} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  row: {
    position: 'absolute',
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pill: {
    flex: 1,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth * 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: space.xs,
  },
  tab: {
    width: 48,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: BAR_HEIGHT,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
  },
});
