import { createContext, useContext, type ReactNode } from 'react';
import { Platform, TVFocusGuideView, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * A horizontal group of focusable items (a row of cards, chips, buttons). On TV, Left/Right stay inside it: at the ends
 * they stop instead of jumping to a row above or below. Up/Down leave it as usual.
 */
export function FocusRow({
  children,
  style,
  testID,
  autoFocus,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Entering from above/below lands on the first item (or the last one focused there), not the nearest one. */
  autoFocus?: boolean;
}) {
  if (!Platform.isTV)
    return (
      <View style={style} testID={testID}>
        {children}
      </View>
    );
  return (
    <TVFocusGuideView trapFocusLeft trapFocusRight autoFocus={autoFocus} style={style} testID={testID}>
      {children}
    </TVFocusGuideView>
  );
}

/** Set by a page that scrolls vertically (Home): an item of a row got focus, so the page can centre that row. */
export const RowFocus = createContext<(() => void) | null>(null);
export const useRowFocus = () => useContext(RowFocus);
