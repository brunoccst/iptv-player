# Features

What the apps do, one section per feature: the Android TV app (remote), the same app on phones (touch) and the desktop app for Windows, macOS and Linux (mouse and keyboard; the web player in Electron, D-071). What changed lately is in [RELEASE-NOTES.md](RELEASE-NOTES.md); where each feature lives in the code is in [FEATURES-TECHNICAL.md](FEATURES-TECHNICAL.md). The decisions (D-…) and the [known issues](https://github.com/brunoccst/iptv-player/issues?q=is%3Aissue+label%3A%22known+issue%22) hold the details.

Every app gets every feature unless it does not apply to the device (D-079). Each section ends with an **Apps:** line: ✅ has it · ➖ does not apply to this device · ⏳ missing, with the GitHub issue that adds it. All apps share one look: the focused or hovered card grows 8 % with a light ring and a soft glow, rows leave room so it is not cut, and dialogs sit in the middle (Escape or a click outside closes them on desktop).

A change that adds or changes a feature updates its section here, its row in FEATURES-TECHNICAL.md and the release notes in the same pull request (D-143). `npm run lint:features` checks the **Apps:** lines and the code index.

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

Sign in with the IPTV provider's address, username and password (Xtream Codes). There is no server: each app talks to the provider directly and keeps everything on the device (D-088). The password is encrypted by the system (Android Keystore; the operating system in the desktop app). The sign-in page also offers the app language, a QR code for [signing in from another device](#sign-in-and-sync-by-qr-code) and [restoring a backup](#backup-and-restore). Signing out deletes the downloads on the device.

**Apps:** TV ✅ · Phone ✅ · Desktop ✅

### Backup and restore

A file, encrypted with a password of your choice, with the sign-in, profiles, parental PIN, watch progress, My List and playback settings. Made in the account menu → Library & devices; restored there or from the sign-in page, after a reinstall or on another device (D-056).

**Apps:** TV ✅ · Phone ✅ · Desktop ✅

## Library

### Title grouping

The provider lists each language, quality and copy of a title separately. The apps group them into one title with several versions: by the cleaned name and year, or by the TMDB id and year (D-133). Two films of one name and year with different TMDB ids ("The Odyssey" 2026 by Christopher Nolan and by Marcel Walz) stay two titles; a copy without a TMDB id then stays apart from both, since the provider's lists do not say who directed it (issue #187, D-133). Language prefixes such as "EN - ", "|DE| ", "PL = " or "GR - " are read as the version's language, also ones not registered yet (D-090, D-017, D-047). A series has one episode list across all its versions (D-066). The grouping runs in a database on the device (SQLite on TV, phone and desktop, D-121). When the provider renames a title so that it gets a new id, its place on My List and its progress follow it (issue #216).

**Apps:** TV ✅ · Phone ✅ · Desktop ✅

### Version choice and "(best)"

A title with several versions marks the highest quality "(best)"; versions of equal quality are ordered by the profile's or the app's language (D-087). A title starts with its best version in the profile's languages (Account menu → Language), even when another language has a better quality (D-087, issue #163); the version last picked sets the quality in that language and, for titles with no version in the profile's languages, the language too (D-087). A version picked for a title stays its choice.

An "EAR" version (English audio with Arabic subtitles in the picture, D-017) is labelled "ENG (EAR)" and the plain English one "ENG". When English is one of the profile's languages, a title with both starts with the plain English one, whatever their quality; of equally good versions, the plain one is "(best)" (D-087).

**Apps:** TV ✅ · Phone ✅ · Desktop ✅

### Library updates

The library is built on the first sign-in and kept on the device; the app starts from it at once (D-121). The account menu → Library & devices → Refresh library downloads the provider's lists again and changes only what changed; a list identical to the last one is not compared at all (D-135, D-119). A message then says how many titles were added, changed and removed. Live channels and the TV guide are downloaded daily and after an update (D-121, D-130).

**Apps:** TV ✅ · Phone ✅ · Desktop ✅

### Library banner

While the library is being organized, or when the device is offline, a banner floats at the bottom over Home, Movies and Series, with the progress of movies and of series (D-121, D-119).

**Apps:** TV ✅ · Phone ✅ · Desktop ✅

## Browsing

### Home

A featured title at the top, then rows: Continue Watching, My List, the [channels watched last](#channels-watched-last), "Top rated of the 100 newest movies" and "Top rated of the 100 newest series" (the 25 best rated, by the provider's ratings, among the 100 titles added last, leaving out a perfect 100 % score, usually a niche title with one review; the app's own rows, so no "See all"; D-040, issue #188) and the provider's categories. On TV and phone a row shows 10 titles and a "See all" card that opens the category's page (D-040); on desktop a row loads 30 titles at a time, more as you scroll it, and its title opens the category's page. On TV the rows are built as the focus moves down, and the focused row is kept in the middle (D-069, D-094, D-040). On desktop, hovering over a row shows ‹ and › arrows that scroll it; the ‹ arrow is hidden while the row is at its beginning and the › arrow at its end, so a row that fits has neither (D-040).

**Apps:** TV ✅ · Phone ✅ · Desktop ✅. Row arrows (‹ ›) are desktop only; TV and phone scroll rows with the remote or a swipe.

### Continue Watching

Home's first row: movies and episodes started but not finished, with how far you got. A card plays from where you stopped, over the title's details page, so Back from the player shows the movie's or the series' details rather than Home (issue #166).

**Apps:** TV ✅ · Phone ✅ · Desktop ✅

### Continue watching on the TV home screen

Android TV and Google TV (Chromecast with Google TV) show the active profile's Continue Watching in the system home screen's "Continue watching" row (Watch Next), up to 10 titles, newest first, with the provider's cover (else the app icon) and how far you got. Choosing one opens the app and plays from where you stopped, over the title's details page, like the card on Home. The row follows a few seconds after playback stops; a finished title or one removed from Continue Watching leaves it. The row is not per profile: switching profiles replaces the titles, the profile picker and signing out empty it. A title of another profile, or one no longer in Continue Watching, opens Home. A title removed in the home screen's own menu stays away until it is watched again. Live channels are not added. Google's "For you" and "Top picks" rows and the hero carousel are filled by Google from its catalog partners; apps cannot add to them (issue #165, D-147).

**Apps:** TV ✅ · Phone ➖ · Desktop ➖ (Android TV and Google TV; phones and computers have no such row).

### Movies and Series

A grid of titles, loaded as you scroll (D-040), sorted by date added (newest first, the default), name or release date, each either way (D-049), or highest rated first (the provider's rating, D-040).

**Apps:** TV ✅ · Phone ✅ · Desktop ✅

### Category chips

Above the grid, the categories sit on one line with "Show all" / "Show less"; expanded, they fill a full-width box that scrolls on its own (D-047). On TV the bar shows "All", the categories that fit, ‹ › and "Show all"; pressing "Show all" or "Show less" keeps the focus on the button and the page where it is (D-047).

**Apps:** TV ✅ · Phone ✅ · Desktop ✅. TV: ↓ to Show all · phone: tap · desktop: click; the wheel scrolls the line.

### Focus in the middle (TV)

On TV the focused title is kept in the middle of the screen on every page, so you always see where you are (D-094). Phones and computers scroll by touch, wheel or keyboard instead.

On TV, ← and → only move along the row you are in (a row of cards, the Home banner's Play and More Info, a row of buttons or chips) and stop at its ends; ↑ and ↓ change rows (D-069). On Live TV, ← from a channel still goes to the category list beside the guide.

**Apps:** TV ✅ · Phone ➖ · Desktop ➖ (no D-pad).

### Colour keys (TV)

Remotes with red, green, yellow and blue keys: **Red** adds the focused title (a cover, the details page, the movie or series playing) to My List or takes it off; **Green** opens audio and subtitles in the player, elsewhere it plays the first title of Continue Watching; **Yellow** starts a search from anywhere; **Blue** opens the guide over a live channel, elsewhere Live TV. A small dot in the key's colour marks the button it also presses (My List in details, the player's Audio and Guide, the search box, Live TV in the nav). Remotes without colour keys reach all of this the usual way (D-154, issue #180).

**Apps:** TV ✅ · Phone ➖ · Desktop ➖ (no colour keys).

## Covers and cards

### Card menu

A title card's menu: Go to details, Mark as watched / not watched (movies and series), Add to / Remove from My List; on Continue Watching also Remove (D-078, D-081). TV: hold OK; phone: long touch; desktop: right-click, the menu key or Shift+F10.

**Apps:** TV ✅ · Phone ✅ · Desktop ✅. TV: hold OK · phone: long touch · desktop: right-click, the menu key or Shift+F10.

### Watched tag

An eye at the bottom right of the cover, and in details, for watched movies and episodes and fully watched series (D-081).

**Apps:** TV ✅ · Phone ✅ · Desktop ✅

### Quality tag

At the top left of the cover: "4K" when a version is 4K, or "CAM", "TS", "TC" or "SCR" when every version is a cinema copy, so you know before opening it (D-141).

Titles on My List (its Home row and its page) carry the same tag: it is read from the library when the list loads.

**Apps:** TV ✅ · Phone ✅ · Desktop ✅

## Details

### Movie and series details

Poster, description, versions, Play, My List and a Watched toggle for the movie or the whole series (D-081). A series' Play button continues where you are: the episode in progress, or the next one not watched yet ("Play S1:E5") (D-131). Movies have Download and [Open in another player](#open-in-another-player) next to Play.

On a landscape screen (TV, a phone on its side, a desktop window wider than tall and at least 700 px wide) the details fill the screen in two columns (issue #186, D-158): the title, the buttons right under it, the facts, description and version stay on the left; a series' episodes scroll on the right, under the season choice, which stays put. A movie has one column, 2/3 of the screen wide: its cast, genres, director and source follow under the version and the backdrop fills the rest, so everything fits without scrolling (D-158). The episodes there look like on the phone: a smaller still, the title on two lines at most, the buttons under the text (D-158). TV: → from a series' last button goes to the episodes, ← from an episode comes back. Portrait screens and narrower windows keep the panel that scrolls as a whole; resizing the desktop window switches between the two.

TV: while the details are open the focus stays in them; nothing on the page behind can take it, even when that page changes (D-069). Closing them puts the focus back on the cover or button that opened them, or, when it is gone, on the first cover or button on screen.

**Apps:** TV ✅ · Phone ✅ · Desktop ✅. Two columns on TV, phones on their side and desktop windows wider than tall and at least 700 px wide. The focus rules are TV only.

### Seasons and episodes

A season choice with a "Watched" button on its left that marks the whole season watched or not (D-081, issue #159). Each episode row shows Play, "…" and its version; an episode the provider lists twice in one version (same title, or the same "S01E03" in it) is one row, the copy a choice in its version picker labelled "ENG #2" (D-066); its length and description stop after two lines with "…", and a touch or click on them shows the whole description, another folds it again (phone and desktop); on TV, once the focus has stayed on one of the episode's buttons for 1.5 s, the description rolls up a line at a time inside its two lines, rests at the end, then starts over; the description keeps its full length while it rolls, so nothing is cut off (issue #160); "…" (TV: hold OK on Play; phone: long touch; desktop: right-click) offers Mark as watched / not watched, Download, Play on TV and Open in another player (D-081, D-078). On TV, ↑/↓ move to the same button of the episode above or below (Play to Play, "…" to "…", version to version; to "…" when that episode has no version choice), and ←/→ move between the buttons of one episode (D-069).

**Apps:** TV ✅ · Phone ✅ · Desktop ✅. ↑/↓ to the same button of the next episode is TV only.

## Player

### Playback controls

Play / pause, ±10 s, from the beginning, previous / next episode (D-077), and "Skip ahead" by 30 s to 3 min instead of Skip Intro (D-042). At the end of an episode, the next one is offered (next-up). Presses in a row skip further each time: 10 s, 30 s, 1 min, 2 min, then 5 min; the other way or a pause of a second starts again at 10 s (D-128). TV: ←/→ and holding to scrub; with ←/→ the presses after the first move a preview on the progress bar and the video jumps once they stop (D-128); the on-screen ±10 s buttons skip at once; ↑/↓ open the buttons (D-077), and ↑ from them focuses the progress bar, where ←/→ move a preview with a picture of that moment, further with each press in a row, a held key keeps going, and the video jumps there a second after the last press or on OK (D-179, D-180); the remote's media keys (Play/Pause, Play, Pause, ⏪/⏩, Stop to close) work whatever is on screen (issue #178). Phone: full-screen landscape, double tap to skip and more quick taps to skip further, drag the timeline with a picture of that moment over it (D-180), the screen stays on (D-046); slide up or down on the left third of the video for brightness and on the right third for volume, with a bar that shows the level while sliding and a second after (issue #184, D-046). Desktop: keyboard (←/→, space, ↑/↓ volume; a held arrow repeats 10 s steps), media keys (play, pause, stop, back, forward; issue #178) and mouse; hovering over the timeline shows preview frames when the account allows a second stream (D-023, D-175).

**Apps:** TV ✅ · Phone ✅ · Desktop ✅. Sliding for brightness and volume is phone only (TV: the remote's volume keys; desktop: ↑/↓). Preview pictures on the timeline need a second stream from the account (all apps) and are not shown for downloads on TV and phone, nor for HLS streams there. Focusing the progress bar is TV only (phone: drag it; desktop: click or drag it).

### Audio, subtitles, versions and episodes

Buttons on the player bar open the audio tracks, subtitles, the title's versions and the series' episodes (D-077). Tracks without a name show their language's name, or "Default" for a lone unnamed track (D-090). The audio, subtitles and version last picked are every title's default, per profile (D-087).

**Apps:** TV ✅ · Phone ✅ · Desktop ✅

### Automatic subtitles

With your own OpenSubtitles.com API key, a movie or episode without subtitles in one of the languages chosen there gets one downloaded and turned on. Set up under the account menu → App → Automatic subtitles (D-111).

**Apps:** TV ✅ · Phone ✅ · Desktop ✅

### Pause when the headphones go away

Unplugging headphones or losing a Bluetooth headset pauses playback instead of carrying on through the speaker; on desktop, when the output device is removed (D-092).

**Apps:** TV ✅ · Phone ✅ · Desktop ✅. TV: Bluetooth headphones · phone: wired or Bluetooth · desktop: an output device removed.

### Playback errors

When a stream does not play, the error and the Log say why: the provider's answer (max connections, not found, expired, …), or a video the device cannot decode (D-074). The apps try the provider's stream server when the portal fails (D-088). When the provider's server stops answering in the middle of a video, the TV and phone app say so on screen ("The provider stopped sending the video. Reconnecting…") and carry on from the same point on the stream server, then the HLS copy; when nothing answers, the message says it is a problem on the provider's side and offers Try again, which starts again from where the video stopped. The desktop app gives the same message and Try again (D-074). The desktop app plays what Chromium plays; MKV with Dolby / DTS audio or HEVC without a decoder go to the TV app or VLC, and the error offers Open in VLC ([#236](https://github.com/brunoccst/iptv-player/issues/236)).

**Apps:** TV ✅ · Phone ✅ · Desktop ✅. Desktop plays MKV with H.264/AAC but not HEVC without a decoder or AC3/DTS audio ([#236](https://github.com/brunoccst/iptv-player/issues/236)).

### Connection limit

Before a stream starts, the apps ask the provider how many of the account's streams are in use. When all are, they say so and offer Play anyway or Go back, instead of a stream the provider refuses. They do not ask while switching channels or going on to the next episode, since the provider still counts the app's own stream then (D-175).

**Apps:** TV ✅ · Phone ✅ · Desktop ✅

### Audio decoder (TV and phone)

FFmpeg decoders for Dolby Digital / Plus and DTS are built in; the account menu → Library & devices → Playback chooses them or the device's decoders first. When the device's decoder fails on a title, the player switches to FFmpeg on its own, from the same point, and keeps that choice for the next titles (D-059).

**Apps:** TV ✅ · Phone ✅ · Desktop ➖ (Chromium decodes itself).

### Open in another player

Hands a movie or episode to another player app with the provider's User-Agent: VLC, MX Player, Just Player and others on TV and phone, VLC in the desktop app (D-057, D-081). From movie details and the episode "…" menu. Not for Kids profiles.

**Apps:** TV ✅ · Phone ✅ · Desktop ✅. TV and phone: any player app · desktop: VLC.

## Live TV

### TV guide

The Live TV page: categories on the left, a guide grid of channels and programmes (now and the next hours) on the right, with Earlier / Now / Later. Each channel's own short guide (its next 12 programmes) is filled in from the provider's full TV guide for the next 24 hours, so hours further ahead are not empty (issue #229). The categories and the guide each scroll on their own; the time header and channel column stay put (D-088, D-032). Selecting a channel plays it; the desktop app plays providers' HLS or, when they have none, MPEG-TS live streams (issue #220). TV: ↑/↓ in the categories move one category at a time and keep the focused one in the middle of the list; Channel +/− move a page up or down (issue #179). TV: → on a row's last programme shows the next hour; once the guide is ahead of now, ← on the first programme goes back an hour (issue #240).

**Apps:** TV ✅ · Phone ✅ · Desktop ✅. ↑/↓ through the categories, Channel +/− and moving the hours with ←/→ are TV only (phone and desktop: Earlier / Later).

### Catch-up

On channels whose provider keeps recordings, past programmes can be watched from the recording, and the programme on now from its start. Recorded programmes carry ↺ in the guide, which goes back up to a day. TV: OK on an ended programme plays it, holding OK on the programme on now starts it from the beginning. Phone and desktop: a programme's details offer Watch (ended) or From the start (on now) next to Watch live. A recording plays like a video: pause, seek and skip work, there is no LIVE tag, and no progress is kept (D-032, issue #226).

**Apps:** TV ✅ · Phone ✅ · Desktop ✅

### Guide over the playing channel

A see-through list of the category's channels with now / next over the playing video, to switch without leaving it. TV: ↑; phone: swipe up in the middle of the video (the sides set brightness and volume, D-046) or the Guide button; desktop: the Guide button or G (D-058, D-081).

**Apps:** TV ✅ · Phone ✅ · Desktop ✅. TV: ↑ · phone and desktop: Guide button · desktop: also G.

### Channels watched last

Each profile keeps its last 20 channels. Home's live row lists them; on TV, ↓ in a live channel shows the last 10 in a strip to switch to (D-129).

**Apps:** TV ✅ · Phone ✅ · Desktop ✅. The strip under a live channel is TV only.

## Search

### Titles, channels and programmes

Finds movies, series, live channels and programmes of the TV guide on now or in the next day, also from guides that leave out when a programme ends (issue #241); a programme plays the channel that shows it (D-130). Hidden categories are still searched (D-110). Movies and series load in pages as you move down; channels and programmes show the first 30 each. Every app filters them by All, Movies, Series or Live TV (D-094, D-047).

**Apps:** TV ✅ · Phone ✅ · Desktop ✅

## My List

### Watchlist

A watchlist per profile: add from details or the card menu; it has a Home row and its own page (D-055).

A title on My List carries a bookmark at the top right of its cover. The details button is the same bookmark: outlined when the title is not on My List, filled when it is (issue #157). On TV the focus stays on it after pressing it: while details are open, nothing on the page behind them can take the focus (D-069).

**Apps:** TV ✅ · Phone ✅ · Desktop ✅

### Better quality on My List

When a movie on My List was only available as a cinema copy (CAM, TS, TC or SCR, the tag on its cover) and a better copy arrives, Home shows a popup: "Better quality on My List" with the movie's cover and a line such as "Now 1080p, was TS". **Play** starts the best of the better copies, **More Info** opens its details, **OK** or Back closes it. Several movies that got better are listed in one popup. Each upgrade is shown once to the profile whose list has the movie; a movie that turns into a cinema copy again is announced again when it gets better. Any copy without a cinema tag counts as better, as for the cover's tag. The check runs when the app opens and after each library update (the app updates the library in the background once a day). The popup never shows during playback or over details (DECISIONS.md#d-176). Series are not announced yet (issue #251).

**Apps:** TV ✅ · Phone ✅ · Desktop ✅

## Downloads

### Offline downloads

Download movies and episodes to watch without a connection; My Downloads lists them. Downloads are encrypted, play only in the app, are deleted on sign-out and need the app online every 30 days (D-024, D-029, D-050).

**Apps:** TV ✅ · Phone ✅ · Desktop ✅

## Profiles

### Profiles and Kids

Several profiles per account, each with its own progress, My List, settings and languages. A Kids profile only shows children's categories (from their names, or the ones a parent picks) and has a smaller account menu (D-053).

Every time the app opens it asks "Who's watching?"; an account with a single profile opens it directly (D-151).

**Apps:** TV ✅ · Phone ✅ · Desktop ✅

### Parental PIN

An optional PIN locks leaving a Kids profile and managing profiles (D-054).

**Apps:** TV ✅ · Phone ✅ · Desktop ✅

### Content language filter

Per profile: only titles with audio or subtitles in the chosen languages, read from the titles' and categories' names (D-063). The order the languages are ticked in is their priority, shown as a number next to each ("1. English", "2. German"); unticking one moves the later ones up. A title starts with its version in the first of them it has, and the order decides which of equally good versions is "(best)" (D-063, D-087).

**Apps:** TV ✅ · Phone ✅ · Desktop ✅

### Categories shown

Per profile, hide categories from browsing (bars, lists, Home, Live TV, guide); search still finds them. "Select all" unchecks or checks a whole section (D-110).

**Apps:** TV ✅ · Phone ✅ · Desktop ✅

### App language

English, Português (Brasil), Deutsch and Srpskohrvatski (BiH), per profile: account menu → App → App language, or on the sign-in page. A first start follows the device's language (D-084).

**Apps:** TV ✅ · Phone ✅ · Desktop ✅

## Devices

### Sign in and sync by QR code

Every app shows a QR code: on the sign-in page, and under account menu → Library & devices → Sync with another device. Phones and tablets with a camera can also scan one: Scan a code in that dialog, or on the sign-in page (D-178). The sign-in is passed on, and profiles, My List and progress are merged on both devices (D-060). Whichever device is signed in passes its sign-in on: a signed-in phone that scans a signed-out device's code signs that device in; a signed-out phone or tablet that scans a signed-in device's code signs itself in (D-178). Both signed in to different accounts are refused.

Each profile's settings go along and end up the same on both devices (D-060): content languages, app language, the subtitles, audio and version last picked, hidden categories, a kids profile's categories, watched series and recently watched channels, plus the automatic-subtitles settings. Where both devices had a different choice, the scanning device's wins; watched series and recent channels are joined. A parental PIN already set on the device showing the code stays. What belongs to the device stays on it: the TV's audio decoder, the language the device shows before a profile is picked, downloads, and update choices.

**Apps:** TV ✅ · Phone ✅ · Desktop ✅. Every app shows the code; phones and tablets with a camera also scan one. Scanning with a computer's webcam: ⏳ [#254](https://github.com/brunoccst/iptv-player/issues/254).

### Play on TV

After pairing, the phone app starts a title on the TV (D-061).

**Apps:** TV ✅ receives · Phone ✅ sends · Desktop ➖

## App

### Account menu

The avatar at the top right opens it: other profiles, then the groups Profiles, Library & devices and App, each opening in place with a back arrow, and Sign out (D-079). On desktop it stays open while the mouse moves off it; a click elsewhere, the avatar again or Escape closes it (issue #155).

**Apps:** TV ✅ · Phone ✅ · Desktop ✅

### About

The installed version (MAJOR.MINOR.PATCH, D-070) and the commit and date it was built from; TV and phone also show whether Dolby / DTS audio is included and the Android version, the desktop app which system it is built for. Account menu → App → About.

**Apps:** TV ✅ · Phone ✅ · Desktop ✅

### Diagnostics log

What the app did, with the provider's answers, timings and native crashes, to share (TV, phone) or save and copy (desktop). Account menu → App → Log (D-039, D-074, D-115).

The log never shows the provider's server address, usernames, passwords, keys or tokens, e-mail or IP addresses; public services (TMDB, OpenSubtitles, GitHub) keep their address (D-039).

On a phone paired with a TV, Log → **Get TV log** fetches the TV's log over the home network and opens the phone's share sheet with it, so it can be sent from the phone (D-039). The TV app must be running and signed in, on any page; the phone app is the one in use. The TV's Log page says how.

**Apps:** TV ✅ · Phone ✅ · Desktop ✅. TV: share · phone: share, get the TV's log · desktop: save or copy.

### App updates

The apps look for new versions in this repository's releases (D-062, D-073): TV and phone download the APK, check it and open the Android installer; the desktop app installs updates itself on Windows and with the AppImage, and points to the download on macOS and with the .deb. While an accepted update downloads, the TV and phone show its percentage in the update dialog, and the desktop app at the top right of the window and on its taskbar icon, until it asks to restart (D-073). Account menu → App → Check for updates. Each release says what is new (D-143).

**Apps:** TV ✅ · Phone ✅ · Desktop ✅

### Full screen (phone and tablet)

The app hides Android's navigation bar, and the taskbar on tablets, on every page (D-177). Swipe up from the bottom edge to show it for a moment. The status bar stays outside the player.

**Apps:** TV ➖ (no navigation bar) · Phone ✅ · Desktop ➖ (a window; the player has its own full screen)

### Close the app (TV and phone)

Account menu → Close the app ends the app completely, like "Force stop" in the system settings.

**Apps:** TV ✅ · Phone ✅ · Desktop ➖ (closing the window does it).
