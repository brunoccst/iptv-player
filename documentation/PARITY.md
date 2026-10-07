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
| Continue Watching plays over the title's details page: Back from the player shows them, not Home (issue #166) | ✅ | ✅ | ✅ | Home's Continue Watching row; Back or the player's ← | [Continue Watching](FEATURES.md#continue-watching) |
| Continue watching on the TV home screen: the active profile's Continue Watching in the system row, a choice plays from where it stopped (issue #165, D-147) | ✅ Android TV, Google TV | ➖ | ➖ | the system home screen's "Continue watching" row; phones and computers have no such row | [Continue watching on the TV home screen](FEATURES.md#continue-watching-on-the-tv-home-screen) |
| Card menu: Go to details, Mark as (not) watched (movies, series), Add to / Remove from My List; Continue Watching: remove (D-078, D-081, D-082, D-104) | ✅ | ✅ | ✅ | TV: hold OK · phone: long touch · web: right-click, menu key or Shift+F10 (a long touch where the browser reports it) | [Card menu](FEATURES.md#card-menu) |
| "Watched" tag on covers (bottom right) and in details (D-081, D-082) | ✅ | ✅ | ✅ | movies, episodes, fully watched series; an eye since D-104 | [Watched tag](FEATURES.md#watched-tag) |
| My List bookmark on covers (top right) and on the details button, filled when saved (issue #157) | ✅ | ✅ | ✅ | title cards on Home, Movies, Series, Search and My List | [Watchlist](FEATURES.md#watchlist) |
| Quality tag on covers (top left): "4K", or "CAM" / "TS" / "TC" / "SCR" when every version is a cinema copy (D-141) | ✅ | ✅ | ✅ | also on My List, its Home row and its page | [Quality tag](FEATURES.md#quality-tag) |
| Home row arrows (‹ ›) hidden at the row's beginning and end (D-159) | ➖ | ➖ | ✅ | Home rows, mouse over the row; TV and phone scroll rows with the remote or a swipe, without arrows | [Home](FEATURES.md#home) |
| Home: "Top rated of the 100 newest movies" and "… series" rows: the 25 best rated (provider's ratings) of the 100 titles added last, 100 % scores left out, no "See all" (D-153, D-160, D-161, issues #181, #188) | ✅ | ✅ | ✅ | Home, after Live TV · Movies/Series: Sort by "Highest rated" | [Home](FEATURES.md#home) |
| Library banner (offline, organizing with per-kind progress) floats at the bottom over the content (D-142) | ✅ | ✅ | ✅ | Home, Movies, Series | [Library banner](FEATURES.md#library-banner) |
| Details in two columns on landscape screens: title and buttons fixed on the left, episodes or facts on the right (issue #186, D-158) | ✅ | ✅ | ⏳ | TV; phones on their side · Parity: Landscape details layout on desktop | [Movie and series details](FEATURES.md#movie-and-series-details) |
| Details: Watched toggle for the movie or the whole series (D-104) | ✅ | ✅ | ✅ | eye button next to My List | [Movie and series details](FEATURES.md#movie-and-series-details) |
| Mark a season watched or not watched (D-132) | ✅ | ✅ | ✅ | eye button just left of the season choice (issue #159) | [Seasons and episodes](FEATURES.md#seasons-and-episodes) |
| Whole episode description on demand (issue #160) | ✅ | ✅ | ✅ | two lines, then "…"; touch or click the description to show or fold it · TV: rolls through the whole rest after 1.5 s on the episode's buttons (not a D-pad stop; D-083) | [Seasons and episodes](FEATURES.md#seasons-and-episodes) |
| TV: ↑/↓ in the episode list go to the same button of the episode above or below (D-149) | ✅ | ➖ | ➖ | TV only: phones and computers have no D-pad · ←/→ stay in the episode's row (D-069) | [Seasons and episodes](FEATURES.md#seasons-and-episodes) |
| An episode listed twice in one version is one row; the copy is a choice in its version picker (D-146) | ✅ | ✅ | ✅ | same title, or the same SxxEyy in it; different episodes with one number stay separate (D-066) | [Seasons and episodes](FEATURES.md#seasons-and-episodes) |
| Episode options in series details: Mark as (not) watched, Download, Play on TV, Open in another player (D-082, D-083) | ✅ | ✅ | ✅ | row: Play, "…", version · "…" or TV: hold OK on Play · phone: long touch · web: right-click the episode | [Seasons and episodes](FEATURES.md#seasons-and-episodes) |
| Player: from the beginning, previous / next episode | ✅ | ✅ | ✅ | TV: ↓ to the buttons · phone and web: tap or click | [Playback controls](FEATURES.md#playback-controls) |
| Player: brightness and volume by sliding on the video (issue #184, D-155) | ➖ | ✅ | ➖ | phone: slide up/down on the left third (brightness) or the right third (volume); TV: the remote's volume keys; web/desktop: ↑/↓ volume, the screen's own brightness | [Playback controls](FEATURES.md#playback-controls) |
| Player: ±10 s, Skip ahead, next-up | ✅ | ✅ | ✅ | Presses in a row: 10 s, 30 s, 1 min, 2 min, 5 min (D-150) · TV: ←/→ and hold to scrub · phone: double tap, more taps · web: ←/→ keys, click | [Playback controls](FEATURES.md#playback-controls) |
| Player: media keys: play/pause, ⏪/⏩, stop closes (issue #178) | ✅ | ✅ | ✅ | TV: the remote's media keys, also with the buttons, a drawer or the guide open · phone: a headset's or keyboard's media keys · web: the keyboard's media keys (media session) | [Playback controls](FEATURES.md#playback-controls) |
| Titles of one name and year with different TMDB ids stay apart (issue #187, D-156) | ✅ | ✅ | ✅ | Movies, Series, Home, Search: e.g. two "The Odyssey (2026)" | [Title grouping](FEATURES.md#title-grouping) |
| Player: audio, subtitles, versions, episodes | ✅ | ✅ | ✅ | TV/phone: Audio, Subtitles, Episodes buttons on the player bar (↑/↓ open the bar on TV, D-101, D-102) · web: buttons | [Audio, subtitles, versions and episodes](FEATURES.md#audio-subtitles-versions-and-episodes) |
| Player pauses when the headphones go away (D-092) | ✅ | ✅ | ✅ | TV: Bluetooth headphones · phone: wired or Bluetooth · desktop: an output device removed | [Pause when the headphones go away](FEATURES.md#pause-when-the-headphones-go-away) |
| Last picked subtitles, audio and version are every title's default (D-087) | ✅ | ✅ | ✅ | matched by language (versions: same quality first), per profile; a version in the profile's languages comes first, its best quality (D-144); with none, the best version: highest quality, then the profile's or app's language (D-136) | [Version choice and "(best)"](FEATURES.md#version-choice-and-best) |
| EAR versions are labelled "ENG (EAR)"; the plain English version comes first (D-148) | ✅ | ✅ | ✅ | version selector in details and the player; in the profile's languages | [Version choice and "(best)"](FEATURES.md#version-choice-and-best) |
| Why a stream failed (provider's answer, D-074) | ✅ | ✅ | ✅ | in the error and the log | [Playback errors](FEATURES.md#playback-errors) |
| Category chips on one line with Show all / Show less; expanded, a full-width box that scrolls on its own (D-085, D-091) | ✅ | ✅ | ✅ | TV: ↓ to the button · phone: tap · web: click (the wheel scrolls the line) | [Category chips](FEATURES.md#category-chips) |
| TV: ←/→ stay in the row you are in and stop at its ends; ↑/↓ change rows (D-069, D-152) | ✅ | ➖ | ➖ | TV only: phones and computers have no D-pad · Live TV: ← from the guide goes to the category list | [Focus in the middle (TV)](FEATURES.md#focus-in-the-middle-tv) |
| Focused item kept in the middle of the screen (D-094) | ✅ | ➖ | ➖ | TV only: phones and computers scroll by touch, wheel or keyboard | [Focus in the middle (TV)](FEATURES.md#focus-in-the-middle-tv) |
| Live TV guide page | ✅ | ✅ | ✅ | | [TV guide](FEATURES.md#tv-guide) |
| TV: the remote's colour keys: Red My List, Green audio and subtitles / Continue Watching, Yellow Search, Blue guide / Live TV (D-154, issue #180) | ✅ | ➖ | ➖ | TV only: phones and computers have no colour keys · a dot in the key's colour marks the button it also presses | [Colour keys (TV)](FEATURES.md#colour-keys-tv) |
| TV: Live TV categories: ↑/↓ one category at a time, focused one in the middle; Channel +/− a page (issue #179) | ✅ | ➖ | ➖ | TV only: phones show the categories as chips, computers have no remote | [TV guide](FEATURES.md#tv-guide) |
| Guide over the playing channel (D-058, D-081) | ✅ | ✅ | ✅ | TV: ↑ · phone and web: Guide button · web: also G (↑/↓ are the volume) | [Guide over the playing channel](FEATURES.md#guide-over-the-playing-channel) |
| Open in another player (D-057, D-081) | ✅ any player app | ✅ any player app | ✅ desktop: VLC · ➖ browser | button next to Play in movie details, episode "…" menu; browsers cannot start other programs | [Open in another player](FEATURES.md#open-in-another-player) |
| Downloads (offline) | ✅ | ✅ | ✅ | web: encrypted in the browser | [Offline downloads](FEATURES.md#offline-downloads) |
| My List, search, category pages | ✅ | ✅ | ✅ | | [Watchlist](FEATURES.md#watchlist) · [Search](FEATURES.md#titles-channels-and-programmes) · [Movies and Series](FEATURES.md#movies-and-series) |
| Automatic subtitles from OpenSubtitles (D-111) | ✅ | ✅ | ✅ | avatar → App → Automatic subtitles; user's own API key | [Automatic subtitles](FEATURES.md#automatic-subtitles) |
| Categories shown: hide categories from browsing, search still finds them (D-110) | ✅ | ✅ | ✅ | avatar → Profiles | [Categories shown](FEATURES.md#categories-shown) |
| Profiles, Kids, parental PIN, languages | ✅ | ✅ | ✅ | languages numbered in the order ticked, which is their priority (D-145) | [Profiles and Kids](FEATURES.md#profiles-and-kids) |
| "Who's watching?" every time the app opens (D-151) | ✅ | ✅ | ✅ | an account with one profile opens it directly; web: every page load | [Profiles and Kids](FEATURES.md#profiles-and-kids) |
| Backup and restore | ✅ | ✅ | ✅ | | [Backup and restore](FEATURES.md#backup-and-restore) |
| Sign in / sync with the phone by QR code: sign-in, profiles, My List, progress and the profiles' settings (D-162) | ✅ shows code | ✅ scans | ✅ desktop shows code · ➖ browser | | [Sign in and sync by QR code](FEATURES.md#sign-in-and-sync-by-qr-code) |
| Play on TV from the phone (D-044) | ✅ receives | ✅ sends | ➖ | | [Play on TV](FEATURES.md#play-on-tv) |
| App language: English, Português (Brasil), Deutsch, Srpskohrvatski (BiH), per profile (D-084) | ✅ | ✅ | ✅ | account menu → App → App language; sign-in page | [App language](FEATURES.md#app-language) |
| About (version, build, connection) | ✅ | ✅ | ✅ | account menu → App | [About](FEATURES.md#about) |
| Diagnostics log | ✅ share | ✅ share | ✅ save or copy | account menu → App → Log | [Diagnostics log](FEATURES.md#diagnostics-log) |
| App updates | ✅ | ✅ | ✅ desktop · ➖ browser (always current) | | [App updates](FEATURES.md#app-updates) |
| Audio decoder choice (FFmpeg, D-059) | ✅ | ✅ | ➖ | browsers decode themselves | [Audio decoder (TV and phone)](FEATURES.md#audio-decoder-tv-and-phone) |
| MKV / AC3 files | ✅ | ✅ | ➖ | browsers cannot play them; the app says so | [Playback errors](FEATURES.md#playback-errors) |
| Timeline preview frames | ➖ (scrub bar) | ➖ | ✅ | hover over the timeline | [Playback controls](FEATURES.md#playback-controls) |
