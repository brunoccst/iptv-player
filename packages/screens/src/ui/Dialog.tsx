import { useEffect, type ReactNode } from 'react';
import { Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from './theme';

/** Dialogs open now, last on top: on the desktop Escape closes only the top one. */
const open: object[] = [];

/**
 * A dialog over the screen: a panel on a dark scrim with its title, closed by Back on TV and phone. On the desktop
 * Escape closes it from a window listener in the capture phase (React Native Web's text fields keep their key presses,
 * D-200), and only the top dialog closes (D-204).
 */
export function Dialog({
  title,
  onClose,
  testID,
  width = 560,
  children,
}: {
  title: string;
  onClose(): void;
  testID?: string;
  width?: number;
  children: ReactNode;
}) {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const token = {};
    open.push(token);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || open[open.length - 1] !== token) return;
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      open.splice(open.indexOf(token), 1);
    };
  }, [onClose]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={[styles.panel, { width }]} testID={testID} role="dialog" accessibilityLabel={title}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: 16 },
  panel: {
    maxWidth: '100%',
    maxHeight: '92%',
    padding: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  title: { color: colors.strong, fontSize: fonts.heading, fontWeight: '700' },
});
