import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from './theme';
import { focus } from './focus';
import { Icon } from './Icon';

/** A row with a check box, for lists of choices (categories); focus lights the row. */
export function CheckRow({ label, checked, onPress, testID }: { label: string; checked: boolean; onPress(): void; testID?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      // React Native Web reads the ARIA prop, not accessibilityState.
      aria-checked={checked}
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.row, focused && styles.rowFocused]}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>{checked ? <Icon name="check" size={16} color="#000" /> : null}</View>
      <Text style={styles.rowText} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8 },
  rowFocused: { backgroundColor: focus.fill },
  rowText: { color: colors.text, fontSize: fonts.small, flexShrink: 1 },
  box: {
    width: 20,
    height: 20,
    borderRadius: 3,
    borderWidth: 2,
    borderColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: colors.strong, borderColor: colors.strong },
});
