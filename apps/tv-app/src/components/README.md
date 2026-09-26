# components

Same look as the web components ([D-041](../../../../documentation/DECISIONS.md#d-041)); everything is also D-pad focusable.

| File | Purpose |
|------|---------|
| `TopNav.tsx` | Web top nav: brand, Home / Series / Movies / Live TV / My Downloads, search box, account avatar. Transparent over the Home hero until it scrolls. |
| `AccountMenu.tsx` | Menu under the avatar: other profiles, Manage Profiles, Parental PIN, Language (D-063), Sync with phone (TV) or Connect a TV (phone, D-060), Back up data, Playback (when FFmpeg is bundled), Refresh library, Check for updates (release builds, D-062), Log, Sign out. `confirmSignOut` asks first. |
| `PinPad.tsx` | Parental PIN keypad for D-pad and touch, and `usePinGate` (D-054). |
| `PinSettings.tsx` | Parental PIN flow: set (typed twice), or change/remove after the current PIN. |
| `BackupDialog.tsx` | Back up data (password twice → system folder picker → `.iptvbackup` file) and Restore from backup (file picker → password → `appContext.reload()`), D-056. |
| `Field.tsx` | Labelled text field (login, backup); `onSubmit` + `inputRef` let Enter move to the next field. |
| `LanguageSettings.tsx` | Account menu → Language: only titles with audio or subtitles in that language, per profile (D-063). |
| `PlaybackSettings.tsx` | Account menu → Playback: audio decoder choice (Device decoders first, the default / FFmpeg first), D-059. |
| `FocusButton.tsx` | Web `.button` (primary, secondary, accent, ghost) with optional icon; focus shows a white outline. |
| `IconButton.tsx` | Web `.icon-button` (round) and plain player controls. |
| `Icon.tsx` | Shared 24×24 icon set (`iconPaths` from `@iptv/shared`) drawn with react-native-svg. |
| `Gradient.tsx` | CSS-like `linear-gradient` (hero, nav and player shades). |
| `PlayOnTvButton.tsx` | Phones with a paired TV: round TV button next to Play that starts the title on the TV (D-061). |
| `PosterCard.tsx` | Web `.card`: 2:3 or 16:9 art, badge, progress bar, title + subtitle; focus scales it up. `testID="card-<title>"`. |
| `ChipBar.tsx` | Category chips on one scrollable line; "Show all" wraps them across the width, "Show less" (or picking one) returns to the line with the chosen chip in view (D-047). Also exports `Chip`. |
| `Row.tsx` | Web `.row`: title (optionally a link "Drama ›"), horizontal cards, loading spinner, optional "See all" arrow card at the end, built like a card so it lines up in landscape rows too (D-043). |
| `Select.tsx` | Web `.select`: box with the current value; opens an option list. |
| `DownloadButton.tsx` | Round download button with progress ring; start / pause / resume. |
| `ExternalPlayerButton.tsx` | Round "open in another player" button on the details panel (D-057). |
| `WatchlistButton.tsx` | Round "My List" toggle (plus / check) on the details panel (D-055). |
| `ProgressRing.tsx` | SVG progress circle. |
| `Feedback.tsx` | Loading indicator, error text, `errorText()` mapping. |
