import { createContext, useCallback, useContext, useRef } from 'react';
import { findNodeHandle, type NativeSyntheticEvent, type View } from 'react-native';

/** A page's focusable native view (react-native-tvos adds `requestTVFocus`). */
export type PageView = View & { requestTVFocus?(): void; isConnected?: boolean };
interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The page under the top nav and the details panel (D-069). */
export interface PageFocus {
  /** The details panel covers the page. */
  behind: boolean;
  register(view: PageView): () => void;
}
export const PageFocusContext = createContext<PageFocus | null>(null);

/**
 * The page's buttons and covers, and the one that last had the focus. When the details panel closes, the focus goes
 * back to the one that opened it, or else to the first one on screen (D-069): Android used to hand it to any view.
 * `wait` is how long a requested focus may take to arrive before the next view is tried.
 */
export function createPageFocus(wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))) {
  const views = new Set<PageView>();
  // Kept when its view unregisters: an animated card detaches and re-attaches its ref whenever its style changes (on
  // focus and on blur), which used to forget it right as the details opened (DECISIONS.md#d-069).
  let last: PageView | null = null;
  // Counts the page's focus events, to tell whether a requested focus arrived.
  let seen = 0;
  const live = (view: PageView) => views.has(view) || view.isConnected === true;
  /** Asks `view` for the focus; false when no focus reached the page soon after. */
  const request = async (view: PageView) => {
    const before = seen;
    view.requestTVFocus?.();
    await wait(FOCUS_WAIT_MS);
    return seen !== before;
  };
  return {
    register(view: PageView) {
      views.add(view);
      return () => {
        views.delete(view);
      };
    },
    /** `onFocusCapture` of the page: remembers the view that got the focus. */
    focused(event: NativeSyntheticEvent<unknown>) {
      seen++;
      const target = event.target as unknown;
      if (target && typeof target === 'object' && typeof (target as PageView).requestTVFocus === 'function') {
        last = target as PageView;
        return;
      }
      const tag = typeof target === 'number' ? target : (event.nativeEvent as { target?: number } | undefined)?.target;
      if (tag === undefined) return;
      for (const view of views) if (findNodeHandle(view) === tag) last = view;
    },
    /** Focus back on the view that had it, or the first one on screen. Resolves to the view focused, if any. */
    async restore(screen: { width: number; height: number }): Promise<PageView | null> {
      if (last && live(last) && (await request(last))) return last;
      const boxes = await Promise.all(
        [...views].filter((view) => view !== last).map((view) => measure(view).then((box) => ({ view, box }))),
      );
      const first = firstOnScreen(boxes, screen);
      if (first) await request(first);
      return first;
    },
  };
}

/** How long a focus asked of a view may take to reach the page (a frame or two on a TV). */
const FOCUS_WAIT_MS = 250;
export type PageFocusController = ReturnType<typeof createPageFocus>;

const measure = (view: PageView) =>
  new Promise<Box | null>((resolve) => {
    try {
      view.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
    } catch {
      resolve(null);
    }
  });

/** The view on screen (its middle inside the screen) highest up, then furthest left. */
export function firstOnScreen<T>(items: { view: T; box: Box | null }[], screen: { width: number; height: number }): T | null {
  let best: { view: T; box: Box } | null = null;
  for (const { view, box } of items) {
    if (!box || box.width <= 0 || box.height <= 0) continue;
    const midX = box.x + box.width / 2;
    const midY = box.y + box.height / 2;
    if (midX < 0 || midX > screen.width || midY < 0 || midY > screen.height) continue;
    // A focused card is drawn a little larger: tops within a few points are the same line.
    if (!best || box.y < best.box.y - 4 || (Math.abs(box.y - best.box.y) <= 4 && box.x < best.box.x)) best = { view, box };
  }
  return best?.view ?? null;
}

/**
 * A focusable view of the page: its `hasTVPreferredFocus`, and a ref that lists it for the focus to come back to.
 * A view with `hasTVPreferredFocus` asks Android for the focus when it appears or when it turns on, and got it behind
 * the details panel (My List's first card, after a press on the panel's My List button). While the panel is open the
 * value is held as it was, so nothing behind asks; a value that came up meanwhile is not acted on after it closes
 * either, until it changes again (no jump on closing).
 */
export function usePageFocusable(wanted: boolean | undefined): { preferred: boolean; ref: (view: View | null) => void } {
  const page = useContext(PageFocusContext);
  const behind = !!page?.behind;
  const value = !!wanted;
  const state = useRef<{ given: boolean; seenBehind: boolean | null }>({ given: behind ? false : value, seenBehind: null });
  if (behind) state.current.seenBehind = value;
  else if (state.current.seenBehind === null || state.current.seenBehind !== value) {
    state.current.given = value;
    state.current.seenBehind = null;
  }
  const unregister = useRef<(() => void) | null>(null);
  const register = page?.register;
  const ref = useCallback(
    (view: View | null) => {
      unregister.current?.();
      unregister.current = view && register ? register(view as PageView) : null;
    },
    [register],
  );
  return { preferred: state.current.given, ref };
}

/** One ref callback for several refs. */
export function mergeRefs<T>(...refs: (((value: T | null) => void) | { current: T | null } | null | undefined)[]) {
  return (value: T | null) => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(value);
      else if (ref) ref.current = value;
    }
  };
}
