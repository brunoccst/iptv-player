import type { ReactNode } from 'react';
// Read through the namespace: React Native Web (desktop) has no TVFocusGuideView, and a named import of it fails there.
import * as ReactNative from 'react-native';
import { Platform, StyleSheet, View } from 'react-native';
import { t } from '@iptv/shared';
import { useDialogSide } from './Dialog';
import { FocusButton } from './FocusButton';
import { FocusRow } from './FocusRow';

/**
 * The buttons of every dialog that changes something (DECISIONS.md#d-232): Save (primary) and Cancel. Passed to
 * `Dialog` as `actions`, they stand in a column on the right of the content, Save on top, so Right from any row of a
 * list reaches Save (DECISIONS.md#d-233); on a narrow window, or in a dialog that draws its own panel, they sit at the
 * bottom right. Save keeps the changes, Cancel (and Back or Escape) closes without them. `children`: other buttons
 * (Delete, Automatic), before Save at the bottom and under Cancel in the column. A dialog that applies a choice on
 * press (a language picker) leaves out `onSave` and shows only Cancel.
 */
export function DialogActions({
  onSave,
  onCancel,
  saveLabel = t('Save'),
  saveDisabled,
  saveTestID,
  cancelTestID,
  children,
}: {
  onSave?(): void;
  onCancel?(): void;
  /** E.g. "Checking…" while saving, or what Save does ("Save backup file"). */
  saveLabel?: string;
  saveDisabled?: boolean;
  saveTestID?: string;
  cancelTestID?: string;
  children?: ReactNode;
}) {
  const side = useDialogSide();
  const save = onSave ? (
    <FocusButton label={saveLabel} variant="primary" disabled={saveDisabled} onPress={onSave} testID={saveTestID} />
  ) : null;
  const cancel = onCancel ? <FocusButton label={t('Cancel')} variant="ghost" onPress={onCancel} testID={cancelTestID} /> : null;
  if (side) {
    // TV: the column fills the dialog's height, so Right from any row lands in it; the first visit goes to Save, a
    // later one back to the button last focused there. Up/Down stay in the column, Left goes back to the content.
    const { TVFocusGuideView } = ReactNative;
    const Column = (Platform.isTV && TVFocusGuideView) || View;
    return (
      <Column {...(Column === View ? {} : { autoFocus: true, trapFocusUp: true, trapFocusDown: true })} style={styles.column}>
        {save}
        {cancel}
        {children}
      </Column>
    );
  }
  return (
    <FocusRow style={styles.actions}>
      {children}
      {save}
      {cancel}
    </FocusRow>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 12 },
  column: { flex: 1, gap: 12 },
});
