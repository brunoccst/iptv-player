import { createContext, useContext, useEffect, type ReactNode } from 'react';
// Read through the namespace: React Native Web (desktop) has no TVFocusGuideView, and a named import of it fails there.
import * as ReactNative from 'react-native';
import { Modal, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { t } from '@iptv/shared';
import { IconButton } from './IconButton';
import { colors, fonts } from './theme';

/** Dialogs open now, last on top: on the desktop Escape closes only the top one. */
const open: object[] = [];

/** Width of the button column beside a dialog's content (DECISIONS.md#d-233). */
const ACTIONS_WIDTH = 180;
const ACTIONS_GAP = 20;
/** Narrower windows (phones held upright) keep the buttons under the content. */
const SIDE_MIN_WINDOW = 600;

/** True inside a dialog's button column on the right: `DialogActions` stacks its buttons there. */
export const DialogSide = createContext(false);
export const useDialogSide = () => useContext(DialogSide);

/**
 * A dialog over the screen: a panel on a dark scrim with its title, closed by Back on TV and phone. On the desktop
 * Escape closes it from a window listener in the capture phase (React Native Web's text fields keep their key presses,
 * D-200), and only the top dialog closes (D-204). `tall`: the panel takes 92% of the window's height, for a dialog whose
 * long list scrolls with `flex: 1` between fixed parts (DECISIONS.md#d-231). `actions` (a `DialogActions`): its buttons,
 * in a column on the right of the content where the window is wide enough, so Right from any row of a list reaches
 * Save; under the content on narrow windows (DECISIONS.md#d-233). An X at the top right closes it on the desktop and
 * phone; the TV closes it with Back and shows no X, so D-pad focus never lands on it (DECISIONS.md#d-237).
 */
export function Dialog({
  title,
  label = title,
  onClose,
  testID,
  width = 560,
  tall,
  actions,
  children,
}: {
  title: string;
  /** What screen readers call it, when not its title (About shows the app's name). */
  label?: string;
  onClose(): void;
  testID?: string;
  width?: number;
  tall?: boolean;
  actions?: ReactNode;
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
  const { width: windowWidth, height } = useWindowDimensions();
  const side = !!actions && windowWidth >= SIDE_MIN_WINDOW;
  // TV: Left from the buttons goes back to the row last focused in the content, not to whichever sits beside Save.
  const { TVFocusGuideView } = ReactNative;
  const Content = (Platform.isTV && TVFocusGuideView) || View;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View
          style={[
            styles.panel,
            { width: side ? width + ACTIONS_WIDTH + ACTIONS_GAP : width },
            tall && { height: Math.round((height - 32) * 0.92) },
          ]}
          testID={testID}
          role="dialog"
          accessibilityLabel={label}
        >
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            <DialogClose onClose={onClose} />
          </View>
          {side ? (
            <View style={[styles.split, tall && styles.fill]}>
              <Content {...(Content === View ? {} : { autoFocus: true })} style={styles.content} testID="dialog-content">
                {children}
              </Content>
              <View style={styles.side} testID="dialog-side">
                <DialogSide.Provider value>{actions}</DialogSide.Provider>
              </View>
            </View>
          ) : (
            <>
              {children}
              {actions}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

/** The X that closes a dialog, on the desktop and phone (DECISIONS.md#d-237). For panels that draw their own header. */
export function DialogClose({ onClose }: { onClose(): void }) {
  if (Platform.isTV) return null;
  return <IconButton icon="close" label={t('Close')} onPress={onClose} size={36} iconSize={18} plain testID="dialog-close" />;
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
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { flex: 1, color: colors.strong, fontSize: fonts.heading, fontWeight: '700' },
  // The content and the button column side by side; the content's list scrolls inside its own column.
  split: { flexDirection: 'row', gap: ACTIONS_GAP, flexShrink: 1, minHeight: 0 },
  fill: { flex: 1 },
  content: { flex: 1, gap: 12, minHeight: 0 },
  side: { width: ACTIONS_WIDTH },
});
