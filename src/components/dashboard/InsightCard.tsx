import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import type { Insight } from '@/features/dashboard/insights';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

/** One observation at a time; tap to see the next. */
export function InsightCard({ insights }: { insights: Insight[] }) {
  const { colors } = useTheme();
  const [index, setIndex] = useState(0);
  if (insights.length === 0) return null;
  const current = insights[index % insights.length];

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityHint={insights.length > 1 ? 'Shows the next insight' : undefined}
      haptic={insights.length > 1 ? 'tick' : 'none'}
      pressedScale={0.985}
      onPress={() => setIndex((i) => (i + 1) % insights.length)}
      style={[styles.card, { backgroundColor: colors.surface1, borderColor: colors.hairline }]}>
      <View style={styles.top}>
        <Text variant="label">Insight · {current.title}</Text>
        {insights.length > 1 ? (
          <View style={styles.pips}>
            {insights.map((i, n) => (
              <View key={i.key} style={[styles.pip, { backgroundColor: n === index % insights.length ? colors.textSecondary : colors.surface3 }]} />
            ))}
          </View>
        ) : null}
      </View>
      <Animated.View key={current.key} entering={FadeIn.duration(220)} style={styles.body}>
        <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
          <Icon name={current.icon} size={17} color="accent" />
        </View>
        <Text variant="small" color="textSecondary" style={styles.text}>
          {current.body.map((part, n) =>
            part.bold ? (
              <Text key={n} variant="smallStrong" color="text">
                {part.text}
              </Text>
            ) : (
              part.text
            ),
          )}
        </Text>
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth * 2, padding: space.lg, gap: space.md },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pips: { flexDirection: 'row', gap: 4 },
  pip: { width: 14, height: 3, borderRadius: 2 },
  body: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  icon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
});
