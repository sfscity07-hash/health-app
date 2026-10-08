import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { isNear, type Badge } from '@/features/progress/logic';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

const SIZE = 64;
const R = 26;
const C = 2 * Math.PI * R;

function BadgeRing({ badge }: { badge: Badge }) {
  const { colors } = useTheme();
  const color = colors[badge.color];
  const near = isNear(badge);
  return (
    <View style={styles.ring}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* A soft halo when you're close: the "almost there" glow. */}
        {near ? <Circle cx={32} cy={32} r={31} fill={color} opacity={0.16} /> : null}
        <Circle cx={32} cy={32} r={R} fill="none" stroke={colors.surface3} strokeWidth={3} />
        <Circle
          cx={32}
          cy={32}
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={`${C} ${C}`}
          strokeDashoffset={C * (1 - badge.progress)}
          transform="rotate(-90 32 32)"
          opacity={badge.progress > 0 ? 1 : 0}
        />
        <Circle cx={32} cy={32} r={20} fill={badge.done ? colors.accentSoft : colors.surface2} />
      </Svg>
      <View style={styles.icon} pointerEvents="none">
        <Icon name={badge.icon} size={19} color={badge.done || near ? badge.color : 'textTertiary'} strokeWidth={2} filled={badge.done && badge.icon === 'star'} />
      </View>
    </View>
  );
}

/** Badge rings that fill up before you earn them. Tap one to see how to get it. */
export function Milestones({ badges }: { badges: Badge[] }) {
  const [picked, setPicked] = useState<string | null>(null);
  const shown = badges.find((b) => b.key === picked);
  return (
    <View style={styles.root}>
      <View style={styles.grid}>
        {badges.map((b) => (
          <PressableScale
            key={b.key}
            accessibilityRole="button"
            accessibilityLabel={`${b.title}, ${b.done ? 'earned' : b.count}. ${b.hint}`}
            haptic="tick"
            pressedScale={0.94}
            ripple={null}
            onPress={() => setPicked((k) => (k === b.key ? null : b.key))}
            style={styles.badge}>
            <BadgeRing badge={b} />
            <Text variant="caption" align="center" numberOfLines={2} color={b.done ? 'text' : 'textSecondary'}>
              {b.title}
            </Text>
            <Text variant="label" align="center">
              {b.done ? 'Earned' : b.count}
            </Text>
          </PressableScale>
        ))}
      </View>
      {shown ? (
        <Text variant="small" color="textSecondary" accessibilityLiveRegion="polite">
          <Text variant="small" color="text">
            {shown.title}:
          </Text>{' '}
          {shown.hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.lg },
  badge: { width: '25%', alignItems: 'center', gap: 4, paddingHorizontal: 2 },
  ring: { width: SIZE, height: SIZE },
  icon: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
