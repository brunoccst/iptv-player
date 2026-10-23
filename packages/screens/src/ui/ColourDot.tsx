import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/** The TV remote's colour keys (D-154): one meaning each, wherever you are. */
export type ColourKey = 'red' | 'green' | 'yellow' | 'blue';

export const COLOUR_KEY_COLOURS: Record<ColourKey, string> = {
  red: '#e53935',
  green: '#43a047',
  yellow: '#fdd835',
  blue: '#1e88e5',
};

export const isColourKey = (key: string): key is ColourKey => key in COLOUR_KEY_COLOURS;

/** TV: a small dot in a colour key's colour on the button that key also presses. Nothing on phones or the desktop. */
export function ColourDot({ colour, style }: { colour: ColourKey; style?: StyleProp<ViewStyle> }) {
  if (!Platform.isTV) return null;
  return (
    <View
      pointerEvents="none"
      testID={`colour-dot-${colour}`}
      style={[styles.dot, { backgroundColor: COLOUR_KEY_COLOURS[colour] }, style]}
    />
  );
}

const styles = StyleSheet.create({
  dot: { position: 'absolute', top: 0, right: 0, width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(0,0,0,0.5)' },
});
