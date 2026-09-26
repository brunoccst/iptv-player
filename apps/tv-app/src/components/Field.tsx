import { useState, type Ref } from 'react';
import { StyleSheet, Text, TextInput, View, type ReturnKeyTypeOptions } from 'react-native';
import { colors, fonts, radius } from '../theme';

/**
 * Labelled text field; selecting it opens the on-screen keyboard. `onSubmit` runs on the keyboard's Enter key and keeps
 * focus here, so a form can move on to its next field (`inputRef.focus()`) instead of Android picking whatever control
 * is nearest.
 */
export function Field({
  label,
  value,
  onChange,
  secure,
  testID,
  autoFocus,
  placeholder,
  compact,
  inputRef,
  returnKeyType,
  onSubmit,
}: {
  label: string;
  value: string;
  onChange(v: string): void;
  secure?: boolean;
  testID: string;
  autoFocus?: boolean;
  placeholder?: string;
  compact?: boolean;
  inputRef?: Ref<TextInput>;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmit?(): void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, compact && styles.fieldCompact]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={inputRef}
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
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmit}
        submitBehavior={onSubmit ? 'submit' : undefined}
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
