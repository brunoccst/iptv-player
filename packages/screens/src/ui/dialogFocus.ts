import { createContext, useContext } from 'react';

/**
 * TV, inside a dialog's content beside its Save/Cancel column (DECISIONS.md#d-247). Rows there let Right leave their
 * end for the column (`FocusRow`), and focused items tell the dialog where Left from the column goes back to: a tab
 * (`Chip`) passes itself, so Left from Save returns to the tab row beside it; a list row or button (`CheckRow`,
 * `FocusButton`) passes null, so Left returns to that row (D-233). Text fields pass nothing: the filter under the tabs
 * leaves the tab as the way back. Null elsewhere, and off TV.
 */
export interface DialogContentFocus {
  returnTo(target: unknown): void;
}

export const DialogContent = createContext<DialogContentFocus | null>(null);
export const useDialogContent = () => useContext(DialogContent);
