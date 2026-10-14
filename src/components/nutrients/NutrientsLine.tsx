import { router } from 'expo-router';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AiBadge } from '@/components/nutrients/AiBadge';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useDayNutrients } from '@/features/nutrients/api';
import { saltFromSodium, type DayNutrient } from '@/features/nutrients/micros';
import { space } from '@/theme/tokens';

/** "4.6 g", or "–" when none of the day's foods say. */
const shown = (d: DayNutrient, entries: number, text: string) => (d.amount === 0 && d.missing.length === entries ? '–' : `${d.estimated ? '≈' : ''}${text}`);

/**
 * A day's salt and caffeine in one line, opening the full Nutrients screen.
 * Sits under the macros on the dashboard and the Food log.
 */
export function NutrientsLine({ date, style }: { date: string; style?: StyleProp<ViewStyle> }) {
  const n = useDayNutrients(date);
  const salt = n.day.sodium_mg;
  const caffeine = n.day.caffeine_mg;
  const saltG = saltFromSodium(salt.amount);
  const saltOver = salt.amount > n.goals.sodium_mg.amount;
  const caffeineOver = caffeine.amount > n.goals.caffeine_mg.amount;
  const saltText = shown(salt, n.entries, `${saltG.toFixed(1)} g`);
  const caffeineText = shown(caffeine, n.entries, `${Math.round(caffeine.amount)} mg`);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={
        n.entries === 0
          ? 'Nutrients: salt, caffeine, vitamins and minerals. Opens the Nutrients screen.'
          : `Salt ${saltText}${saltOver ? ', over the limit' : ''}${salt.ai ? ' (includes AI estimate)' : ''}, caffeine ${caffeineText}${caffeineOver ? ', over the limit' : ''}${caffeine.ai ? ' (includes AI estimate)' : ''}. Opens vitamins, minerals and more.`
      }
      haptic="tap"
      pressedScale={0.98}
      onPress={() => router.push({ pathname: '/nutrients', params: { date } })}
      style={[styles.row, style]}>
      {n.entries === 0 ? (
        <Text variant="caption" color="textSecondary" style={styles.flex}>
          Salt, caffeine, vitamins and minerals
        </Text>
      ) : (
        <View style={[styles.flex, styles.values]}>
          <View style={styles.item}>
            <Text variant="caption" color="textSecondary">
              Salt{' '}
              <Text variant="caption" tabular>
                {saltText}
              </Text>
              {saltOver ? (
                <Text variant="caption" color="warn">
                  {' '}
                  over
                </Text>
              ) : null}
            </Text>
            {salt.ai ? <AiBadge /> : null}
          </View>
          <View style={styles.item}>
            <Text variant="caption" color="textSecondary">
              Caffeine{' '}
              <Text variant="caption" tabular>
                {caffeineText}
              </Text>
              {caffeineOver ? (
                <Text variant="caption" color="warn">
                  {' '}
                  over
                </Text>
              ) : null}
            </Text>
            {caffeine.ai ? <AiBadge /> : null}
          </View>
        </View>
      )}
      <Text variant="caption" color="accent">
        Nutrients
      </Text>
      <Icon name="chevronRight" size={14} color="accent" strokeWidth={2.4} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flex: { flex: 1 },
  values: { flexDirection: 'row', gap: space.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
