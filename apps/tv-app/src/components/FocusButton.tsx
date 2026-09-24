import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, radius } from '../theme';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'accent' | 'ghost';

interface FocusButtonProps {
  label: string;
  onPress(): void;
  /** Same variants as the web `.button--*` classes. */
  variant?: Variant;
  icon?: IconName | ReactNode;
  hasTVPreferredFocus?: boolean;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  onFocus?(): void;
}

const TEXT: Record<Variant, string> = { primary: '#000', secondary: colors.strong, accent: colors.strong, ghost: colors.text };

/** Web-style button (`.button`) that the D-pad can focus: focus shows the web's white outline. */
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
  const textColor = TEXT[variant];
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
      style={[styles.outline, focused && styles.outlineFocused, style]}
    >
      <View style={[styles.base, styles[variant], disabled && styles.disabled]}>
        {typeof icon === 'string' ? <Icon name={icon as IconName} size={24} color={textColor} /> : icon}
        <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outline: { borderWidth: 2, borderColor: 'transparent', borderRadius: radius + 3, padding: 2, margin: -4 },
  outlineFocused: { borderColor: colors.strong },
  base: {
    minHeight: 40,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: radius,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primary: { backgroundColor: colors.strong },
  secondary: { backgroundColor: colors.secondaryButton },
  accent: { backgroundColor: colors.accent },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.muted },
  disabled: { opacity: 0.5 },
  label: { fontSize: fonts.body, fontWeight: '700' },
});
