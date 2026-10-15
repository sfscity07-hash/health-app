import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

/** "Feedback", top right of the dashboard: report a bug or send an idea from anywhere. */
export function FeedbackChip({ from }: { from: string }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Feedback: report a bug or send an idea"
      haptic="tap"
      pressedScale={0.94}
      hitSlop={8}
      onPress={() => router.push({ pathname: '/feedback', params: { from } })}
      style={[styles.chip, { backgroundColor: colors.accentSoft }]}>
      <Icon name="chat" size={13} color="accent" strokeWidth={2.2} />
      <Text variant="caption" color="accent">
        Feedback
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: space.sm + 2, paddingVertical: 4, borderRadius: radius.pill },
});
