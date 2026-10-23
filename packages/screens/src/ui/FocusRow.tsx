import { createContext, useContext, type ReactNode } from 'react';
// Read through the namespace: React Native Web (desktop) has no TVFocusGuideView, and a named import of it fails there.
import * as ReactNative from 'react-native';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import type { Measurable } from './CenterScroll';

/**
 * A horizontal group of focusable items (a row of cards, chips, buttons). On TV, Left/Right stay inside it: at the ends
 * they stop instead of jumping to a row above or below (D-069). Up/Down leave it as usual. `leftOpen`: Left at
 * the start may leave it, for a row whose start sits beside a side column (the guide's channels, beside the categories).
 * `rightOpen`: Right at the end may leave it, for a row in a side column beside a list (landscape details, D-158).
 */
export function FocusRow({
  children,
  style,
  testID,
  accessibilityLabel,
  leftOpen,
  rightOpen,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
  leftOpen?: boolean;
  rightOpen?: boolean;
}) {
  if (!Platform.isTV)
    return (
      <View style={style} testID={testID} accessibilityLabel={accessibilityLabel}>
        {children}
      </View>
    );
  const { TVFocusGuideView } = ReactNative;
  return (
    <TVFocusGuideView
      trapFocusLeft={!leftOpen}
      trapFocusRight={!rightOpen}
      style={style}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </TVFocusGuideView>
  );
}

/** Set by a page that scrolls vertically (Home): an item of a row got focus, so the page can centre that row. */
export const RowFocus = createContext<(() => void) | null>(null);
export const useRowFocus = () => useContext(RowFocus);

/**
 * Set by a TV row that scrolls (`Row`): a card that gets the focus calls it with itself, and the row scrolls so the
 * card sits fully on screen, clear of the screen sides (DECISIONS.md#d-181). Null elsewhere.
 */
export const RowReveal = createContext<((target: Measurable | null) => void) | null>(null);
export const useRowReveal = () => useContext(RowReveal);
