import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radius } from '../theme';

/** Labelled text field; selecting it opens the on-screen keyboard. */
export function Field({
  label,
  value,
  onChange,
  secure,
  testID,
  autoFocus,
  placeholder,
  compact,
}: {
  label: string;
  value: string;
  onChange(v: string): void;
  secure?: boolean;
  testID: string;
  autoFocus?: boolean;
  placeholder?: string;
  compact?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, compact && styles.fieldCompact]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        hasTVPreferredFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, compact && styles.inputCompact, focused && styles.inputFocused]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  fieldCompact: { gap: 4 },
  label: { color: colors.muted, fontSize: 14 },
  input: {
    minHeight: 48,
    backgroundColor: colors.input,
    color: colors.strong,
    fontSize: fonts.body,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputCompact: { minHeight: 40, paddingVertical: 8 },
  inputFocused: { borderColor: colors.strong },
});
