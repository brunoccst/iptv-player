import { forwardRef, useEffect, useRef, type ComponentProps } from 'react';
import { Animated, Platform, Pressable, type View } from 'react-native';

/**
 * D-pad focus look, shared by all focusable items: instead of a hard white box, the focused item grows smoothly
 * (spring) and lights up, with a soft glow, a filled pill or a highlighted row.
 */
export const focus = {
  /**
   * Soft white glow around cards and buttons, even on every side (`boxShadow`, Android 9+). An `elevation` shadow
   * fell lower and to one side: Android lights it from above the screen (D-100). The elevation stays, with no visible
   * shadow, so a focused card is still drawn over its neighbours (D-076).
   */
  glow: { boxShadow: '0px 0px 16px 2px rgba(255, 255, 255, 0.5)', elevation: 14, shadowColor: 'transparent', shadowOpacity: 0 },
  /** Thin light ring for cards; rounded, and together with the glow it reads as light, not as a box. */
  ring: 'rgba(255,255,255,0.92)',
  /** Background of a focused row or text link: a translucent pill. */
  fill: 'rgba(255,255,255,0.16)',
  /** A focused button or chip is filled white with dark text. */
  solid: '#fff',
  onSolid: '#000',
  /** Rounded corners for highlights. */
  radius: 10,
  pill: 999,
} as const;

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

/**
 * Pressable that accepts animated styles (the focus scale). `hasTVPreferredFocus` only applies on TV: an animated
 * component sends it again on re-renders, and on a phone that pulled focus away from the search field when the
 * keyboard opened (the Home hero's Play button re-rendered for the smaller screen).
 */
export const AnimatedPressable = forwardRef<View, ComponentProps<typeof AnimatedPressableBase>>(function AnimatedPressable(
  { hasTVPreferredFocus, ...props },
  ref,
) {
  return <AnimatedPressableBase ref={ref} {...props} hasTVPreferredFocus={Platform.isTV ? hasTVPreferredFocus : undefined} />;
});

/** Scale that springs to `to` while focused and back to 1 on blur (runs on the native thread). */
export function useFocusScale(focused: boolean, to = 1.06): Animated.Value {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const animation = Animated.spring(scale, { toValue: focused ? to : 1, useNativeDriver: true, speed: 24, bounciness: 5 });
    animation.start();
    return () => animation.stop();
  }, [focused, to, scale]);
  return scale;
}
