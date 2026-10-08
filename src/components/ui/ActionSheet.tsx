import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/theme';
import { gutter, radius, space } from '@/theme/tokens';

export type SheetAction = { label: string; icon: IconName; onPress: () => void; hint?: string };

type ActionSheetProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  actions: SheetAction[];
  onClose: () => void;
};

/** A short menu that slides up from the bottom, e.g. what you can do with a meal. */
export function ActionSheet({ visible, title, subtitle, actions, onClose }: ActionSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} onPress={onClose} accessibilityLabel="Close menu" />
      <Animated.View
        entering={SlideInDown.springify().damping(20).stiffness(220)}
        style={[styles.panel, { backgroundColor: colors.surface1, paddingBottom: insets.bottom + space.md }]}>
        <View style={[styles.grabber, { backgroundColor: colors.hairlineStrong }]} />
        <View style={styles.head}>
          <Text variant="heading">{title}</Text>
          {subtitle ? (
            <Text variant="caption" color="textSecondary">
              {subtitle}
            </Text>
          ) : null}
        </View>
        {actions.map((a) => (
          <PressableScale
            key={a.label}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            haptic="tick"
            pressedScale={0.98}
            onPress={() => {
              onClose();
              a.onPress();
            }}
            style={styles.row}>
            <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
              <Icon name={a.icon} size={17} color="accent" />
            </View>
            <View style={styles.rowText}>
              <Text variant="bodyStrong">{a.label}</Text>
              {a.hint ? (
                <Text variant="caption" color="textSecondary">
                  {a.hint}
                </Text>
              ) : null}
            </View>
          </PressableScale>
        ))}
        <PressableScale accessibilityRole="button" accessibilityLabel="Cancel" onPress={onClose} style={[styles.cancel, { backgroundColor: colors.surface2 }]}>
          <Text variant="bodyStrong">Cancel</Text>
        </PressableScale>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: gutter,
    paddingTop: space.sm,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    gap: space.xs,
  },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: space.sm },
  head: { gap: 2, paddingBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 2, borderRadius: radius.md },
  icon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 1 },
  cancel: { height: 50, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginTop: space.sm },
});
