# Features

What the apps do, one section per feature: the Android TV app (remote), the same app on phones (touch) and the desktop app for Windows, macOS and Linux (mouse and keyboard; the web player in Electron, D-071, D-106). Which app has each feature, and how it is reached there, is in [PARITY.md](PARITY.md); what changed lately is in [RELEASE-NOTES.md](RELEASE-NOTES.md). The decisions (D-…) and known issues (KI-…) hold the details.

A change that adds or changes a feature updates its section here, its row in PARITY.md and the release notes in the same pull request (D-080, D-143).

- [Sign-in and accounts](#sign-in-and-accounts)
- [Library](#library)
- [Browsing](#browsing)
- [Covers and cards](#covers-and-cards)
- [Details](#details)
- [Player](#player)
- [Live TV](#live-tv)
- [Search](#search)
- [My List](#my-list)
- [Downloads](#downloads)
- [Profiles](#profiles)
- [Devices](#devices)
- [App](#app)

## Sign-in and accounts

### Sign-in

Sign in with the IPTV provider's address, username and password (Xtream Codes). There is no server: each app talks to the provider directly and keeps everything on the device (D-038, D-088). The password is encrypted by the system (Android Keystore; the operating system in the desktop app). The sign-in page also offers the app language, a QR code for [signing in with the phone](#sign-in-and-sync-by-qr-code) (TV, desktop) and [restoring a backup](#backup-and-restore). Signing out deletes the downloads on the device.

### Backup and restore

A file, encrypted with a password of your choice, with the sign-in, profiles, parental PIN, watch progress, My List and playback settings. Made in the account menu → Library & devices; restored there or from the sign-in page, after a reinstall or on another device (D-056).

## Library

### Title grouping

The provider lists each language, quality and copy of a title separately. The apps group them into one title with several versions: by the cleaned name and year, or by the TMDB id and year (D-065, D-133). Language prefixes such as "EN - ", "|DE| ", "PL = " or "GR - " are read as the version's language, also ones not registered yet (D-089, D-107, D-112, D-134). A series has one episode list across all its versions (D-066). The grouping runs in a database on the device (SQLite on TV, phone and desktop, D-121).

### Version choice and "(best)"

A title with several versions marks the highest quality "(best)"; versions of equal quality are ordered by the profile's or the app's language (D-136). A title starts with its best version in the profile's languages (Account menu → Language), even when another language has a better quality (D-144, issue #163); the version last picked sets the quality in that language and, for titles with no version in the profile's languages, the language too (D-087). A version picked for a title stays its choice.

An "EAR" version (English audio with Arabic subtitles in the picture, D-107) is labelled "ENG (EAR)" and the plain English one "ENG". When English is one of the profile's languages, a title with both starts with the plain English one, whatever their quality; of equally good versions, the plain one is "(best)" (D-148).

### Library updates

The library is built on the first sign-in and kept on the device; the app starts from it at once (D-117, D-120). The account menu → Library & devices → Update library downloads the provider's lists again and changes only what changed; a list identical to the last one is not compared at all (D-109, D-119, D-135, D-137, D-138). A message then says how many titles were added, changed and removed. Live channels and the TV guide are downloaded daily and after an update (D-123, D-130).

### Library banner

While the library is being organized, or when the device is offline, a banner floats at the bottom over Home, Movies and Series, with the progress per kind (movies, series, channels) (D-117, D-142).

## Browsing

### Home

A featured title at the top, then rows: Continue Watching, My List, the [channels watched last](#channels-watched-last) and the provider's categories. A row shows 10 titles and a "See all" card that opens the category's page (D-043). On TV the rows are built as the focus moves down, and the focused row is kept in the middle (D-069, D-094, D-122).

### Continue Watching

Home's first row: movies and episodes started but not finished, with how far you got. A card plays from where you stopped, over the title's details page, so Back from the player shows the movie's or the series' details rather than Home (issue #166).

### Continue watching on the TV home screen

Android TV and Google TV (Chromecast with Google TV) show the active profile's Continue Watching in the system home screen's "Continue watching" row (Watch Next), up to 10 titles, newest first, with the provider's cover (else the app icon) and how far you got. Choosing one opens the app and plays from where you stopped, over the title's details page, like the card on Home. The row follows a few seconds after playback stops; a finished title or one removed from Continue Watching leaves it. The row is not per profile: switching profiles replaces the titles, the profile picker and signing out empty it. A title of another profile, or one no longer in Continue Watching, opens Home. A title removed in the home screen's own menu stays away until it is watched again. Live channels are not added. Google's "For you" and "Top picks" rows and the hero carousel are filled by Google from its catalog partners; apps cannot add to them (issue #165, D-147).

### Movies and Series

A grid of titles, loaded as you scroll (D-040), sorted by date added (newest first, the default), name or release date, each either way (D-049).

### Category chips

Above the grid, the categories sit on one line with "Show all" / "Show less"; expanded, they fill a full-width box that scrolls on its own (D-047, D-085, D-091, D-105). On TV the bar shows "All", the categories that fit, ‹ › and "Show all".

### Focus in the middle (TV)

On TV the focused title is kept in the middle of the screen on every page, so you always see where you are (D-094 to D-099). Phones and computers scroll by touch, wheel or keyboard instead.

## Covers and cards

### Card menu

A title card's menu: Go to details, Mark as watched / not watched (movies and series), Add to / Remove from My List; on Continue Watching also Remove (D-078, D-081, D-082, D-104). TV: hold OK; phone: long touch; desktop: right-click, the menu key or Shift+F10.

### Watched tag

An eye at the bottom right of the cover, and in details, for watched movies and episodes and fully watched series (D-081, D-082, D-104).

### Quality tag

At the top left of the cover: "4K" when a version is 4K, or "CAM", "TS", "TC" or "SCR" when every version is a cinema copy, so you know before opening it (D-141).

Titles on My List (its Home row and its page) carry the same tag: it is read from the library when the list loads.

## Details

### Movie and series details

Poster, description, versions, Play, My List and a Watched toggle for the movie or the whole series (D-104). A series' Play button continues where you are: the episode in progress, or the next one not watched yet ("Play S1:E5") (D-131). Movies have Download and [Open in another player](#open-in-another-player) next to Play.

### Seasons and episodes

A season choice with a "Watched" button on its left that marks the whole season watched or not (D-132, issue #159). Each episode row shows Play, "…" and its version; an episode the provider lists twice in one version (same title, or the same "S01E03" in it) is one row, the copy a choice in its version picker labelled "ENG #2" (D-146); its length and description stop after two lines with "…", and a touch or click on them shows the whole description, another folds it again (phone and desktop); on TV, once the focus has stayed on one of the episode's buttons for 1.5 s, the description rolls up a line at a time inside its two lines, rests at the end, then starts over; the description keeps its full length while it rolls, so nothing is cut off (issue #160); "…" (TV: hold OK on Play; phone: long touch; desktop: right-click) offers Mark as watched / not watched, Download, Play on TV and Open in another player (D-082, D-083). On TV, ↑/↓ move to the same button of the episode above or below (Play to Play, "…" to "…", version to version; to "…" when that episode has no version choice), and ←/→ move between the buttons of one episode (D-149).

## Player

### Playback controls

Play / pause, ±10 s, from the beginning, previous / next episode (D-077), and "Skip ahead" by 30 s to 3 min instead of Skip Intro (D-042, D-100). At the end of an episode, the next one is offered (next-up). Presses in a row skip further each time: 10 s, 30 s, 1 min, 2 min, then 5 min; the other way or a pause of a second starts again at 10 s (D-128, D-150). TV: ←/→ and holding to scrub; with ←/→ the presses after the first move a preview on the progress bar and the video jumps once they stop (D-128); the on-screen ±10 s buttons skip at once; ↑/↓ open the buttons (D-101). Phone: full-screen landscape, double tap to skip and more quick taps to skip further, drag the timeline, the screen stays on (D-046, D-097). Desktop: keyboard (←/→, space, ↑/↓ volume; a held arrow repeats 10 s steps) and mouse; hovering over the timeline shows preview frames (D-023).

### Audio, subtitles, versions and episodes

Buttons on the player bar open the audio tracks, subtitles, the title's versions and the series' episodes (D-102). Tracks without a name show their language's name, or "Default" for a lone unnamed track (D-089, D-090). The audio, subtitles and version last picked are every title's default, per profile (D-087).

### Automatic subtitles

With your own OpenSubtitles.com API key, a movie or episode without subtitles in one of the profile's languages gets one downloaded and turned on. Set up under the account menu → App → Automatic subtitles (D-111).

### Pause when the headphones go away

Unplugging headphones or losing a Bluetooth headset pauses playback instead of carrying on through the speaker; on desktop, when the output device is removed (D-092).

### Playback errors

When a stream does not play, the error and the Log say why: the provider's answer (max connections, not found, expired, …), or a video the device cannot decode (D-074). The apps try the provider's stream server when the portal fails (D-038). The desktop app plays what Chromium plays; MKV with Dolby / DTS audio or HEVC without a decoder go to the TV app or VLC, and the error offers Open in VLC (KI-045).

### Audio decoder (TV and phone)

FFmpeg decoders for Dolby Digital / Plus and DTS are built in; the account menu → App → Audio decoder chooses them or the device's decoders first (D-059).

### Open in another player

Hands a movie or episode to another player app with the provider's User-Agent: VLC, MX Player, Just Player and others on TV and phone, VLC in the desktop app (D-057, D-081). From movie details and the episode "…" menu. Not for Kids profiles.

## Live TV

### TV guide

The Live TV page: categories on the left, a guide grid of channels and programmes (now and the next hours) on the right, with Earlier / Now / Later. The categories and the guide each scroll on their own; the time header and channel column stay put (D-031, D-032, D-103, D-139, D-140). Selecting a channel plays it.

### Guide over the playing channel

A see-through list of the category's channels with now / next over the playing video, to switch without leaving it. TV: ↑; phone: swipe up or the Guide button; desktop: the Guide button or G (D-058, D-081).

### Channels watched last

Each profile keeps its last 20 channels. Home's live row lists them; on TV, ↓ in a live channel shows the last 10 in a strip to switch to (D-129).

## Search

### Titles, channels and programmes

Finds movies, series, live channels and programmes of the TV guide on now or in the next day; a programme plays the channel that shows it (D-130). Hidden categories are still searched (D-110). Results load in pages as you move down; TV filters them by All, Movies, Series or Live TV (D-095, D-108).

## My List

### Watchlist

A watchlist per profile: add from details or the card menu; it has a Home row and its own page (D-055).

A title on My List carries a bookmark at the top right of its cover. The details button is the same bookmark: outlined when the title is not on My List, filled when it is (issue #157).

## Downloads

### Offline downloads

Download movies and episodes to watch without a connection; My Downloads lists them. Downloads are encrypted, play only in the app, are deleted on sign-out and need the app online every 30 days (D-024, D-029, D-050).

## Profiles

### Profiles and Kids

Several profiles per account, each with its own progress, My List, settings and languages. A Kids profile only shows children's categories (from their names, or the ones a parent picks) and has a smaller account menu (D-053, D-064).

Every time the app opens it asks "Who's watching?"; an account with a single profile opens it directly (D-151).

### Parental PIN

An optional PIN locks leaving a Kids profile and managing profiles (D-054).

### Content language filter

Per profile: only titles with audio or subtitles in the chosen languages, read from the titles' and categories' names (D-063, D-067, D-086). The order the languages are ticked in is their priority, shown as a number next to each ("1. English", "2. German"); unticking one moves the later ones up. A title starts with its version in the first of them it has, and the order decides which of equally good versions is "(best)" (D-145, D-144, D-136).

### Categories shown

Per profile, hide categories from browsing (bars, lists, Home, Live TV, guide); search still finds them. "Select all" unchecks or checks a whole section (D-110, D-127).

### App language

English, Português (Brasil), Deutsch and Srpskohrvatski (BiH), per profile: account menu → App → App language, or on the sign-in page. A first start follows the device's language (D-084).

## Devices

### Sign in and sync by QR code

The TV and desktop app show a QR code (sign-in page, or account menu → Library & devices → Sync with phone); the phone app scans it (account menu → Library & devices → Connect a TV or computer). The sign-in is passed on, and profiles, My List and progress are merged on both devices (D-060, D-072).

### Play on TV

After pairing, the phone app starts a title on the TV (D-044, D-061).

## App

### Account menu

The avatar at the top right opens it: other profiles, then the groups Profiles, Library & devices and App, each opening in place with a back arrow, and Sign out (D-079). On desktop it stays open while the mouse moves off it; a click elsewhere, the avatar again or Escape closes it (issue #155).

### About

The installed version (MAJOR.MINOR.PATCH, D-070), the commit and date it was built from, and how the app connects. Account menu → App → About.

### Diagnostics log

What the app did, with the provider's answers (passwords masked), timings and native crashes, to share (TV, phone) or save and copy (desktop). Account menu → App → Log (D-039, D-074, D-113).

### App updates

The apps look for new versions in this repository's releases (D-062, D-073): TV and phone download the APK, check it and open the Android installer; the desktop app installs updates itself on Windows and with the AppImage, and points to the download on macOS and with the .deb. Account menu → App → Check for updates. Each release says what is new (D-143).

### Close the app (TV and phone)

Account menu → Close the app ends the app completely, like "Force stop" in the system settings.
