import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

/** Shown on the dashboard from Monday until you've done this week's check-in. */
export function CheckinBanner({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeInDown.duration(320)}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Your weekly check-in is ready. See how last week went and set this week's budget."
        haptic="tap"
        pressedScale={0.98}
        onPress={onPress}
        style={[styles.banner, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
        <View style={[styles.icon, { backgroundColor: colors.accent }]}>
          <Icon name="pulse" size={18} color="accentInk" strokeWidth={2.2} />
        </View>
        <View style={styles.text}>
          <Text variant="bodyStrong">Your weekly check-in is ready</Text>
          <Text variant="caption" color="textSecondary">
            See how last week went and set this week’s budget. About a minute.
          </Text>
        </View>
        <Icon name="chevronRight" size={17} color="accent" />
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
});
