import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { balanceWord, KCAL_PER_KG, type DeficitDay } from '@/features/deficit/logic';
import { formatInt } from '@/lib/format';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

const kg = (kcal: number) => (Math.abs(kcal) / KCAL_PER_KG).toFixed(2);

/**
 * One line for a day's energy balance: "Deficit so far 1,240 kcal", with what
 * it is made of. Today reads "so far", since it shrinks as you eat.
 */
export function DeficitLine({ day }: { day: DeficitDay }) {
  const { colors } = useTheme();
  const value = day.deficit;
  const word = value === null ? 'Deficit' : balanceWord(value);
  const surplus = value !== null && word === 'Surplus';

  const main = value === null ? 'Nothing logged' : word === 'Even' ? 'Even' : `${formatInt(Math.abs(value))} kcal`;
  const detail =
    value === null
      ? `${formatInt(day.planned)} kcal if you eat your budget`
      : day.partial
        ? `Burn ~${formatInt(day.burn)} − ${formatInt(day.eaten)} eaten · ${formatInt(day.planned)} if you eat your budget`
        : `Burn ~${formatInt(day.burn)} − ${formatInt(day.eaten)} eaten · ≈ ${kg(value)} kg ${surplus ? 'gained' : 'of fat'}`;

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${word}${day.partial && value !== null ? ' so far' : ''}: ${main}. ${detail.replace('~', 'about ').replace('−', 'minus').replace('≈', 'about')}.`}>
      <View style={[styles.badge, { backgroundColor: surplus ? colors.surplus : colors.deficit }]}>
        <Icon name={surplus ? 'trendUp' : 'trendDown'} size={13} color="bg" strokeWidth={2.4} />
      </View>
      <View style={styles.text}>
        <Text variant="smallStrong" tabular>
          <Text variant="small" color="textSecondary">
            {word}
            {day.partial && value !== null ? ' so far' : ''}{' '}
          </Text>
          {main}
        </Text>
        <Text variant="caption" color="textTertiary" tabular numberOfLines={2}>
          {detail}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  badge: { width: 26, height: 26, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, gap: 1 },
});
