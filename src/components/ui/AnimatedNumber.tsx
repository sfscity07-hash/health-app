import { useEffect, useRef, useState } from 'react';

import { Text, type TextProps } from '@/components/ui/Text';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { formatInt } from '@/lib/format';
import { motion } from '@/theme/tokens';

type AnimatedNumberProps = Omit<TextProps, 'children'> & {
  value: number;
  format?: (n: number) => string;
  duration?: number;
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** Counts from the previous value to the new one, like the gauge in the design. */
export function AnimatedNumber({ value, format = formatInt, duration = motion.count, ...rest }: AnimatedNumberProps) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const current = useRef(value);

  useEffect(() => {
    if (reduced || current.current === value) {
      current.current = value;
      setShown(value);
      return;
    }
    const from = current.current;
    const start = Date.now();
    let frame = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const next = from + (value - from) * easeOutCubic(t);
      current.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduced]);

  return (
    <Text tabular {...rest}>
      {format(shown)}
    </Text>
  );
}
