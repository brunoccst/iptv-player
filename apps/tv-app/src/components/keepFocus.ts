import { useRef } from 'react';
import { Platform, type View } from 'react-native';
import { useRemote } from '../tv/remote';
import { moveFocus } from './focusGrid';

/** Keys that move the focus on purpose: after one of them, a lost focus is the person's doing. */
const MOVING_KEYS = new Set(['up', 'down', 'left', 'right', 'back', 'menu']);

/**
 * TV: a button that keeps the focus after it is pressed, until the D-pad moves on. Pressing "My List" changes the page
 * behind the details panel (the My List page's first card asks for the focus when it appears), and the focus went
 * there, out of sight. Any blur after the press that no D-pad key caused puts the focus back on the button.
 */
export function useKeepFocusAfterPress() {
  const view = useRef<View | null>(null);
  const pressed = useRef(false);
  useRemote(({ key, action }) => {
    if (action !== 'up' && MOVING_KEYS.has(key)) pressed.current = false;
  });
  return {
    focusRef: (instance: View | null) => {
      view.current = instance;
    },
    /** Call when the button is pressed. */
    pressed: () => {
      pressed.current = Platform.isTV;
    },
    onBlur: () => {
      if (!pressed.current) return;
      // After the blur ends, on the button's view then (a redrawn button has a new one).
      setTimeout(() => {
        if (pressed.current && view.current) moveFocus(view.current);
      }, 0);
    },
  };
}
