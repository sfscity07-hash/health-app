import { useIsFocused } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useToast, type ToastTone } from '@/store/toast';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

const ICON: Record<ToastTone, IconName> = { good: 'check', warn: 'close', info: 'bulb' };

/** Shows the latest confirmation for a couple of seconds. Place one per screen layer. */
export function ToastHost({ bottom = 110 }: { bottom?: number }) {
  const { colors } = useTheme();
  const { id, message, tone, hide } = useToast();
  // Hosts on screens underneath (e.g. the tabs below the logger) stay quiet.
  const focused = useIsFocused();

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(hide, tone === 'good' ? 2200 : 3600);
    return () => clearTimeout(t);
  }, [id, message, tone, hide]);

  if (!message || !focused) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom }]}>
      <Animated.View
        key={id}
        entering={FadeInDown.duration(260)}
        exiting={FadeOut.duration(200)}
        style={[styles.toast, { backgroundColor: colors.text }]}
        accessibilityLiveRegion="polite">
        <Icon name={ICON[tone]} size={16} color={tone === 'info' ? 'accent' : tone} strokeWidth={2.4} />
        <Text variant="smallStrong" color="bg" numberOfLines={2} style={styles.message}>
          {message}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm + 2,
    paddingLeft: space.md,
    paddingRight: space.lg,
    borderRadius: radius.lg - 2,
    maxWidth: '88%',
  },
  message: { flexShrink: 1 },
});
