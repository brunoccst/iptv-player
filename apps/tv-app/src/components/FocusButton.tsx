import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, spacing } from '../theme';

interface FocusButtonProps {
  label: string;
  onPress(): void;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: ReactNode;
  hasTVPreferredFocus?: boolean;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  onFocus?(): void;
}

/** D-pad focusable button. Focus = white fill (primary) or white border + scale. */
export function FocusButton({
  label,
  onPress,
  variant = 'secondary',
  icon,
  hasTVPreferredFocus,
  disabled,
  testID,
  accessibilityLabel,
  style,
  onFocus,
}: FocusButtonProps) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onPress={onPress}
      onFocus={() => {
        setFocused(true);
        onFocus?.();
      }}
      onBlur={() => setFocused(false)}
      style={[
        styles.base,
        styles[variant],
        focused && styles.focused,
        focused && variant !== 'primary' && styles.focusedSecondary,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.content}>
        {icon}
        <Text style={[styles.label, (variant === 'primary' || focused) && styles.labelDark]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  primary: { backgroundColor: colors.strong },
  secondary: { backgroundColor: 'rgba(109,109,110,0.7)' },
  ghost: { backgroundColor: 'transparent', borderColor: colors.muted },
  focused: { transform: [{ scale: 1.08 }], borderColor: colors.strong },
  focusedSecondary: { backgroundColor: colors.strong },
  disabled: { opacity: 0.4 },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { color: colors.strong, fontSize: fonts.body, fontWeight: '700' },
  labelDark: { color: '#000' },
});
