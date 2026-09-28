import { useState, type ReactNode, useRef } from 'react';
import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, radius } from '../theme';
import { AnimatedPressable, focus, useFocusScale } from './focus';
import { useCenterFocus, type Measurable } from './CenterScroll';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'accent' | 'ghost';

interface FocusButtonProps {
  label: string;
  onPress(): void;
  /** Same variants as the web `.button--*` classes. */
  variant?: Variant;
  icon?: IconName | ReactNode;
  /** The icon after the label (menus, D-086); before it by default. */
  iconAfter?: boolean;
  hasTVPreferredFocus?: boolean;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  onFocus?(): void;
}

const TEXT: Record<Variant, string> = { primary: '#000', secondary: colors.strong, accent: colors.strong, ghost: colors.text };

/** Web-style button (`.button`) that the D-pad can focus: focus grows it smoothly and lights it up (white with a glow). */
export function FocusButton({
  label,
  onPress,
  variant = 'secondary',
  icon,
  iconAfter,
  hasTVPreferredFocus,
  disabled,
  testID,
  accessibilityLabel,
  style,
  onFocus,
}: FocusButtonProps) {
  const [focused, setFocused] = useState(false);
  const scale = useFocusScale(focused, 1.06);
  const centerFocus = useCenterFocus();
  const self = useRef<Measurable>(null);
  // Focused: every variant turns white with dark text, the primary one (already white) gets the glow.
  const textColor = focused ? focus.onSolid : TEXT[variant];
  const iconNode = typeof icon === 'string' ? <Icon name={icon as IconName} size={24} color={textColor} /> : icon;
  return (
    <AnimatedPressable
      ref={self as never}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onPress={onPress}
      onFocus={() => {
        setFocused(true);
        centerFocus?.(self.current);
        onFocus?.();
      }}
      onBlur={() => setFocused(false)}
      style={[styles.base, styles[variant], focused && styles.focused, disabled && styles.disabled, { transform: [{ scale }] }, style]}
    >
      {iconAfter ? null : iconNode}
      <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
      {iconAfter ? iconNode : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
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
  focused: { backgroundColor: focus.solid, borderColor: focus.solid, ...focus.glow },
  disabled: { opacity: 0.5 },
  label: { fontSize: fonts.body, fontWeight: '700' },
});
