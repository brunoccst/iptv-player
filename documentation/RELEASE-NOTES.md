# Release notes

What is new for people using the apps, per app and version line (MAJOR.MINOR, D-070). Every build published to the `tv-apk` and `desktop` releases carries its version line's section under "What's new" (D-143). What each feature does and how it is reached: [FEATURES.md](FEATURES.md).

## Keeping it current (D-143)

- A pull request that adds or changes something people see or use adds a line under **Latest** of the app's current version line, newest first, with the date and its decision (D-…) or issue. It goes to every app it reaches (the same apps as its row in [PARITY.md](PARITY.md)).
- Raising MAJOR.MINOR in `apps/tv-app/package.json` or `apps/desktop/package.json` adds a new `### MAJOR.MINOR` section on top of that app's part, saying what is new in it; a version line without notes is not released.
- CI checks it (`npm run lint:release-notes`, in *Lint and format*): each app has a non-empty section for the MAJOR.MINOR in its `package.json`. `tv-apk.yml` and `desktop.yml` stop before building without it, and add the section to the release's notes after the line the apps read their version from (D-062, D-073).

## TV and phone app

### 1.0

The first version line: every build since 2026-09-27 (1.0.0, 1.0.1, …).

#### Latest

- **Same name, different film** (2026-10-07, D-156, issue #187): two films with the same name and year, such as the two "The Odyssey" of 2026, are no longer shown as one title when your provider gives them different TMDB ids. The library is rebuilt once after the update.
- **Brightness and volume by sliding on a phone** (2026-10-07, D-155, issue #184): while watching on a phone, slide up or down on the left side of the video for brightness and on the right side for volume. A bar shows the level while you slide and goes a second after you let go. The brightness is the player's own: the phone's comes back when you close it. On a live channel, swipe up in the middle to open the guide.
- **The remote's colour keys do something** (2026-10-07, D-154, issue #180): Red adds the title you are on to My List (or takes it off), Green opens audio and subtitles while watching (elsewhere it resumes your latest title), Yellow starts a search, Blue opens the guide on a live channel or Live TV. Small coloured dots show which button each key presses.
- **Top rated on Home** (2026-10-07, D-153, issue #181): Home has a "Top rated movies" and a "Top rated series" row, from your provider's ratings, highest first; "See all" opens Movies or Series sorted that way, and their Sort by has "Highest rated".
- **Live TV categories: one step at a time** (2026-10-07, issue #179): on the TV, ↑ and ↓ in the category list move exactly one category, and the list scrolls to keep it in the middle instead of jumping a page; Channel + and Channel − move a page up or down.
- **The remote's media keys always work in the player** (2026-10-07, issue #178): Play/Pause, Play, Pause, ⏪ and ⏩ now also work while the player's buttons, the audio and subtitles panel, the guide or Skip ahead are on screen; Stop closes the player.
- **On TV, ←/→ stay in the row** (2026-10-06, D-152): ← and → only move along the row you are in, and stop at its ends; ↑ and ↓ change rows. On Home, ← at the banner's Play and → at More Info no longer drop to the row below, and ↑ from the first row scrolls the banner fully into view at once; the same goes for row titles, the player's buttons, Search, My List, Profiles, Downloads and the settings dialogs.
- **"Who's watching?" every time** (2026-10-06, D-151): opening the app asks who is watching, like Netflix; an account with one profile opens it directly. The TV's own sleep screen is gone: while browsing, the TV's screensaver and power settings apply again (a video playing still keeps the screen on).
- **Skips add up** (2026-10-06, D-150): presses in a row skip 10 s, 30 s, 1 min, 2 min, then 5 min, now also with the on-screen ±10 s buttons and with quick taps on a phone; with the remote's ←/→ the second press already skips 30 s, not 10 s again.
- **Episode list on TV: ↑/↓ go straight up or down** (2026-10-06, D-149): in a series' episode list, ↑ and ↓ move to the same button of the episode above or below, so from "…" you reach the next episode's "…", not its Play button.
- **English before EAR** (2026-10-06, D-148): a title with an EAR version (English audio, Arabic subtitles in the picture) and a plain English one starts with the English one when English is one of your languages; the version list calls them "ENG" and "ENG (EAR)" instead of "ENG" and "ENG (2)".
- **Quality tag on My List** (2026-10-06, D-141): titles on My List, in its Home row and on its page, show "4K" or "CAM" / "TS" / "TC" / "SCR" on their cover like everywhere else.
- **Continue watching on the TV home screen** (2026-10-06, D-147, issue #165): on Android TV and Google TV, the movies and episodes you are in the middle of show in the home screen's "Continue watching" row; choosing one plays from where you stopped.
- **Episode descriptions roll on TV again** (2026-10-05, issue #160): on the TV a long description now rolls up through the rest of its text, instead of only losing its "…" and cutting off the last word.
- **No more doubled episodes** (2026-10-05, D-146): when the provider lists the same episode twice in one version ("S01E03" twice), it shows once; the second copy is a choice in the episode's version picker.
- **Back from Continue Watching shows the details** (2026-10-05, issue #166): a movie or episode started from Home's Continue Watching row goes back to its details page, not Home.
- **Languages in order of preference** (2026-10-05, D-145, issue #163): in the content language filter, the order you tick languages in is their priority, shown as a number next to each; versions follow it.
- **Titles start in your language** (2026-10-05, D-144, issue #163): a title with a version in the profile's language starts with the best of those, even when another language has a better quality.
- **Whole episode descriptions** (2026-10-05, issue #160): an episode's description still stops after two lines with "…". On the phone a touch on it shows all of it, another touch folds it again; on TV, after a moment on one of the episode's buttons, the description slowly rolls up through the rest of the text.
- **Season "Watched" button on the left** (2026-10-05, issue #159): it sits just left of the season choice, like an episode's tag, with the same spacing as the other buttons.
- **Bookmark for My List** (2026-10-05, issue #157): a title on My List has a bookmark at the top right of its cover; the details button is a bookmark too, filled when the title is saved.
- **Cinema copies on covers** (2026-10-05, D-141, issue #151): a title whose versions are all cinema copies says so on its cover, where "4K" goes: "CAM", "TS", "TC" or "SCR".
- **Live TV on TV: the guide scrolls on its own** (2026-10-04, D-140): the page fits the screen, the time header stays put, holding ↓ stays in the guide at the last channel, and ↑ from Earlier / Now / Later goes to the top bar.
- **Much faster "Update library"** (2026-10-04, D-135, D-137, D-138): native code saves the lists while they download, an update with few changes changes the library in place, and a list that has not changed since last time is not compared at all. A TV guide still downloading makes way for the update.
- **"(best)" only for the highest quality** (2026-10-04, D-136, issue #141): equally good versions are ordered by the profile's or the app's language.
- **Titles with unknown language prefixes are grouped** (2026-10-04, D-134): "XY - Title" or "|XY| Title" joins the title's other versions; names like "UFC - …" keep their prefix.
- **Play goes on to the next episode** (2026-10-03, D-131, issue #133): once you finished the last episode you watched, a series' Play button starts the next one not watched yet ("Play S1:E5").
- **Mark a season as watched** (2026-10-03, D-132, issue #132): a "Watched" button next to the season choice.
- **Search finds TV programmes** (2026-10-03, D-130, issue #119): programmes on now and in the next day, with the channel that shows them.
- **Channels watched last** (2026-10-03, D-129, issue #122): Home's live row lists them; ↓ in a live channel shows the last 10 in a strip.
- **Titles grouped by the database** (2026-10-03, D-133, issue #134): versions join by name and year or by TMDB id and year; similar spellings no longer join by mistake.
- **Faster skipping with the remote** (2026-09-30, D-128, issue #121): presses of ←/→ in a row skip 10 s, 30 s, 1 min, 2 min, then 5 min.
- **"Select all" in Categories shown** (2026-09-30, D-127, issue #120).

#### Earlier in 1.0

- The library lives in a database on the device: Home shows at once after a start, lists, search, live channels, details, profiles, progress and My List read only what they show (D-117 to D-126).
- Automatic subtitles from OpenSubtitles with your own API key (D-111); Categories shown per profile (D-110); search filter All / Movies / Series / Live TV (D-108).
- The app in English, Português (Brasil), Deutsch and Srpskohrvatski (BiH) (D-084).
- Watched tags, mark episodes and whole series as watched, Watched toggle in details (D-081, D-082, D-104).
- Card menu with hold OK or a long touch: details, watched, My List, remove from Continue Watching (D-078, D-104).
- Player: from the beginning, previous / next episode (D-077); Audio, Subtitles and Episodes buttons (D-102); your last subtitles, audio and version are every title's default (D-087); pauses when the headphones go away (D-092).
- Large libraries (100k+ titles) on slow TVs: lists read by native code, faster grouping, no freezes (D-093, D-113, D-115, D-118).

## Desktop app

### 1.0

The first version line: every build since 2026-09-27 (1.0.0, 1.0.1, …).

#### Latest

- **Same name, different film** (2026-10-07, D-156, issue #187): two films with the same name and year, such as the two "The Odyssey" of 2026, are no longer shown as one title when your provider gives them different TMDB ids. The library is rebuilt once after the update.
- **Top rated on Home** (2026-10-07, D-153, issue #181): Home has a "Top rated movies" and a "Top rated series" row, from your provider's ratings, highest first; "See all" opens Movies or Series sorted that way, and their Sort by has "Highest rated".
- **Media keys** (2026-10-07, issue #178): a keyboard's or headset's play, pause, stop, back and forward keys control the player.
- **"Who's watching?" every time** (2026-10-06, D-151): opening the app asks who is watching; an account with one profile opens it directly.
- **Skips add up** (2026-10-06, D-150): presses in a row of → / ← or of the ±10 s buttons skip 10 s, 30 s, 1 min, 2 min, then 5 min; holding a key still skips 10 s at a time.
- **English before EAR** (2026-10-06, D-148): a title with an EAR version (English audio, Arabic subtitles in the picture) and a plain English one starts with the English one when English is one of your languages; the version list calls them "ENG" and "ENG (EAR)" instead of "ENG" and "ENG (2)".
- **Quality tag on My List** (2026-10-06, D-141): titles on My List, in its Home row and on its page, show "4K" or "CAM" / "TS" / "TC" / "SCR" on their cover like everywhere else.
- **No more doubled episodes** (2026-10-05, D-146): when the provider lists the same episode twice in one version ("S01E03" twice), it shows once; the second copy is a choice in the episode's version picker.
- **Back from Continue Watching shows the details** (2026-10-05, issue #166): a movie or episode started from Home's Continue Watching row goes back to its details page, not Home.
- **Languages in order of preference** (2026-10-05, D-145, issue #163): in the content language filter, the order you tick languages in is their priority, shown as a number next to each; versions follow it.
- **Titles start in your language** (2026-10-05, D-144, issue #163): a title with a version in the profile's language starts with the best of those, even when another language has a better quality.
- **Whole episode descriptions** (2026-10-05, issue #160): an episode's description stops after two lines with "…"; a click on it shows all of it, another click folds it again.
- **Season "Watched" button on the left** (2026-10-05, issue #159): it sits just left of the season choice, like an episode's tag, with the same spacing as the other buttons.
- **Bookmark for My List** (2026-10-05, issue #157): a title on My List has a bookmark at the top right of its cover; the details button is a bookmark too, filled when the title is saved.
- **The account menu stays open** (2026-10-05, issue #155): moving the mouse off it no longer closes it; a click elsewhere or Escape does.
- **Cinema copies on covers** (2026-10-05, D-141, issue #151): a title whose versions are all cinema copies says so on its cover, where "4K" goes: "CAM", "TS", "TC" or "SCR".
- **Library banner at the bottom; roomier About and Log** (2026-10-05, D-142, issue #150): the offline and "organizing your library" banner floats over the content at the bottom, with progress per kind, as on TV.
- **Playback fixes** (2026-10-04, KI-045): streams that the provider redirects to another server play again (they were blocked); the player tries the provider's stream server when the portal fails, as the TV app does; MKV with H.264 / AAC is no longer refused; a video the computer cannot decode (HEVC without a decoder, MPEG-4 / Xvid, MPEG-2) gets its own message, and the error offers Open in VLC.
- **Open in VLC uses the stream server** (2026-10-04) when the portal does not answer with a video.
- **Live TV fits the window** (2026-10-04, D-139): the categories and the guide scroll on their own; the guide's time header and channel column stay put.
- **Faster "Update library"** (2026-10-04, D-137, D-138): an update with few changes changes the library in place, and a list that has not changed since last time is not compared at all.
- **"(best)" only for the highest quality** (2026-10-04, D-136, issue #141): equally good versions are ordered by the profile's or the app's language.
- **Titles with unknown language prefixes are grouped** (2026-10-04, D-134).
- **Play goes on to the next episode** (2026-10-03, D-131, issue #133), **mark a season as watched** (D-132, issue #132), **search finds TV programmes** (D-130, issue #119), **channels watched last on Home** (D-129, issue #122), **titles grouped by the database** (D-133, issue #134).
- **"Select all" in Categories shown** (2026-09-30, D-127, issue #120).

#### Earlier in 1.0

- The library lives in a database on the computer: Home shows at once after a start; lists, search, live channels, details, profiles, progress and My List read only what they show (D-120 to D-126).
- Automatic subtitles from OpenSubtitles with your own API key (D-111); Categories shown per profile (D-110).
- The app in English, Português (Brasil), Deutsch and Srpskohrvatski (BiH) (D-084).
- Category chips on one line with Show all / Show less (D-085, D-091).
- Watched tags, card menu by right-click, the guide over the playing channel (Guide button or G), Open in VLC (D-079, D-081, D-082, D-104).
- Your last subtitles, audio and version are every title's default (D-087); pauses when an output device is removed (D-092).
- Sign in and sync with the phone by QR code; the app installs its own updates on Windows and with the AppImage (D-072, D-073).
