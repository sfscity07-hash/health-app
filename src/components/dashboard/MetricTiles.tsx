import type { ReactNode, Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { glassCount } from '@/features/water/logic';
import { useTheme } from '@/theme/theme';
import { radius, space, type ColorName } from '@/theme/tokens';

type TileProps = {
  label: string;
  /** Small mono text at the top right, e.g. "21D". */
  meta?: string;
  value: string;
  unit?: string;
  sub?: ReactNode;
  footer?: ReactNode;
  /** Makes the whole tile a button, e.g. the weight tile opens the weigh-in. */
  onPress?: () => void;
  accessibilityLabel?: string;
};

function TileBody({ label, meta, value, unit, sub, footer }: TileProps) {
  return (
    <>
      <View style={styles.head}>
        <Text variant="caption" color="textSecondary">
          {label}
        </Text>
        {meta ? <Text variant="label">{meta}</Text> : null}
      </View>
      <Text variant="heading" tabular style={styles.value} numberOfLines={1}>
        {value}
        {unit ? (
          <Text variant="caption" color="textTertiary">
            {' '}
            {unit}
          </Text>
        ) : null}
      </Text>
      {sub ? (typeof sub === 'string' ? <Text variant="caption" color="textSecondary">{sub}</Text> : sub) : null}
      <View style={styles.footer}>{footer}</View>
    </>
  );
}

export function Tile(props: TileProps) {
  const { colors } = useTheme();
  if (props.onPress) {
    return (
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={props.accessibilityLabel}
        haptic="tap"
        pressedScale={0.97}
        onPress={props.onPress}
        style={[styles.tile, styles.pressTile, { backgroundColor: colors.surface1, borderColor: colors.hairline }]}>
        <TileBody {...props} />
      </PressableScale>
    );
  }
  return (
    <Card style={styles.tile}>
      <TileBody {...props} />
    </Card>
  );
}

/** Water: the + adds a glass in one tap; the rest of the tile opens the water sheet. */
export function WaterTile({
  ml,
  goalMl,
  glassMl,
  value,
  unit,
  glassLabel,
  onAdd,
  onOpen,
  ref,
}: {
  ml: number;
  goalMl: number;
  glassMl: number;
  /** The day's total and the goal, formatted in your units ("1.25", "/ 2.5 L"). */
  value: string;
  unit: string;
  /** "250 ml" or "8 fl oz", for screen readers. */
  glassLabel: string;
  onAdd: () => void;
  onOpen: () => void;
  ref?: Ref<View>;
}) {
  const { colors } = useTheme();
  const glasses = glassCount(goalMl, glassMl);
  const filled = Math.min(glasses, Math.floor(ml / glassMl + 0.001));
  const left = Math.max(0, Math.ceil((goalMl - ml) / glassMl - 0.001));
  return (
    <View ref={ref} style={styles.waterWrap}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Water, ${value} ${unit}${left === 0 ? ', goal hit' : `, ${left} glass${left === 1 ? '' : 'es'} to go`}. Opens water.`}
        haptic="tap"
        pressedScale={0.97}
        onPress={onOpen}
        style={[styles.tile, styles.pressTile, { backgroundColor: colors.surface1, borderColor: colors.hairline }]}>
        <TileBody
          label="Water"
          value={value}
          unit={unit}
          sub={
            left === 0 ? (
              <Text variant="caption" color="good">
                Goal hit
              </Text>
            ) : (
              `${left} glass${left === 1 ? '' : 'es'} to go`
            )
          }
          footer={
            <View style={styles.glasses}>
              {Array.from({ length: glasses }, (_, i) => (
                <View key={i} style={[styles.glass, { backgroundColor: i < filled ? colors.water : colors.surface3 }]} />
              ))}
            </View>
          }
        />
      </PressableScale>
      {/* A sibling on top of the tile rather than inside it, so its tap never also opens the sheet. */}
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Add a glass of water, ${glassLabel}`}
        haptic="tick"
        hapticOn="pressIn"
        pressedScale={0.85}
        hitSlop={8}
        onPress={onAdd}
        style={[styles.waterAdd, { backgroundColor: colors.surface2 }]}>
        <Icon name="plus" size={16} color="water" strokeWidth={2.6} />
      </PressableScale>
    </View>
  );
}

/** A tiny line chart for tiles; the last point is emphasised. */
export function Sparkline({ values, color }: { values: number[]; color: ColorName }) {
  const { colors } = useTheme();
  if (values.length < 2) return null;
  const w = 112;
  const h = 30;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const x = (i: number) => 2 + (i / (values.length - 1)) * (w - 6);
  const y = (v: number) => h - 4 - ((v - lo) / (hi - lo || 1)) * (h - 8);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  const last = values.length - 1;
  return (
    <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <Path d={d} fill="none" stroke={colors[color]} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={x(last)} cy={y(values[last])} r={2.6} fill={colors[color]} />
    </Svg>
  );
}

export function MiniBar({ fraction, color }: { fraction: number; color: ColorName }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.mini, { backgroundColor: colors.surface3 }]}>
      <View style={{ width: `${Math.min(1, Math.max(0, fraction)) * 100}%`, height: '100%', backgroundColor: colors[color] }} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, minHeight: 124, padding: space.md + 2, gap: 2 },
  pressTile: { borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth * 2 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  value: { marginTop: space.sm },
  footer: { marginTop: 'auto', paddingTop: space.sm },
  waterWrap: { flex: 1 },
  waterAdd: { position: 'absolute', top: 9, right: 9, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  glasses: { flexDirection: 'row', gap: 3, height: 20 },
  glass: { flex: 1, borderRadius: 3 },
  mini: { height: 4, borderRadius: 2, overflow: 'hidden' },
});
