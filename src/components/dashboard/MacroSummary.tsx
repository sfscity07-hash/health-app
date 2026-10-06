import { StyleSheet, View } from 'react-native';

import { AnimatedBar } from '@/components/ui/AnimatedBar';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/theme';
import { space, type ColorName } from '@/theme/tokens';

type Macro = { label: string; eaten: number; target: number; color: ColorName };

/** Protein, carbs and fat: eaten vs target, and how much is left. Fibre runs along the bottom. */
export function MacroSummary({ macros, fiber }: { macros: Macro[]; fiber: { eaten: number; target: number } }) {
  const { colors } = useTheme();
  const fiberLeft = Math.round(fiber.target - fiber.eaten);
  return (
    <Card style={styles.card}>
      <View style={styles.macros}>
        {macros.map((m, i) => {
          const left = Math.round(m.target - m.eaten);
          return (
            <View
              key={m.label}
              style={[styles.col, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth * 2, borderLeftColor: colors.hairline }]}
              accessible
              accessibilityLabel={`${m.label}: ${Math.round(m.eaten)} of ${m.target} grams`}>
              <View style={styles.head}>
                <View style={[styles.dot, { backgroundColor: colors[m.color] }]} />
                <Text variant="caption" color="textSecondary">
                  {m.label}
                </Text>
              </View>
              <Text variant="heading" tabular>
                <AnimatedNumber value={m.eaten} variant="heading" />
                <Text variant="caption" color="textTertiary">
                  {' '}
                  / {m.target} g
                </Text>
              </Text>
              <AnimatedBar fraction={m.target ? m.eaten / m.target : 0} color={colors[m.color]} />
              {left <= 0 ? (
                <View style={styles.done}>
                  <Icon name="check" size={12} color={m.color} strokeWidth={2.8} />
                  <Text variant="caption" color={m.color}>
                    Done
                  </Text>
                </View>
              ) : (
                <Text variant="caption" color="textSecondary" tabular>
                  {left} g left
                </Text>
              )}
            </View>
          );
        })}
      </View>
      <View
        style={[styles.fiber, { borderTopColor: colors.hairline }]}
        accessible
        accessibilityLabel={`Fibre: ${Math.round(fiber.eaten)} of ${fiber.target} grams`}>
        <View style={styles.head}>
          <View style={[styles.dot, { backgroundColor: colors.fiber }]} />
          <Text variant="caption" color="textSecondary">
            Fibre
          </Text>
        </View>
        <View style={styles.fiberBar}>
          <AnimatedBar fraction={fiber.target ? fiber.eaten / fiber.target : 0} color={colors.fiber} />
        </View>
        <Text variant="caption" color={fiberLeft <= 0 ? 'fiber' : 'textSecondary'} tabular>
          {Math.round(fiber.eaten)} / {fiber.target} g
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { paddingTop: space.lg },
  macros: { flexDirection: 'row' },
  fiber: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.lg,
    paddingHorizontal: space.md + 2,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
  },
  fiberBar: { flex: 1 },
  col: { flex: 1, paddingHorizontal: space.md + 2, gap: space.xs + 3 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 2 },
  done: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
