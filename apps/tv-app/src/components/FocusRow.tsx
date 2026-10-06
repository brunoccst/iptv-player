import { createContext, useContext, type ReactNode } from 'react';
import { Platform, TVFocusGuideView, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * A horizontal group of focusable items (a row of cards, chips, buttons). On TV, Left/Right stay inside it: at the ends
 * they stop instead of jumping to a row above or below. Up/Down leave it as usual.
 */
export function FocusRow({ children, style, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  if (!Platform.isTV)
    return (
      <View style={style} testID={testID}>
        {children}
      </View>
    );
  return (
    <TVFocusGuideView trapFocusLeft trapFocusRight style={style} testID={testID}>
      {children}
    </TVFocusGuideView>
  );
}

/** Set by a page that scrolls vertically (Home): an item of a row got focus, so the page can centre that row. */
export const RowFocus = createContext<(() => void) | null>(null);
export const useRowFocus = () => useContext(RowFocus);
