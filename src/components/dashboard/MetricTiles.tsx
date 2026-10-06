import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Card } from '@/components/ui/Card';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
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
  return (
    <Card style={styles.tile}>
      <TileBody {...props} />
    </Card>
  );
}

/** Water: tap to add a glass, long-press to undo the last one. */
export function WaterTile({
  ml,
  goalMl,
  onAdd,
  onUndo,
}: {
  ml: number;
  goalMl: number;
  onAdd: () => void;
  onUndo: () => void;
}) {
  const { colors } = useTheme();
  const glasses = Math.round(goalMl / 250);
  const filled = Math.floor(ml / 250);
  const left = Math.max(0, Math.ceil((goalMl - ml) / 250));
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Water, ${(ml / 1000).toFixed(2)} of ${(goalMl / 1000).toFixed(1)} litres`}
      accessibilityHint="Adds a 250 ml glass. Long-press to remove the last one."
      haptic="tick"
      hapticOn="pressIn"
      pressedScale={0.97}
      onPress={onAdd}
      onLongPress={onUndo}
      style={[styles.tile, styles.pressTile, { backgroundColor: colors.surface1, borderColor: colors.hairline }]}>
      <TileBody
        label="Water"
        meta="+250"
        value={(ml / 1000).toFixed(2)}
        unit={`/ ${(goalMl / 1000).toFixed(1)} L`}
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
  glasses: { flexDirection: 'row', gap: 3, height: 20 },
  glass: { flex: 1, borderRadius: 3 },
  mini: { height: 4, borderRadius: 2, overflow: 'hidden' },
});
