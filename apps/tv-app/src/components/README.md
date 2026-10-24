# components

Same look as the web components ([D-079](../../../../documentation/DECISIONS.md#d-079)); everything is also D-pad focusable.

| File                       | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TopNav.tsx`               | The top nav, shared with the desktop (`packages/screens`, D-208); its page, search text and menu live in the nav store. |
| `AccountMenu.tsx`          | The account menu under the avatar, shared with the desktop (`packages/screens`, D-207); open and its group live in the nav store, so Back leaves a group first. |
| `Field.tsx`                | Moved to `packages/screens/src/ui` (shared with the desktop, D-199); re-exported here. |
| `focusGrid.ts` | Moved to `packages/screens/src/ui` (shared with the desktop, D-201); re-exported here. |
| `PlaybackSettings.tsx`     | Account menu → Playback: audio decoder choice (Device decoders first, the default / FFmpeg first), D-059.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `FocusButton.tsx`          | Moved to `packages/screens/src/ui` (shared with the desktop, D-195); re-exported here. |
| `focus.tsx`                | Moved to `packages/screens/src/ui` (shared with the desktop, D-194); re-exported here. |
| `pageFocus.ts`             | Moved to `packages/screens/src/ui` (shared with the desktop, D-194); re-exported here. |
| `IconButton.tsx`           | Moved to `packages/screens/src/ui` (shared with the desktop, D-198); re-exported here. |
| `Icon.tsx`                 | Moved to `packages/screens/src/ui` (shared with the desktop, D-194); re-exported here. |
| `Gradient.tsx`             | Moved to `packages/screens/src/ui` (shared with the desktop, D-197); re-exported here. |
| `PosterCard.tsx`           | Moved to `packages/screens/src/ui` (shared with the desktop, D-194); re-exported here. |
| `ChipBar.tsx`              | Moved to `packages/screens/src/ui` (shared with the desktop, D-195); re-exported here. |
| `Row.tsx`, `rowReveal.ts`  | Moved to `packages/screens/src/ui` (shared with the desktop, D-197); re-exported here. |
| `Select.tsx`               | Moved to `packages/screens/src/ui` (shared with the desktop, D-195); re-exported here. |
| `WatchedTag.tsx`           | Moved to `packages/screens/src/ui` (shared with the desktop, D-194); re-exported here. |
| `WatchedButton.tsx` | Moved to `packages/screens/src/ui` (shared with the desktop, D-202); re-exported here. |
| `Feedback.tsx`             | Moved to `packages/screens/src/ui` (shared with the desktop, D-195); re-exported here. |
| `FocusRow.tsx`             | Moved to `packages/screens/src/ui` (shared with the desktop, D-194); re-exported here. |
| `LibraryBanner.tsx`        | Re-exports the shared library banner and refresh notice (`packages/screens`, D-215).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
