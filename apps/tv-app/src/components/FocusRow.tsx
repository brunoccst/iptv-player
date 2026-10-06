import { createContext, useContext, type ReactNode } from 'react';
import { Platform, TVFocusGuideView, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * A horizontal group of focusable items (a row of cards, chips, buttons). On TV, Left/Right stay inside it: at the ends
 * they stop instead of jumping to a row above or below (D-069, D-152). Up/Down leave it as usual. `leftOpen`: Left at
 * the start may leave it, for a row whose start sits beside a side column (the guide's channels, beside the categories).
 */
export function FocusRow({
  children,
  style,
  testID,
  accessibilityLabel,
  leftOpen,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
  leftOpen?: boolean;
}) {
  if (!Platform.isTV)
    return (
      <View style={style} testID={testID} accessibilityLabel={accessibilityLabel}>
        {children}
      </View>
    );
  return (
    <TVFocusGuideView trapFocusLeft={!leftOpen} trapFocusRight style={style} testID={testID} accessibilityLabel={accessibilityLabel}>
      {children}
    </TVFocusGuideView>
  );
}

/** Set by a page that scrolls vertically (Home): an item of a row got focus, so the page can centre that row. */
export const RowFocus = createContext<(() => void) | null>(null);
export const useRowFocus = () => useContext(RowFocus);
