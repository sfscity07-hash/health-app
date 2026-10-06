import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/theme/theme';

/** The Fuel mark: an open gauge arc with its end point. */
export function BrandMark({ size = 40 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M7.05 16.95a7 7 0 1 1 9.9 0" fill="none" stroke={colors.accent} strokeWidth={2.6} strokeLinecap="round" />
      <Circle cx={16.95} cy={16.95} r={2} fill={colors.text} />
    </Svg>
  );
}
