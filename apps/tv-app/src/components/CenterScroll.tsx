import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode, type RefObject } from 'react';
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

/**
 * Set by a centering page on TV for content that knows where its lines sit, like the rows on Home (D-096): `centerAt`
 * scrolls straight to a place in the page, with nothing to measure first; `inner` is the page's content view, for
 * measuring where a block starts.
 */
export interface CenterPageApi {
  centerAt(y: number, height: number): void;
  inner(): unknown;
}
export const CenterPage = createContext<CenterPageApi | null>(null);
export const useCenterPage = () => useContext(CenterPage);

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
  // The page's content view (in React Native's ScrollView, not in its type definitions).
  const inner = useCallback(() => (ref.current as unknown as { getInnerViewRef?(): unknown } | null)?.getInnerViewRef?.(), [ref]);
  const centerAt = useCallback(
    (y: number, height: number) => {
      if (!height || !viewport.current) return;
      const next = centeredOffset(y, height, viewport.current);
      if (lastTarget.current !== null && Math.abs(next - lastTarget.current) < 4) return;
      lastTarget.current = next;
      ref.current?.scrollTo({ y: next, animated: true });
    },
    [ref],
  );
  const center = useCallback(
    (target: Measurable | null) => {
      const content = inner();
      if (!target || !content) return;
      target.measureLayout(
        content,
        (_x, y, _width, height) => centerAt(y, height),
        () => undefined,
      );
    },
    [inner, centerAt],
  );
  const page = useMemo(() => (Platform.isTV ? { centerAt, inner } : null), [centerAt, inner]);
  return (
    <CenterPage.Provider value={page}>
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
    </CenterPage.Provider>
  );
}
