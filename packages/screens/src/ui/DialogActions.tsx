import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { t } from '@iptv/shared';
import { FocusButton } from './FocusButton';
import { FocusRow } from './FocusRow';

/**
 * The buttons at the bottom of every dialog that changes something (DECISIONS.md#d-232): Save (primary) then Cancel,
 * at the bottom right, below the dialog's content so a long list scrolls above them. Save keeps the changes, Cancel
 * (and Back or Escape) closes without them. `children`: other buttons (Delete, Automatic) before Save. A dialog that
 * applies a choice on press (a language picker) leaves out `onSave` and shows only Cancel.
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
  return (
    <FocusRow style={styles.actions}>
      {children}
      {onSave ? <FocusButton label={saveLabel} variant="primary" disabled={saveDisabled} onPress={onSave} testID={saveTestID} /> : null}
      {onCancel ? <FocusButton label={t('Cancel')} variant="ghost" onPress={onCancel} testID={cancelTestID} /> : null}
    </FocusRow>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 12 },
});
