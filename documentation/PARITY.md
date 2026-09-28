# App parity

All apps share one look (the web design, D-041) and the same features where the device allows. What differs is how you reach them: a TV remote, a phone's touch screen, or a mouse and keyboard (the desktop app, which shows the web player; D-088). This table is the checklist; update it with every feature (D-079).

Legend: ✅ has it · ➖ does not apply to this device · ⏳ missing (the row names its backlog item, `Parity: …`, in [NEXT-STEPS](NEXT-STEPS.md))

## Keeping it current (D-080)

- A change that adds or changes something people see or use updates this table in the same pull request. The pull request template asks which apps the change covers.
- An app that should have a feature but does not yet is marked ⏳, and the row names an open backlog item `Parity: <title>` (in the last column). When the item is done, the cell becomes ✅ and the item moves to Done.
- CI checks it (`npm run lint:parity`, in *Lint and format*): every app cell of the Features table has ✅, ➖ or ⏳; every ⏳ names an open `Parity: …` item; every open `Parity: …` item is named here.

## Looks

| Element | TV (remote) | Phone (touch) | Web / desktop (mouse, keyboard) |
|---------|-------------|---------------|---------------------------------|
| Focused / hovered card | grows 8 %, light ring, soft white glow | pressed state | same as TV on hover and keyboard focus |
| Rows | room above and below so the ring and glow are not cut | same | same |
| Top nav, account menu | Profiles · Library & devices · App | same | same groups |
| Dialogs | panel in the middle | same | same (Escape or a click outside closes) |

## Features

| Feature | TV | Phone | Web / desktop | How it is reached |
|---------|----|-------|---------------|-------------------|
| Card menu: Go to details, Mark as (not) watched (movies, series); Continue Watching: remove (D-078, D-081, D-082) | ✅ | ✅ | ✅ | TV: hold OK · phone: long touch · web: right-click, menu key or Shift+F10 (a long touch where the browser reports it) |
| "Watched" tag on covers (bottom right) and in details (D-081, D-082) | ✅ | ✅ | ✅ | movies, episodes, fully watched series |
| Episode options in series details: Mark as (not) watched, Download, Play on TV, Open in another player (D-082, D-083) | ✅ | ✅ | ✅ | row: Play, "…", version · "…" or TV: hold OK on Play · phone: long touch · web: right-click the episode |
| Player: from the beginning, previous / next episode | ✅ | ✅ | ✅ | TV: ↓ to the buttons · phone and web: tap or click |
| Player: ±10 s, Skip ahead, next-up | ✅ | ✅ | ✅ | TV: ←/→ and hold to scrub · phone: double tap · web: ←/→ keys, click |
| Player: audio, subtitles, versions, episodes | ✅ | ✅ | ✅ | TV: ↑ drawer · web: buttons |
| Last picked subtitles, audio and version are every title's default (D-087) | ✅ | ✅ | ✅ | matched by language (versions: same quality first), per profile |
| Why a stream failed (provider's answer, D-074) | ✅ | ✅ | ✅ | in the error and the log |
| Category chips on one line with Show all / Show less (D-085) | ✅ | ✅ | ✅ | TV: ↓ to the button · phone: tap · web: click (the wheel scrolls the line) |
| Live TV guide page | ✅ | ✅ | ✅ | |
| Guide over the playing channel (D-058, D-081) | ✅ | ✅ | ✅ | TV: ↑ · phone and web: Guide button · web: also G (↑/↓ are the volume) |
| Open in another player (D-057, D-081) | ✅ any player app | ✅ any player app | ✅ desktop: VLC · ➖ browser | button next to Play in movie details, episode "…" menu; browsers cannot start other programs |
| Downloads (offline) | ✅ | ✅ | ✅ | web: encrypted in the browser |
| My List, search, category pages | ✅ | ✅ | ✅ | |
| Profiles, Kids, parental PIN, languages | ✅ | ✅ | ✅ | |
| Backup and restore | ✅ | ✅ | ✅ | |
| Sign in / sync with the phone by QR code | ✅ shows code | ✅ scans | ✅ desktop shows code · ➖ browser | |
| Play on TV from the phone (D-044) | ✅ receives | ✅ sends | ➖ | |
| App language: English, Português (Brasil), Deutsch, Srpskohrvatski (BiH), per profile (D-084) | ✅ | ✅ | ✅ | account menu → App → App language; sign-in page |
| About (version, build, connection) | ✅ | ✅ | ✅ | account menu → App |
| Diagnostics log | ✅ share | ✅ share | ✅ save or copy | account menu → App → Log |
| App updates | ✅ | ✅ | ✅ desktop · ➖ browser (always current) | |
| Sleep mode (own screen saver, D-068) | ✅ | ➖ | ➖ | |
| Audio decoder choice (FFmpeg, D-059) | ✅ | ✅ | ➖ | browsers decode themselves |
| MKV / AC3 files | ✅ | ✅ | ➖ | browsers cannot play them; the app says so |
| Timeline preview frames | ➖ (scrub bar) | ➖ | ✅ | hover over the timeline |
