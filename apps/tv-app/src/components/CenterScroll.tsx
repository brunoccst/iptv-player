import { createContext, useCallback, useContext, useRef, type ReactNode, type RefObject } from 'react';
import { Platform, ScrollView, type LayoutChangeEvent, type ScrollViewProps } from 'react-native';

/** A focused card or button: it can report where it sits inside the page. */
export interface Measurable {
  measureLayout(relativeTo: unknown, onSuccess: (x: number, y: number, width: number, height: number) => void, onFail?: () => void): void;
}

/**
 * Set by a vertical page on TV: a card or button that gets the focus calls it with itself, and the page scrolls so it
 * sits in the middle of the screen, like the rows on Home (D-094). Null elsewhere (phones, pages that do not center).
 */
export const CenterFocus = createContext<((target: Measurable | null) => void) | null>(null);
export const useCenterFocus = () => useContext(CenterFocus);

/** Scroll offset that puts an element at `y` (inside the page), `height` tall, in the middle of a `viewport`. */
export function centeredOffset(y: number, height: number, viewport: number): number {
  return Math.max(0, Math.round(y - (viewport - height) / 2));
}

/**
 * ScrollView that keeps the focused element in the middle of the screen on TV. On phones it is a plain ScrollView.
 *
 * The target comes from where the element sits inside the page, never from where it is on screen: measured on screen,
 * it depended on the current scroll offset, which is stale while a scroll animates, so one move scrolled in two steps
 * and quick presses scrolled back to earlier titles (D-095). The same target is not sent twice.
 */
export function CenteringScrollView({
  children,
  onLayout,
  scrollRef,
  ...props
}: ScrollViewProps & { children?: ReactNode; scrollRef?: RefObject<ScrollView | null> }) {
  const ownRef = useRef<ScrollView>(null);
  const ref = scrollRef ?? ownRef;
  const viewport = useRef(0);
  const lastTarget = useRef<number | null>(null);
  const center = useCallback(
    (target: Measurable | null) => {
      // The page's content view (in React Native's ScrollView, not in its type definitions).
      const inner = (ref.current as unknown as { getInnerViewRef?(): unknown } | null)?.getInnerViewRef?.();
      if (!target || !inner || !viewport.current) return;
      target.measureLayout(
        inner,
        (_x, y, _width, height) => {
          if (!height) return;
          const next = centeredOffset(y, height, viewport.current);
          if (lastTarget.current !== null && Math.abs(next - lastTarget.current) < 4) return;
          lastTarget.current = next;
          ref.current?.scrollTo({ y: next, animated: true });
        },
        () => undefined,
      );
    },
    [ref],
  );
  return (
    <CenterFocus.Provider value={Platform.isTV ? center : null}>
      <ScrollView
        ref={ref}
        scrollEventThrottle={100}
        {...props}
        onLayout={(event: LayoutChangeEvent) => {
          viewport.current = event.nativeEvent.layout.height;
          onLayout?.(event);
        }}
      >
        {children}
      </ScrollView>
    </CenterFocus.Provider>
  );
}
