import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/theme/theme';
import type { ColorName } from '@/theme/tokens';

const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`;

/** Line icons drawn on a 24×24 grid, matching the design preview. */
const ICONS = {
  home: ['M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z'],
  book: ['M6 4h10a3 3 0 0 1 3 3v13H9a3 3 0 0 1-3-3z', 'M6 17a3 3 0 0 1 3-3h10'],
  chart: ['M4 4v16h16', 'm8 14 3.5-4 3 2.5L20 7'],
  user: [circle(12, 8.5, 3.5), 'M5 20c1.2-3.6 4-5 7-5s5.8 1.4 7 5'],
  plus: ['M12 5v14M5 12h14'],
  minus: ['M5 12h14'],
  check: ['M5 12.5 10 17 19 7'],
  arrowRight: ['M5 12h14M13 6l6 6-6 6'],
  chevronLeft: ['M15 5l-7 7 7 7'],
  chevronRight: ['M9 5l7 7-7 7'],
  chevronDown: ['m6 9 6 6 6-6'],
  close: ['M6 6l12 12M18 6 6 18'],
  search: [circle(11, 11, 6.5), 'm20 20-4.2-4.2'],
  scan: [
    'M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2',
    'M7 8v8M10.5 8v8M14 8v8M17 8v8',
  ],
  star: ['m12 4 2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z'],
  flag: ['M6 21V4M6 4h11l-2.5 4.5L17 13H6'],
  target: [circle(12, 12, 7.5), circle(12, 12, 3)],
  bolt: ['M13 3 5 13.5h6L10 21l8-10.5h-6z'],
  bookmark: ['M7 4h10v16l-5-3.5L7 20z'],
  drop: ['M12 3.5c3 3.6 6 6.9 6 10.4A6 6 0 0 1 6 14c0-3.5 3-6.8 6-10.5z'],
  trendDown: ['M4 7l6 6 4-4 6 6M20 10v5h-5'],
  recomp: ['M8 20V4M8 4 4.5 7.5M8 4l3.5 3.5', 'M16 4v16M16 20l-3.5-3.5M16 20l3.5-3.5'],
  scale: ['M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z', 'M8.5 10a3.5 3.5 0 0 1 7 0', 'm12 10 1.4-1.8'],
  pulse: ['M3 12h4l2.5-6 5 12 2.5-6h4'],
  fork: ['M8 3v8M5.5 3v5.5A2.5 2.5 0 0 0 8 11a2.5 2.5 0 0 0 2.5-2.5V3M8 11v10M17.5 21V3c-2.2 1.2-3.5 4-3.5 7.5V13h3.5'],
  bulb: ['M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z'],
  flame: [
    'M12 2.5c.8 3.6 6 5.9 6 11.3A6 6 0 0 1 12 19.9a6 6 0 0 1-6-6.1c0-2.7 1.4-4.5 2.9-5.6-.1 2.3 1 3.8 2.3 4.1-.5-3.6.1-7.3.8-9.9z',
  ],
} as const;

export type IconName = keyof typeof ICONS;

type IconProps = {
  name: IconName;
  size?: number;
  color?: ColorName;
  strokeWidth?: number;
  /** Fill the shape instead of stroking it (used for the streak flame). */
  filled?: boolean;
};

export function Icon({ name, size = 20, color = 'text', strokeWidth = 1.8, filled }: IconProps) {
  const { colors } = useTheme();
  const c = colors[color];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      {ICONS[name].map((d) => (
        <Path
          key={d}
          d={d}
          fill={filled ? c : 'none'}
          stroke={filled ? 'none' : c}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}
