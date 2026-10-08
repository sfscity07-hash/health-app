import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { positionOf, type Journey } from '@/features/progress/logic';
import { toDisplay, unitLabel, type Units } from '@/features/weight/logic';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

type GoalJourneyProps = {
  journey: Journey;
  units: Units;
  /** Days to the next milestone at your current pace, if it's heading there. */
  nextInDays: number | null;
  /** A sentence about when you'll reach the goal. */
  projection: string;
};

const pct = (f: number) => `${(f * 100).toFixed(2)}%` as `${number}%`;

/** From where you started to your goal: how far along you are, the 2.5 kg milestones, and when you'll get there. */
export function GoalJourney({ journey: j, units, nextInDays, projection }: GoalJourneyProps) {
  const { colors } = useTheme();
  const unit = unitLabel(units);
  const show = (kg: number) => toDisplay(kg, units).toFixed(1);
  const gaining = j.goalKg > j.startKg;
  const nextPos = j.next !== null ? positionOf(j, j.next) : null;
  // Label the next milestone unless it would collide with the start or goal labels.
  const labelNext = j.next !== null && j.next !== j.goalKg && nextPos !== null && nextPos > 0.16 && nextPos < 0.84;

  return (
    <Card
      style={styles.card}
      accessible
      accessibilityLabel={`Goal journey: trend ${show(j.trendKg)} ${unit}, goal ${show(j.goalKg)} ${unit}, ${Math.round(j.fraction * 100)}% of the way. ${projection}`}>
      <View style={styles.top}>
        <View>
          <Text variant="label">Trend weight</Text>
          <Text variant="hero">
            {show(j.trendKg)}
            <Text variant="body" color="textSecondary">
              {' '}
              {unit}
            </Text>
          </Text>
        </View>
        <View style={styles.goal}>
          <Text variant="label">Goal</Text>
          <Text variant="title">
            {show(j.goalKg)}
            <Text variant="small" color="textSecondary">
              {' '}
              {unit}
            </Text>
          </Text>
        </View>
      </View>

      <View style={styles.trackWrap}>
        <View style={[styles.track, { backgroundColor: colors.surface3 }]}>
          <View style={[styles.fill, { width: pct(j.fraction), backgroundColor: colors.accent }]} />
        </View>
        {j.milestones.map((m) => {
          const passed = positionOf(j, m) <= j.fraction;
          return <View key={m} style={[styles.notch, { left: pct(positionOf(j, m)), backgroundColor: passed ? colors.surface1 : colors.textTertiary }]} />;
        })}
        <View style={[styles.knob, { left: pct(j.fraction), backgroundColor: colors.text, borderColor: colors.accent }]} />
        <Text variant="label" style={[styles.labelStart]}>
          {show(j.startKg)}
        </Text>
        {labelNext && nextPos !== null ? (
          <Text variant="label" style={[styles.labelMid, { left: pct(nextPos) }]}>
            {show(j.next as number)}
          </Text>
        ) : null}
        <Text variant="label" style={styles.labelEnd}>
          {show(j.goalKg)}
        </Text>
      </View>

      <View style={styles.meta}>
        <Text variant="caption" color="textSecondary" tabular>
          <Text variant="caption" color="text">
            {show(j.doneKg)} {unit}
          </Text>{' '}
          {gaining ? 'gained' : 'lost'} · {Math.round(j.fraction * 100)}%
        </Text>
        {j.next !== null ? (
          <Text variant="caption" color="textSecondary" tabular>
            Next{' '}
            <Text variant="caption" color="text">
              {show(j.next)}
            </Text>
            {nextInDays !== null ? ` in ~${nextInDays}d` : ''}
          </Text>
        ) : null}
      </View>

      <View style={[styles.projection, { borderTopColor: colors.hairline }]}>
        <Icon name="flag" size={16} color="accent" />
        <Text variant="small" color="textSecondary" style={styles.flex}>
          {projection}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, gap: space.md },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  goal: { alignItems: 'flex-end' },
  trackWrap: { height: 44, justifyContent: 'flex-start', paddingTop: 10, marginTop: space.xs },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  notch: { position: 'absolute', top: 7, width: 2, height: 12, marginLeft: -1, borderRadius: 1 },
  knob: { position: 'absolute', top: 5, width: 16, height: 16, marginLeft: -8, borderRadius: 8, borderWidth: 4 },
  labelStart: { position: 'absolute', top: 28, left: 0 },
  labelMid: { position: 'absolute', top: 28, width: 60, marginLeft: -30, textAlign: 'center' },
  labelEnd: { position: 'absolute', top: 28, right: 0 },
  meta: { flexDirection: 'row', justifyContent: 'space-between' },
  projection: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth * 2 },
  flex: { flex: 1 },
});
