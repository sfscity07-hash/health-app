import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { restart, useUpdateReady } from '@/features/updates/ota';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

/**
 * "New version ready · Restart", at the top once an update has downloaded.
 * Ignoring it is fine: the new version opens next time the app starts.
 */
export function UpdateBanner() {
  const ready = useUpdateReady();
  const [later, setLater] = useState(false);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (!ready || later) return null;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + space.sm }]}>
      <Animated.View
        entering={FadeInUp.duration(260)}
        exiting={FadeOutUp.duration(200)}
        style={[styles.banner, { backgroundColor: colors.text }]}
        accessibilityLiveRegion="polite">
        <Icon name="refresh" size={16} color="accent" strokeWidth={2.4} />
        <Text variant="smallStrong" color="bg" style={styles.message}>
          New version ready
        </Text>
        <PressableScale accessibilityRole="button" accessibilityLabel="Restart to open the new version" haptic="tap" onPress={restart} style={[styles.action, { backgroundColor: colors.accent }]}>
          <Text variant="smallStrong" color="accentInk">
            Restart
          </Text>
        </PressableScale>
        <PressableScale accessibilityRole="button" accessibilityLabel="Later. It opens next time you start the app." hitSlop={10} onPress={() => setLater(true)}>
          <Icon name="close" size={16} color="bg" strokeWidth={2.2} />
        </PressableScale>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xs + 2,
    paddingLeft: space.md,
    paddingRight: space.md,
    borderRadius: radius.lg,
    maxWidth: '92%',
  },
  message: { flexShrink: 1 },
  action: { paddingHorizontal: space.md, paddingVertical: space.xs + 1, borderRadius: radius.pill },
});
