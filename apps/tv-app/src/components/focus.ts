import { useEffect, useRef } from 'react';
import { Animated, Pressable } from 'react-native';

/**
 * D-pad focus look, shared by all focusable items: instead of a hard white box, the focused item grows smoothly
 * (spring) and lights up, with a soft glow, a filled pill or a highlighted row.
 */
export const focus = {
  /** Soft white glow around cards and buttons (Android draws it from `elevation` with `shadowColor`, API 28+). */
  glow: { shadowColor: '#fff', shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 14 },
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

/** Pressable that accepts animated styles (the focus scale). */
export const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
