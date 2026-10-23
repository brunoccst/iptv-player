import { useReducer, useRef, useState } from 'react';
import type { View } from 'react-native';

/** The column Up/Down lands on in a neighbouring line: the same one, or that line's last when it has fewer. */
export function alignedColumn(column: number, count: number): number {
  return Math.max(0, Math.min(column, count - 1));
}

/**
 * TV: lines of buttons (an episode's Play, "…" and version) where Up/Down go to the button straight above or below,
 * not the one Android finds nearest or the one a line last had focused. Each button registers with `ref(key)`; `at(key)`
 * is that button's view, for `nextFocusUp`/`nextFocusDown`. A button that appears or goes away draws the list again
 * (`revision` goes up), so the neighbours' destinations follow. `ref` and `at` stay the same between renders, so a
 * line drawn on its own (`memo`) is not drawn again for them.
 */
export function useFocusGrid() {
  const views = useRef(new Map<string, View>());
  const refs = useRef(new Map<string, (view: View | null) => void>());
  const [revision, redraw] = useReducer((n: number) => n + 1, 0);
  const [grid] = useState(() => ({
    ref: (key: string) => {
      let set = refs.current.get(key);
      if (!set) {
        set = (view) => {
          if (view) views.current.set(key, view);
          else views.current.delete(key);
          redraw();
        };
        refs.current.set(key, set);
      }
      return set;
    },
    at: (key: string): View | undefined => views.current.get(key),
  }));
  return { ...grid, revision };
}

/** TV: puts the focus on `view` (react-native-tvos `requestTVFocus`), e.g. a page further down a list. */
export function moveFocus(view: View | undefined) {
  (view as unknown as { requestTVFocus?(): void } | undefined)?.requestTVFocus?.();
}
