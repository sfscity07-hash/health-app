import { forwardRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/theme';
import { fonts, radius, space } from '@/theme/tokens';

type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  /** Unit shown inside the field on the right, e.g. "kg". */
  suffix?: string;
  /** Extra control inside the field, e.g. a show-password button. */
  accessory?: ReactNode;
  error?: string | null;
  flex?: boolean;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, suffix, accessory, error, flex, onFocus, onBlur, ...rest },
  ref,
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.wrap, flex && styles.flex]}>
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
      <View
        style={[
          styles.box,
          {
            backgroundColor: colors.surface2,
            borderColor: error ? colors.warn : focused ? colors.accent : colors.hairline,
          },
        ]}>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          style={[styles.input, { color: colors.text }, Platform.OS === 'web' && styles.noWebOutline]}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {suffix ? (
          <Text variant="body" color="textTertiary">
            {suffix}
          </Text>
        ) : null}
        {accessory}
      </View>
      {error ? (
        <Text variant="caption" color="warn" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: space.xs + 2 },
  flex: { flex: 1 },
  box: {
    minHeight: 54,
    borderRadius: radius.lg - 2,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  input: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 17,
    paddingVertical: space.md,
    fontVariant: ['tabular-nums'],
  },
  // The field's own border already shows focus; drop the browser's extra outline.
  noWebOutline: { outlineWidth: 0 },
});
