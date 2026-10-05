# App parity

All apps share one look (the web design, D-041) and the same features where the device allows. What differs is how you reach them: a TV remote, a phone's touch screen, or a mouse and keyboard (the desktop app, which shows the web player; D-088). This table is the checklist; update it with every feature (D-079). Each feature links to its description in [FEATURES.md](FEATURES.md).

Legend: ✅ has it · ➖ does not apply to this device · ⏳ missing (the row names its backlog item, `Parity: …`, in [NEXT-STEPS](NEXT-STEPS.md))

## Keeping it current (D-080)

- A change that adds or changes something people see or use updates this table, its section in [FEATURES.md](FEATURES.md) and the [release notes](RELEASE-NOTES.md) (D-143) in the same pull request. The pull request template asks which apps the change covers.
- An app that should have a feature but does not yet is marked ⏳, and the row names an open backlog item `Parity: <title>` (in the *How it is reached* column). When the item is done, the cell becomes ✅ and the item moves to Done.
- CI checks it (`npm run lint:parity`, in *Lint and format*): every app cell of the Features table has ✅, ➖ or ⏳; every ⏳ names an open `Parity: …` item; every open `Parity: …` item is named here.

## Looks

| Element | TV (remote) | Phone (touch) | Web / desktop (mouse, keyboard) |
|---------|-------------|---------------|---------------------------------|
| Focused / hovered card | grows 8 %, light ring, soft white glow | pressed state | same as TV on hover and keyboard focus |
| Rows | room above and below so the ring and glow are not cut | same | same |
| Top nav, account menu | Profiles · Library & devices · App | same | same groups; a click elsewhere or Escape closes it, not the mouse leaving ([Account menu](FEATURES.md#account-menu)) |
| Dialogs | panel in the middle | same | same (Escape or a click outside closes) |

## Features

| Feature | TV | Phone | Web / desktop | How it is reached | Described in |
|---------|----|-------|---------------|-------------------|--------------|
| Card menu: Go to details, Mark as (not) watched (movies, series), Add to / Remove from My List; Continue Watching: remove (D-078, D-081, D-082, D-104) | ✅ | ✅ | ✅ | TV: hold OK · phone: long touch · web: right-click, menu key or Shift+F10 (a long touch where the browser reports it) | [Card menu](FEATURES.md#card-menu) |
| "Watched" tag on covers (bottom right) and in details (D-081, D-082) | ✅ | ✅ | ✅ | movies, episodes, fully watched series; an eye since D-104 | [Watched tag](FEATURES.md#watched-tag) |
| My List bookmark on covers (top right) and on the details button, filled when saved (issue #157) | ✅ | ✅ | ✅ | title cards on Home, Movies, Series, Search and My List | [Watchlist](FEATURES.md#watchlist) |
| Quality tag on covers (top left): "4K", or "CAM" / "TS" / "TC" / "SCR" when every version is a cinema copy (D-141) | ✅ | ✅ | ✅ | | [Quality tag](FEATURES.md#quality-tag) |
| Library banner (offline, organizing with per-kind progress) floats at the bottom over the content (D-142) | ✅ | ✅ | ✅ | Home, Movies, Series | [Library banner](FEATURES.md#library-banner) |
| Details: Watched toggle for the movie or the whole series (D-104) | ✅ | ✅ | ✅ | eye button next to My List | [Movie and series details](FEATURES.md#movie-and-series-details) |
| Mark a season watched or not watched (D-132) | ✅ | ✅ | ✅ | eye button just left of the season choice (issue #159) | [Seasons and episodes](FEATURES.md#seasons-and-episodes) |
| Whole episode description on demand (issue #160) | ➖ | ✅ | ✅ | two lines, then "…"; touch or click the description to show or fold it · TV: not a D-pad stop, so Play stays first in the row (D-083) | [Seasons and episodes](FEATURES.md#seasons-and-episodes) |
| Episode options in series details: Mark as (not) watched, Download, Play on TV, Open in another player (D-082, D-083) | ✅ | ✅ | ✅ | row: Play, "…", version · "…" or TV: hold OK on Play · phone: long touch · web: right-click the episode | [Seasons and episodes](FEATURES.md#seasons-and-episodes) |
| Player: from the beginning, previous / next episode | ✅ | ✅ | ✅ | TV: ↓ to the buttons · phone and web: tap or click | [Playback controls](FEATURES.md#playback-controls) |
| Player: ±10 s, Skip ahead, next-up | ✅ | ✅ | ✅ | TV: ←/→ and hold to scrub · phone: double tap · web: ←/→ keys, click | [Playback controls](FEATURES.md#playback-controls) |
| Player: audio, subtitles, versions, episodes | ✅ | ✅ | ✅ | TV/phone: Audio, Subtitles, Episodes buttons on the player bar (↑/↓ open the bar on TV, D-101, D-102) · web: buttons | [Audio, subtitles, versions and episodes](FEATURES.md#audio-subtitles-versions-and-episodes) |
| Player pauses when the headphones go away (D-092) | ✅ | ✅ | ✅ | TV: Bluetooth headphones · phone: wired or Bluetooth · desktop: an output device removed | [Pause when the headphones go away](FEATURES.md#pause-when-the-headphones-go-away) |
| Last picked subtitles, audio and version are every title's default (D-087) | ✅ | ✅ | ✅ | matched by language (versions: same quality first), per profile; with none, the best version: highest quality, then the profile's or app's language (D-136) | [Version choice and "(best)"](FEATURES.md#version-choice-and-best) |
| Why a stream failed (provider's answer, D-074) | ✅ | ✅ | ✅ | in the error and the log | [Playback errors](FEATURES.md#playback-errors) |
| Category chips on one line with Show all / Show less; expanded, a full-width box that scrolls on its own (D-085, D-091) | ✅ | ✅ | ✅ | TV: ↓ to the button · phone: tap · web: click (the wheel scrolls the line) | [Category chips](FEATURES.md#category-chips) |
| Focused item kept in the middle of the screen (D-094) | ✅ | ➖ | ➖ | TV only: phones and computers scroll by touch, wheel or keyboard | [Focus in the middle (TV)](FEATURES.md#focus-in-the-middle-tv) |
| Live TV guide page | ✅ | ✅ | ✅ | | [TV guide](FEATURES.md#tv-guide) |
| Guide over the playing channel (D-058, D-081) | ✅ | ✅ | ✅ | TV: ↑ · phone and web: Guide button · web: also G (↑/↓ are the volume) | [Guide over the playing channel](FEATURES.md#guide-over-the-playing-channel) |
| Open in another player (D-057, D-081) | ✅ any player app | ✅ any player app | ✅ desktop: VLC · ➖ browser | button next to Play in movie details, episode "…" menu; browsers cannot start other programs | [Open in another player](FEATURES.md#open-in-another-player) |
| Downloads (offline) | ✅ | ✅ | ✅ | web: encrypted in the browser | [Offline downloads](FEATURES.md#offline-downloads) |
| My List, search, category pages | ✅ | ✅ | ✅ | | [Watchlist](FEATURES.md#watchlist) · [Search](FEATURES.md#titles-channels-and-programmes) · [Movies and Series](FEATURES.md#movies-and-series) |
| Automatic subtitles from OpenSubtitles (D-111) | ✅ | ✅ | ✅ | avatar → App → Automatic subtitles; user's own API key | [Automatic subtitles](FEATURES.md#automatic-subtitles) |
| Categories shown: hide categories from browsing, search still finds them (D-110) | ✅ | ✅ | ✅ | avatar → Profiles | [Categories shown](FEATURES.md#categories-shown) |
| Profiles, Kids, parental PIN, languages | ✅ | ✅ | ✅ | | [Profiles and Kids](FEATURES.md#profiles-and-kids) |
| Backup and restore | ✅ | ✅ | ✅ | | [Backup and restore](FEATURES.md#backup-and-restore) |
| Sign in / sync with the phone by QR code | ✅ shows code | ✅ scans | ✅ desktop shows code · ➖ browser | | [Sign in and sync by QR code](FEATURES.md#sign-in-and-sync-by-qr-code) |
| Play on TV from the phone (D-044) | ✅ receives | ✅ sends | ➖ | | [Play on TV](FEATURES.md#play-on-tv) |
| App language: English, Português (Brasil), Deutsch, Srpskohrvatski (BiH), per profile (D-084) | ✅ | ✅ | ✅ | account menu → App → App language; sign-in page | [App language](FEATURES.md#app-language) |
| About (version, build, connection) | ✅ | ✅ | ✅ | account menu → App | [About](FEATURES.md#about) |
| Diagnostics log | ✅ share | ✅ share | ✅ save or copy | account menu → App → Log | [Diagnostics log](FEATURES.md#diagnostics-log) |
| App updates | ✅ | ✅ | ✅ desktop · ➖ browser (always current) | | [App updates](FEATURES.md#app-updates) |
| Sleep mode (own screen saver, D-068) | ✅ | ➖ | ➖ | | [Sleep mode (TV)](FEATURES.md#sleep-mode-tv) |
| Audio decoder choice (FFmpeg, D-059) | ✅ | ✅ | ➖ | browsers decode themselves | [Audio decoder (TV and phone)](FEATURES.md#audio-decoder-tv-and-phone) |
| MKV / AC3 files | ✅ | ✅ | ➖ | browsers cannot play them; the app says so | [Playback errors](FEATURES.md#playback-errors) |
| Timeline preview frames | ➖ (scrub bar) | ➖ | ✅ | hover over the timeline | [Playback controls](FEATURES.md#playback-controls) |
