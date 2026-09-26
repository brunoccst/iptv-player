import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { colors } from '../theme';
import { Icon } from './Icon';
import { focus } from './focus';
import { FocusRow } from './FocusRow';

export interface ChipItem {
  key: string;
  label: string;
  active: boolean;
  onPress(): void;
  testID?: string;
}

/**
 * Category chips on one scrollable line. When they do not fit, "Show all" wraps every chip across the width and
 * "Show less" returns to the line; picking a chip also returns to it, scrolled so the chosen chip is in view.
 */
export function ChipBar({ chips, label, testID }: { chips: ChipItem[]; label: string; testID?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [lineWidth, setLineWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const scroll = useRef<ScrollView>(null);
  // Scroll the active chip into view once it is laid out: on open (e.g. from a Home row) and after collapsing.
  const reveal = useRef(true);
  const overflows = contentWidth > lineWidth + 1;

  const choose = (chip: ChipItem) => {
    reveal.current = true;
    setExpanded(false);
    chip.onPress();
  };
  // Chips can report several layouts while the line settles; scroll once, shortly after the last one.
  const activeX = useRef<number | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (revealTimer.current && clearTimeout(revealTimer.current)), []);
  const scheduleReveal = () => {
    if (!reveal.current || activeX.current === null) return;
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(() => {
      reveal.current = false;
      scroll.current?.scrollTo({ x: Math.max(0, (activeX.current ?? 0) - 24), animated: false });
    }, 50);
  };
  const onChipLayout = (chip: ChipItem, event: LayoutChangeEvent) => {
    if (expanded || !chip.active) return;
    activeX.current = event.nativeEvent.layout.x;
    scheduleReveal();
  };

  const items = chips.map((chip) => (
    <Chip
      key={chip.key}
      label={chip.label}
      active={chip.active}
      testID={chip.testID}
      onPress={() => choose(chip)}
      onLayout={(event) => onChipLayout(chip, event)}
    />
  ));

  return (
    <FocusRow style={styles.bar} testID={testID}>
      {expanded ? (
        <View style={[styles.line, styles.wrap]} accessibilityLabel={label}>
          {items}
        </View>
      ) : (
        <ScrollView
          ref={scroll}
          testID={testID && `${testID}-line`}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.line}
          contentContainerStyle={styles.chips}
          accessibilityLabel={label}
          onLayout={(event) => setLineWidth(event.nativeEvent.layout.width)}
          onContentSizeChange={(width) => {
            setContentWidth(width);
            scheduleReveal();
          }}
        >
          {items}
        </ScrollView>
      )}
      {expanded || overflows ? (
        <Toggle
          expanded={expanded}
          testID={testID && `${testID}-${expanded ? 'less' : 'all'}`}
          onPress={() => {
            reveal.current = expanded;
            setExpanded(!expanded);
          }}
        />
      ) : null}
    </FocusRow>
  );
}

/** "Show all ⌄" / "Show less ⌃": stays in the same place in both modes. */
function Toggle({ expanded, onPress, testID }: { expanded: boolean; onPress(): void; testID?: string }) {
  const [focused, setFocused] = useState(false);
  const text = expanded ? 'Show less' : 'Show all';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={expanded ? 'Show fewer categories' : 'Show all categories'}
      accessibilityState={{ expanded }}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.chip, styles.toggle, focused && styles.chipFocused]}
    >
      <Text style={styles.chipText}>{text}</Text>
      <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={18} color={colors.text} />
    </Pressable>
  );
}

/** Web `.chip`: pill; the active one is white with black text. */
export function Chip({
  label,
  active,
  onPress,
  onLayout,
  testID,
}: {
  label: string;
  active: boolean;
  onPress(): void;
  onLayout?(event: LayoutChangeEvent): void;
  testID?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      onLayout={onLayout}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.chip, active && styles.chipActive, focused && styles.chipFocused]}
    >
      <Text style={[styles.chipText, (active || focused) && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 24 },
  line: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chips: { gap: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 999 },
  chipActive: { borderColor: colors.strong, backgroundColor: colors.strong },
  // Focused: filled white with dark text and a glow, like a focused button.
  chipFocused: { borderColor: focus.solid, backgroundColor: focus.solid, ...focus.glow },
  chipText: { color: colors.text, fontSize: 14 },
  chipTextActive: { color: '#000' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 10, backgroundColor: colors.raised },
});
