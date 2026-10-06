import { useState } from 'react';
import { Animated, Pressable, StyleSheet, type FocusDestination, type View } from 'react-native';
import { focus, useFocusScale } from './focus';
import { Icon, type IconName } from './Icon';

/** Web `.icon-button`: round, translucent, white ring; focus fills it white (dark icon), grows it and adds a glow. */
export function IconButton({
  icon,
  label,
  onPress,
  onLongPress,
  size = 40,
  iconSize = 20,
  plain,
  hasTVPreferredFocus,
  focusable,
  onFocus,
  onBlur,
  testID,
  focusRef,
  nextFocusUp,
  nextFocusDown,
}: {
  icon: IconName;
  label: string;
  onPress(): void;
  /** Holding OK (a long touch on phones), e.g. an episode's options menu (D-082). */
  onLongPress?(): void;
  size?: number;
  iconSize?: number;
  /** `.icon-button--plain`: no ring or background (player controls). */
  plain?: boolean;
  hasTVPreferredFocus?: boolean;
  /** `false` keeps it out of D-pad focus (player controls are driven by the remote keys instead). */
  focusable?: boolean;
  onFocus?(): void;
  onBlur?(): void;
  testID?: string;
  /** The button's view, e.g. for a neighbour's `nextFocusUp`/`nextFocusDown`. */
  focusRef?: (view: View | null) => void;
  /** TV: the views that Up/Down go to, instead of the nearest ones. */
  nextFocusUp?: FocusDestination;
  nextFocusDown?: FocusDestination;
}) {
  const [focused, setFocused] = useState(false);
  const scale = useFocusScale(focused, 1.12);
  return (
    <Pressable
      ref={focusRef}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      hasTVPreferredFocus={hasTVPreferredFocus}
      focusable={focusable}
      nextFocusUp={nextFocusUp}
      nextFocusDown={nextFocusDown}
      onPress={onPress}
      onLongPress={onLongPress}
      onFocus={() => {
        setFocused(true);
        onFocus?.();
      }}
      onBlur={() => {
        setFocused(false);
        onBlur?.();
      }}
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
