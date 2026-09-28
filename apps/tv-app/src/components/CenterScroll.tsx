import { createContext, useCallback, useContext, useRef, type ReactNode, type RefObject } from 'react';
import { Platform, ScrollView, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewProps } from 'react-native';

/** Anything that can report where it is on screen (a focused card or button). */
export interface Measurable {
  measureInWindow(callback: (x: number, y: number, width: number, height: number) => void): void;
}

/**
 * Set by a vertical page on TV: a card or button that gets the focus calls it with itself, and the page scrolls so it
 * sits in the middle of the screen, like the rows on Home (D-094). Null elsewhere (phones, pages that do not center).
 */
export const CenterFocus = createContext<((target: Measurable | null) => void) | null>(null);
export const useCenterFocus = () => useContext(CenterFocus);

/** Scroll offset that puts an element (at `targetY`, `targetHeight` on screen) in the middle of the scroll view. */
export function centeredOffset(offset: number, viewTop: number, viewHeight: number, targetY: number, targetHeight: number): number {
  return Math.max(0, offset + (targetY - viewTop) - (viewHeight - targetHeight) / 2);
}

/**
 * ScrollView that keeps the focused element in the middle of the screen on TV. On phones it is a plain ScrollView.
 * Props pass through; `onScroll` still receives every scroll event.
 */
export function CenteringScrollView({
  children,
  onScroll,
  scrollRef,
  ...props
}: ScrollViewProps & { children?: ReactNode; scrollRef?: RefObject<ScrollView | null> }) {
  const ownRef = useRef<ScrollView>(null);
  const ref = scrollRef ?? ownRef;
  const offset = useRef(0);
  const center = useCallback(
    (target: Measurable | null) => {
      const scroll = ref.current as unknown as Measurable | null;
      if (!target || !scroll) return;
      scroll.measureInWindow((_sx, top, _sw, height) => {
        target.measureInWindow((_x, y, _w, h) => {
          if (!height || !h) return;
          const next = centeredOffset(offset.current, top, height, y, h);
          if (Math.abs(next - offset.current) > 4) ref.current?.scrollTo({ y: next, animated: true });
        });
      });
    },
    [ref],
  );
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = event.nativeEvent.contentOffset.y;
    onScroll?.(event);
  };
  return (
    <CenterFocus.Provider value={Platform.isTV ? center : null}>
      <ScrollView ref={ref} scrollEventThrottle={100} {...props} onScroll={handleScroll}>
        {children}
      </ScrollView>
    </CenterFocus.Provider>
  );
}
