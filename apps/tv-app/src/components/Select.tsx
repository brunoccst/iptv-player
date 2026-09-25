import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../theme';
import { Icon } from './Icon';

export interface SelectOption {
  value: string;
  label: string;
}

/** Web `.select` (dark box with a chevron). Select opens the option list; Back closes it. */
export function Select({
  label,
  value,
  options,
  onChange,
  testID,
  compact,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange(value: string): void;
  testID?: string;
  /** `width: auto` (season picker) instead of full width. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const current = options.find((option) => option.value === value);
  return (
    <>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? ''}`}
        onPress={() => setOpen(true)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.box, compact ? styles.compact : styles.full, focused && styles.focused]}
      >
        <Text style={[styles.value, compact && styles.valueCompact]} numberOfLines={1}>
          {current?.label ?? ''}
        </Text>
        <Icon name="chevronRight" size={18} color={colors.text} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setOpen(false)} focusable={false}>
          <View style={styles.panel} accessibilityLabel={label}>
            <Text style={styles.title}>{label}</Text>
            <ScrollView>
              {options.map((option) => (
                <Option
                  key={option.value}
                  label={option.label}
                  selected={option.value === value}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                />
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function Option({ label, selected, onPress }: { label: string; selected: boolean; onPress(): void }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      hasTVPreferredFocus={selected}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.option, focused && styles.optionFocused]}
    >
      <View style={styles.check}>{selected ? <Icon name="check" size={18} /> : null}</View>
      <Text style={[styles.optionText, selected && styles.optionSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    backgroundColor: colors.input,
  },
  full: { alignSelf: 'stretch' },
  // Sized to its text, and allowed to shrink so a label beside it stays visible on narrow phones.
  compact: { alignSelf: 'flex-start', flexShrink: 1, minHeight: 40, paddingVertical: 8 },
  focused: { borderColor: colors.strong, borderWidth: 2 },
  value: { flex: 1, color: colors.strong, fontSize: fonts.body },
  valueCompact: { flex: 0, flexShrink: 1 },
  scrim: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: 16 },
  panel: {
    minWidth: 320,
    maxWidth: 520,
    maxHeight: '80%',
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  title: { color: colors.muted, fontSize: fonts.small, paddingHorizontal: 16, paddingVertical: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 16 },
  optionFocused: { backgroundColor: colors.raised },
  check: { width: 18 },
  optionText: { color: colors.text, fontSize: fonts.body },
  optionSelected: { color: colors.strong, fontWeight: '700' },
});
