import { useState } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { focus, useFocusScale } from './focus';
import { Icon, type IconName } from './Icon';

/** Web `.icon-button`: round, translucent, white ring; focus fills it white (dark icon), grows it and adds a glow. */
export function IconButton({
  icon,
  label,
  onPress,
  size = 40,
  iconSize = 20,
  plain,
  hasTVPreferredFocus,
  focusable,
  testID,
}: {
  icon: IconName;
  label: string;
  onPress(): void;
  size?: number;
  iconSize?: number;
  /** `.icon-button--plain`: no ring or background (player controls). */
  plain?: boolean;
  hasTVPreferredFocus?: boolean;
  /** `false` keeps it out of D-pad focus (player controls are driven by the remote keys instead). */
  focusable?: boolean;
  testID?: string;
}) {
  const [focused, setFocused] = useState(false);
  const scale = useFocusScale(focused, 1.12);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      hasTVPreferredFocus={hasTVPreferredFocus}
      focusable={focusable}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <Animated.View
        style={[
          styles.button,
          { width: size, height: size, borderRadius: size / 2 },
          plain && styles.plain,
          focused && (plain ? styles.plainFocused : styles.focused),
          { transform: [{ scale }] },
        ]}
      >
        <Icon name={icon} size={iconSize} color={focused && !plain ? focus.onSolid : undefined} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(42,42,42,0.6)',
  },
  focused: { borderColor: focus.solid, backgroundColor: focus.solid, ...focus.glow },
  plain: { borderColor: 'transparent', backgroundColor: 'transparent' },
  plainFocused: { backgroundColor: focus.fill },
});
