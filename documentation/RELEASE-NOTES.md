# Release notes

What is new for people using the apps, per app and version line (MAJOR.MINOR, D-070). Every build published to the `tv-apk` and `desktop` releases carries its version line's section under "What's new" (D-143). What each feature does and how it is reached: [FEATURES.md](FEATURES.md).

## Keeping it current (D-143)

- A pull request that adds or changes something people see or use adds a line under **Latest** of the app's current version line, newest first, with the date and its decision (D-…) or issue. It goes to every app it reaches (the apps on its feature's **Apps:** line in [FEATURES.md](FEATURES.md)).
- Raising MAJOR.MINOR in `apps/tv-app/package.json` or `apps/desktop/package.json` adds a new `### MAJOR.MINOR` section on top of that app's part, saying what is new in it; a version line without notes is not released.
- CI checks it (`npm run lint:release-notes`, in *Lint and format*): each app has a non-empty section for the MAJOR.MINOR in its `package.json`. `tv-apk.yml` and `desktop.yml` stop before building without it, and add the section to the release's notes after the line the apps read their version from (D-062, D-073).

## TV and phone app

### 3.0

A new version line from 2026-10-24 (3.0.0, 3.0.1, …): guide reminders reach the phone with the app closed, and settings and title splits now sync between your devices.

#### Latest

- **Edit your IPTV account** (2026-10-25, D-228): the account menu now has IPTV account, showing your provider's server, username and password (hidden until you press Show). Change them there when your provider moves or your password changes, without signing out: profiles, My List and progress stay.
- **"Provider unavailable" instead of "offline"** (2026-10-25, D-227): when your provider is down but your internet works, the banner now says your IPTV provider is unavailable instead of "You're offline". Downloads still play from My Downloads.
- **Guide reminders with the app closed** (2026-10-24, D-222, issue #263): on the phone and tablet, a reminder now also comes as a notification when the programme starts, even when the app is closed. Tap it to open the app and tune in with Watch. The app asks once to allow notifications.
- **Profile settings sync on their own** (2026-10-24, D-225, issue #268): with a TV paired, a profile's languages, subtitle and audio choices, hidden categories and other settings now follow along like My List, keeping whatever was changed last on any device.
- **Splits and merges on every device** (2026-10-24, D-223, issue #267): titles you split or merged by hand now reach your other devices with the next sync, and are kept in backups.

### 2.0

A new version line from 2026-10-12 (2.0.0, 2.0.1, …): the apps now warn before your provider refuses a stream, and fix more playback and guide problems on their own.

#### Latest

- **Backup buttons renamed** (2026-10-24, D-216, issue #237): Back up data now says "Save backup file" (it still asks where to save) and Restore from backup says "Restore backup", the same as on the desktop.
- **"Add Profile" in your language** (2026-10-23, D-200, issue #237): the tile that adds a profile was always in English; it now follows the app language.
- **My Downloads in your language** (2026-10-23, D-198, issue #237): a download's status (Waiting…, Downloading, Paused, Downloaded) now follows the app language instead of always showing in English.
- **Focus back on the cover after closing details** (2026-10-23, D-069): on the TV, closing a movie's or series' details left nothing focused. The focus now goes back to the cover or button you opened them from, or to the first one on screen if it is gone.
- **Play / pause in the middle, one season at a time** (2026-10-19, D-046, D-066): on the phone, tapping the video now also shows a big play / pause button in the middle of the screen, like Netflix and YouTube. The player's Episodes panel (phone and TV) shows one season with a season choice, opened on the season playing, and the episode playing is highlighted and can no longer be picked again.
- **Clearer phone player** (2026-10-19, D-046, D-190): the Audio, Subtitles and Episodes panel no longer shows Audio lit up as if selected, has a back arrow, and closes with a tap beside it. The brightness and volume bars now show on the sides whenever you tap to show the controls.
- **Smoother first library build** (2026-10-17, D-188, issue #228): reading the names of a large provider list no longer holds up the app. The TV and phone now do it in the background, so menus and remote presses keep answering while the library is built or updated.
- **Stays in sync with the TV** (2026-10-17, D-186, issue #227): a phone or tablet that has scanned the TV's code once now keeps profiles, progress and My List the same as the TV by itself, whenever the app opens or comes back and every 10 minutes, while the TV app is open on the same home network. Titles removed from My List or Continue watching and deleted profiles stay removed on both.
- **Split or merge titles** (2026-10-17, D-185, issue #243): when two versions that are not the same film or series end up as one title, or one title shows up twice, the Split or merge button in its details splits a version off or merges the other title in. It can be undone the same way.
- **Progress from other players** (2026-10-17, D-057, issue #234): when you watch a movie or episode in MX Player, Just Player or VLC, where you stopped is saved when you come back to the app, so Continue watching and Resume pick up from there. MX Player and Just Player also start where you left off.
- **Two days of TV guide, with descriptions** (2026-10-17, D-032, issue #248): the guide now has programmes for the next two days, as far as it goes, instead of one, and search finds them too. Programmes filled in from your provider's full guide now show their description when you open them.
- **Guide reminders** (2026-10-17, D-184, issue #239): ask to be reminded of a programme that has not started (on the TV, hold OK on it; on the phone, Remind me in its details). When it starts, the app says so, also during a movie, and Watch tunes to the channel. The app has to be open.
- **Better series on My List** (2026-10-17, D-176, issue #251): a series on My List that only had cinema copies (CAM, TS…) is now announced on Home when a better version arrives, like movies. More Info opens it on that version.
- **Fewer doubled titles** (2026-10-17, D-133, issue #217): titles listed with and without a French, Spanish, Italian, German or Dutch article ("La Casa de Papel", "Casa de Papel, La", "Casa de Papel") now show as one title. After the update, the library is grouped again once.
- **Catch-up only offers what your provider keeps** (2026-10-17, D-032, issue #247): programmes older than your provider keeps recordings for no longer carry ↺, so they no longer fail with a provider error. In time zones half an hour or a quarter off the hour, the guide's hours now start on your :00 and :30 (issue #225).
- **Details buttons stay together** (2026-10-16, D-183): when Play reads Resume and not every button fits on one line, the buttons that move down now go under the other small buttons, not under Resume.
- **Icons in the card menu** (2026-10-16, D-182): the menu that opens when you hold OK or long-touch a cover now shows an icon next to each option, the same icons the app uses elsewhere.
- **Covers no longer cut at the screen sides** (2026-10-15, D-181): on the TV, the first and last covers of a row used to touch the screen edge and lose a strip, and the focused one its glow. Rows now keep the focused cover a little away from both sides, and start a little further in.
- **A picture of the moment you are moving to** (2026-10-15, D-180): on the TV progress bar and while dragging it on the phone, a small picture of that point in the movie or episode shows above the bar, like on Netflix. On the TV, the video now jumps there a second after your last press, or straight away with OK. It needs your account to allow a second stream, and is not shown for downloads.
- **Move through a movie or episode from the progress bar** (2026-10-15, D-179): on the TV, press ↓ for the player's buttons and ↑ once more to focus the progress bar. There ← and → move the video back or forward: 10 s, then further with each press in a row (30 s, 1 min, 2 min, 5 min), and holding the key keeps going. ↓ returns to the buttons.
- **Home loads after switching profiles** (2026-10-14, D-063): choosing another profile from the account menu while on Home left Home empty until you refreshed the library or opened another page. Home now loads the new profile's titles straight away.
- **Sync phones and tablets with each other** (2026-10-12, D-178): every device now shows a sync QR code, on the sign-in page and under account menu → Library & devices → Sync with another device, so a phone can sync with a tablet and the other way round. Phones and tablets with a camera can also scan a code (Scan a code): signed in, they merge profiles, My List and progress with the other device; on the sign-in page, scanning a signed-in TV, computer or phone signs this device in.
- **Truly full screen on tablets and phones** (2026-10-12, D-177): the navigation bar and the tablet taskbar no longer cover the app. Swipe up from the bottom edge to show them for a moment.
- **Better quality on My List** (2026-10-12, D-176): when a movie on My List was only a cinema copy (CAM, TS…) and a better copy arrives, Home tells you with a popup, with Play and More Info.
- **My List and progress survive renamed titles** (2026-10-12, D-133, issue #216): when your provider renames a movie or series, it stays on My List and Continue watching instead of disappearing from them.
- **A longer TV guide** (2026-10-12, D-032, issue #229): the guide used to stop after each channel's next 12 programmes. Further ahead, it now shows the programmes of your provider's full TV guide, up to a day ahead.
- **Catch-up: watch what you missed** (2026-10-12, D-032, issue #226): on channels whose provider keeps recordings, ended programmes in the guide carry ↺ and play from the recording, with pause and seeking. OK plays an ended programme; holding OK on the programme on now starts it from the beginning. On the phone, a programme's details offer Watch or From the start. The guide now goes back a day.
- **A warning when all your streams are in use** (2026-10-12, D-175, issue #242): before a channel or title starts, the app asks your provider how many of the account's streams are in use. When all of them are, probably on another device, it says so and offers Play anyway or Go back, instead of a black screen or an error from the provider. Switching channels or going on to the next episode does not ask again.
- **Dolby and DTS sound fixes itself** (2026-10-12, D-059, issue #235): when the TV's or phone's own audio decoder fails on a title, the player switches to the built-in FFmpeg decoders and carries on from the same point, and keeps that choice for the next titles. You no longer have to find the setting after an error; it is still under Library & devices → Playback.
- **Move through the guide's hours with the remote** (2026-10-12, D-032, issue #240): on the TV, → on a row's last programme shows the next hour, and once the guide shows later hours, ← on the first programme goes back an hour. Earlier / Now / Later still work.
- **More programmes in search** (2026-10-12, D-130, issue #241): programmes from TV guides that leave out when a show ends now appear in search, ending where the channel's next programme starts.
- **Safer backups and pairing** (2026-10-12, D-056, issue #233): backup passwords and the phone-to-TV link now use the system's secure random numbers.

### 1.0

The first version line: every build since 2026-09-27 (1.0.0, 1.0.1, …).

#### Latest

- **Get the TV log on your phone** (2026-10-11, D-039): on a phone paired with the TV, Log → Get TV log fetches the TV's log and opens the share sheet, so you can send it from the phone. The TV app only has to be open. The log now also hides the server address, keys, e-mail and IP addresses, not just usernames and passwords.
- **The player says when the provider stops sending the video** (2026-10-11, D-074): when your provider's server stops answering in the middle of a movie, the screen no longer just goes black. It says the provider stopped sending the video, reconnects and carries on from the same point instead of where you started watching; if the provider still does not answer, it says the problem is on the provider's side and offers Try again. The home screen's Continue watching row now also updates on TVs that refused it before.
- **My List keeps the focus** (2026-10-11, D-069): on the TV, pressing My List in a movie's or series' details leaves the focus on the button, instead of sending it somewhere out of sight. While details are open, nothing on the page behind them can take the focus, and closing them puts the focus back on the cover or button that opened them (or the first one on screen, if it is gone).
- **"Show all" stays put** (2026-10-11, D-047): on the TV, pressing "Show all" in Movies or Series opens the full category list with the focus still on the button, now "Show less"; the page no longer jumps down to the titles.
- **Log has its own icon** (2026-10-09): in the account menu, Log now shows a page of lines instead of the same "i" icon as About.
- **Smooth focus in long seasons** (2026-10-08, D-158): on the TV, moving between the episodes of a season with many episodes no longer pauses about half a second on each step; it moves as smoothly as in a short season.
- **Episodes on TV look like on the phone** (2026-10-08, D-158): in the side-by-side details, each episode has a smaller picture, its title on up to two lines and its buttons under the text, so long titles no longer break one word per line. A movie's details take 2/3 of the screen.
- **A quick first refresh after this update** (2026-10-08, D-017): the first library refresh after an update that only changes how titles are grouped no longer reads every movie and series name again, so it no longer creeps along one percent at a time.
- **A movie's details in one column** (2026-10-08, D-158): in the side-by-side details, a movie's cast, genres, director and source now follow under the version, with the rest; only a series has a second column, for its episodes, and only the episode list scrolls: "Episodes", the season's Watched button and the season choice stay at the top.
- **Connecting a phone brings its settings too** (2026-10-07, D-060): scanning the TV's or computer's QR code with the phone now also brings each profile's settings, so both devices end up the same: content languages, app language, the subtitles, audio and version last picked, hidden categories, kids categories, watched series, recent channels and the automatic-subtitles settings. Where the two differed, the phone's choice wins. The TV's audio decoder stays as it is.
- **Top rated skips perfect scores** (2026-10-07, D-040): titles rated 100 % are left out of the Top rated rows; they are usually niche titles just out with a single review.
- **Top rated rows say what they hold** (2026-10-07, D-040): the Top rated rows on Home are now called "Top rated of the 100 newest movies" and "Top rated of the 100 newest series", and show 25 titles instead of 10.
- **Details side by side on TV** (2026-10-07, D-158, issue #186): on the TV, and on a phone held sideways, a movie's or series' details fill the screen in two columns: the title, Play and the other buttons, and the description stay on the left; a series' episodes scroll on the right. A movie's page fits on one screen, without scrolling to reach Play or Download.
- **Top rated shows what is new** (2026-10-07, D-040, issue #188): the "Top rated movies" and "Top rated series" rows on Home show the 10 best rated of the titles added last, instead of the best of all time, and have no "See all".
- **Same name, different film** (2026-10-07, D-133, issue #187): two films with the same name and year, such as the two "The Odyssey" of 2026, are no longer shown as one title when your provider gives them different TMDB ids. The library is rebuilt once after the update.
- **Brightness and volume by sliding on a phone** (2026-10-07, D-046, issue #184): while watching on a phone, slide up or down on the left side of the video for brightness and on the right side for volume. A bar shows the level while you slide and goes a second after you let go. The brightness is the player's own: the phone's comes back when you close it. On a live channel, swipe up in the middle to open the guide.
- **The remote's colour keys do something** (2026-10-07, D-154, issue #180): Red adds the title you are on to My List (or takes it off), Green opens audio and subtitles while watching (elsewhere it resumes your latest title), Yellow starts a search, Blue opens the guide on a live channel or Live TV. Small coloured dots show which button each key presses.
- **Top rated on Home** (2026-10-07, D-040, issue #181): Home has a "Top rated movies" and a "Top rated series" row, from your provider's ratings, highest first; "See all" opens Movies or Series sorted that way, and their Sort by has "Highest rated".
- **Live TV categories: one step at a time** (2026-10-07, issue #179): on the TV, ↑ and ↓ in the category list move exactly one category, and the list scrolls to keep it in the middle instead of jumping a page; Channel + and Channel − move a page up or down.
- **The remote's media keys always work in the player** (2026-10-07, issue #178): Play/Pause, Play, Pause, ⏪ and ⏩ now also work while the player's buttons, the audio and subtitles panel, the guide or Skip ahead are on screen; Stop closes the player.
- **On TV, ←/→ stay in the row** (2026-10-06, D-069): ← and → only move along the row you are in, and stop at its ends; ↑ and ↓ change rows. On Home, ← at the banner's Play and → at More Info no longer drop to the row below, and ↑ from the first row scrolls the banner fully into view at once; the same goes for row titles, the player's buttons, Search, My List, Profiles, Downloads and the settings dialogs.
- **"Who's watching?" every time** (2026-10-06, D-151): opening the app asks who is watching, like Netflix; an account with one profile opens it directly. The TV's own sleep screen is gone: while browsing, the TV's screensaver and power settings apply again (a video playing still keeps the screen on).
- **Skips add up** (2026-10-06, D-128): presses in a row skip 10 s, 30 s, 1 min, 2 min, then 5 min, now also with the on-screen ±10 s buttons and with quick taps on a phone; with the remote's ←/→ the second press already skips 30 s, not 10 s again.
- **Episode list on TV: ↑/↓ go straight up or down** (2026-10-06, D-069): in a series' episode list, ↑ and ↓ move to the same button of the episode above or below, so from "…" you reach the next episode's "…", not its Play button.
- **English before EAR** (2026-10-06, D-087): a title with an EAR version (English audio, Arabic subtitles in the picture) and a plain English one starts with the English one when English is one of your languages; the version list calls them "ENG" and "ENG (EAR)" instead of "ENG" and "ENG (2)".
- **Quality tag on My List** (2026-10-06, D-141): titles on My List, in its Home row and on its page, show "4K" or "CAM" / "TS" / "TC" / "SCR" on their cover like everywhere else.
- **Continue watching on the TV home screen** (2026-10-06, D-147, issue #165): on Android TV and Google TV, the movies and episodes you are in the middle of show in the home screen's "Continue watching" row; choosing one plays from where you stopped.
- **Episode descriptions roll on TV again** (2026-10-05, issue #160): on the TV a long description now rolls up through the rest of its text, instead of only losing its "…" and cutting off the last word.
- **No more doubled episodes** (2026-10-05, D-066): when the provider lists the same episode twice in one version ("S01E03" twice), it shows once; the second copy is a choice in the episode's version picker.
- **Back from Continue Watching shows the details** (2026-10-05, issue #166): a movie or episode started from Home's Continue Watching row goes back to its details page, not Home.
- **Languages in order of preference** (2026-10-05, D-063, issue #163): in the content language filter, the order you tick languages in is their priority, shown as a number next to each; versions follow it.
- **Titles start in your language** (2026-10-05, D-087, issue #163): a title with a version in the profile's language starts with the best of those, even when another language has a better quality.
- **Whole episode descriptions** (2026-10-05, issue #160): an episode's description still stops after two lines with "…". On the phone a touch on it shows all of it, another touch folds it again; on TV, after a moment on one of the episode's buttons, the description slowly rolls up through the rest of the text.
- **Season "Watched" button on the left** (2026-10-05, issue #159): it sits just left of the season choice, like an episode's tag, with the same spacing as the other buttons.
- **Bookmark for My List** (2026-10-05, issue #157): a title on My List has a bookmark at the top right of its cover; the details button is a bookmark too, filled when the title is saved.
- **Cinema copies on covers** (2026-10-05, D-141, issue #151): a title whose versions are all cinema copies says so on its cover, where "4K" goes: "CAM", "TS", "TC" or "SCR".
- **Live TV on TV: the guide scrolls on its own** (2026-10-04, D-032): the page fits the screen, the time header stays put, holding ↓ stays in the guide at the last channel, and ↑ from Earlier / Now / Later goes to the top bar.
- **Much faster "Refresh library"** (2026-10-04, D-135): native code saves the lists while they download, an update with few changes changes the library in place, and a list that has not changed since last time is not compared at all. A TV guide still downloading makes way for the update.
- **"(best)" only for the highest quality** (2026-10-04, D-087, issue #141): equally good versions are ordered by the profile's or the app's language.
- **Titles with unknown language prefixes are grouped** (2026-10-04, D-017): "XY - Title" or "|XY| Title" joins the title's other versions; names like "UFC - …" keep their prefix.
- **Play goes on to the next episode** (2026-10-03, D-131, issue #133): once you finished the last episode you watched, a series' Play button starts the next one not watched yet ("Play S1:E5").
- **Mark a season as watched** (2026-10-03, D-081, issue #132): a "Watched" button next to the season choice.
- **Search finds TV programmes** (2026-10-03, D-130, issue #119): programmes on now and in the next day, with the channel that shows them.
- **Channels watched last** (2026-10-03, D-129, issue #122): Home's live row lists them; ↓ in a live channel shows the last 10 in a strip.
- **Titles grouped by the database** (2026-10-03, D-133, issue #134): versions join by name and year or by TMDB id and year; similar spellings no longer join by mistake.
- **Faster skipping with the remote** (2026-09-30, D-128, issue #121): presses of ←/→ in a row skip 10 s, 30 s, 1 min, 2 min, then 5 min.
- **"Select all" in Categories shown** (2026-09-30, D-110, issue #120).

#### Earlier in 1.0

- The library lives in a database on the device: Home shows at once after a start, lists, search, live channels, details, profiles, progress and My List read only what they show (D-121).
- Automatic subtitles from OpenSubtitles with your own API key (D-111); Categories shown per profile (D-110); search filter All / Movies / Series / Live TV (D-047).
- The app in English, Português (Brasil), Deutsch and Srpskohrvatski (BiH) (D-084).
- Watched tags, mark episodes and whole series as watched, Watched toggle in details (D-081).
- Card menu with hold OK or a long touch: details, watched, My List, remove from Continue Watching (D-078, D-081).
- Player: from the beginning, previous / next episode (D-077); Audio, Subtitles and Episodes buttons (D-077); your last subtitles, audio and version are every title's default (D-087); pauses when the headphones go away (D-092).
- Large libraries (100k+ titles) on slow TVs: lists read by native code, faster grouping, no freezes (D-093, D-115).

## Desktop app

### 3.0

A new version line from 2026-10-24 (3.0.0, 3.0.1, …): conversions use the graphics card and keep 4K, and settings and title splits now sync between your devices.

#### Latest

- **Edit your IPTV account** (2026-10-25, D-228): the account menu now has IPTV account, showing your provider's server, username and password (hidden until you press Show). Change them there when your provider moves or your password changes, without signing out: profiles, My List and progress stay.
- **"Provider unavailable" instead of "offline"** (2026-10-25, D-227): when your provider is down but your internet works, the banner now says your IPTV provider is unavailable instead of "You're offline". Downloads still play from My Downloads.
- **Start with the computer** (2026-10-24, D-226, issue #309): account menu → App → Start with the computer. The app then waits in the tray from the moment you sign in to the computer, and closing the window keeps it there, so guide reminders show even when you are not using the app. Quit from the tray icon.
- **Profile settings sync on their own** (2026-10-24, D-225, issue #268): with a TV paired, a profile's languages, subtitle and audio choices, hidden categories and other settings now follow along like My List, keeping whatever was changed last on any device.
- **Splits and merges on every device** (2026-10-24, D-223, issue #267): titles you split or merged by hand now reach your other devices with the next sync, and are kept in backups.
- **Faster conversions in 4K, HDR in true colours** (2026-10-24, D-224, issue #274): videos the app has to convert (HEVC, Dolby sound…) now use your computer's graphics chip (NVIDIA, Intel, AMD or Apple) when it has one, so 4K stays 4K and the processor stays free; without one, nothing changes. HDR videos no longer look grey while converted.

### 2.0

A new version line from 2026-10-12 (2.0.0, 2.0.1, …): the app now warns before your provider refuses a stream.

#### Latest

- **Options panel like the TV's** (2026-10-24, D-221, issue #237): right-clicking a cover or pressing an episode's "…" opens the TV app's options panel in the middle of the window instead of a small menu at the mouse.
- **Log like the TV's** (2026-10-24, D-220, issue #237): the Log dialog uses the TV app's log view; warnings and errors are coloured.
- **Parental PIN keypad** (2026-10-24, D-219, issue #237): the parental PIN is typed on the TV app's keypad (keyboard digits work too), and Parental PIN in the account menu takes the TV's steps: the current PIN, then the new one twice.
- **Progress bar like the TV's** (2026-10-24, D-218, issue #237): the player's progress bar is the TV app's; the time on hover shows above the bar and the preview picture stays inside the window.
- **Player buttons like the TV's** (2026-10-24, D-217, issue #237): the player's buttons are the TV app's; Audio and Subtitles each open their own tab of the panel.
- **Backup looks like the TV's** (2026-10-24, D-216, issue #237): Back up & restore and Restore from a backup on the sign-in page now use the TV app's dialog; Choose backup file opens the file picker.
- **Library messages look like the TV's** (2026-10-24, D-215, issue #237): the offline and "organizing your library" box at the bottom of Home and Movies/Series, and the message after Refresh library, are now the same as on the TV and phone app.
- **Reminders look like the TV's** (2026-10-24, D-214, issue #237): when a programme with a reminder starts, the app now shows the TV's dialog in the middle of the window, with Watch and Dismiss, instead of a box at the top right.
- **Player title bar looks like the TV's** (2026-10-24, D-213, issue #237): the back arrow, title and LIVE tag at the top of the player are now the same as on the TV and phone app.
- **Skip ahead looks like the TV's** (2026-10-24, D-212, issue #237): the Skip ahead button and its 30 s to 3 min choices are now the same as on the TV and phone app.
- **Next episode card looks like the TV's** (2026-10-24, D-211, issue #237): the card that counts down to the next episode is now the same as on the TV and phone app.
- **Audio, subtitles and episodes in one panel** (2026-10-24, D-210, issue #237): the player's subtitles and episodes buttons now open the TV's panel at the side, with Audio, Subtitles, Versions and Episodes tabs; the playing episode is marked ▶.
- **Guide over the channel looks like the TV's** (2026-10-24, D-209, issue #237): the list of channels you open with G or the Guide button while watching live TV is now the same as on the TV and phone app.
- **Top bar looks like the TV's** (2026-10-24, D-208, issue #237): the bar with the page links, search box and avatar is now the same as on the TV and phone app; the link under the mouse is lit up, and a × clears the search.
- **Account menu looks like the TV's** (2026-10-24, D-207, issue #237): the menu under your avatar is now the same as on the TV and phone app, with an icon on every item and the highlighted item lit up as you move over it.
- **About and App language look like the TV's** (2026-10-23, D-206, issue #237): both are now the same dialogs as on the TV and phone app.
- **Language and subtitle settings look like the TV's** (2026-10-23, D-205, issue #237): the Content language filter and Automatic subtitles are now the same dialogs as on the TV and phone app.
- **Dialogs look like the TV's** (2026-10-23, D-204, issue #237): "Better quality on My List", a Kids profile's categories and Categories shown are now the same dialogs as on the TV and phone app.
- **Details buttons look like the TV's** (2026-10-23, D-203, issue #237): Download, Open in VLC and Split or merge in a title's details are now the TV app's buttons, and "Merge with another title" is the TV's picker. Escape closes the picker without closing the details.
- **Details look like the TV's** (2026-10-23, D-202, issue #237): a movie's or series' details are now the same screen as on the TV and phone app, with the TV's episode rows. The version and season choices are the usual drop-downs.
- **Live TV looks like the TV's** (2026-10-23, D-201, issue #237): the Live TV guide is now the same screen as on the TV and phone app. More channels load by themselves as you scroll down the guide.
- **Sign-in looks like the TV's** (2026-10-23, D-199, issue #237): the sign-in page is now the same screen as on the TV and phone app, with the language choice in the panel and the code to sign in from your phone beside it.
- **"Who's watching?" looks like the TV's** (2026-10-23, D-200, issue #237): the profile page and its editor are now the same screens as on the TV and phone app, and the page has Sign out too.
- **My Downloads looks like the TV's** (2026-10-23, D-198, issue #237): My Downloads is now the same screen as on the TV and phone app, with the same list, progress bar and round buttons.
- **Home looks like the TV's** (2026-10-23, D-197, issue #237): Home is now the same screen as on the TV and phone app. Each row shows its first 30 titles and ends with a "See all" card that opens the whole category.
- **Search looks like the TV's** (2026-10-23, D-196, issue #237): the search page is now the same screen as on the TV and phone app, with the same filter, results and "Keep typing…" note.
- **Movies and Series look like the TV's** (2026-10-23, D-195, issue #237): the Movies and Series pages are now the same screens as on the TV and phone app, with the same category chips and "Sort by" menu. More titles still load as you scroll down.
- **My List looks like the TV's** (2026-10-23, D-194, issue #237): the My List page is now the same screen as on the TV and phone app. Covers grow and light up when the mouse is over them, and a right-click still opens a title's menu.
- **Converted titles keep all their sound tracks** (2026-10-20, D-192, issue #270): when the app converts a film or episode the computer cannot play, every language stays in the audio menu, and your profile's language plays first. Hovering over the timeline shows pictures again, and downloads in HEVC or with Dolby or DTS sound now play offline too.
- **Progress from VLC** (2026-10-20, D-191, issue #265): Open in VLC now starts where you left off, and where you stop in VLC is saved, so Continue watching and Resume pick up from there.
- **The episode playing stands out** (2026-10-19, D-066): in the player's episode list, the episode playing is now highlighted and can no longer be picked again. It also opens on the right season when the episode plays from another version of the series.
- **Plays HEVC, Xvid and Dolby sound** (2026-10-17, D-189, issue #236): films and episodes the computer could not play (HEVC video without a decoder, Xvid, MPEG-2, Dolby Digital or DTS sound) now play in the app. It converts them while you watch; a video that played without sound now has it. The app download is bigger because of this.
- **Downloads go on with the window closed** (2026-10-17, D-187, issue #219): closing the window while something downloads now hides it instead, and the downloads carry on. The tray icon opens the app again or quits it, and the app closes by itself once they are done. Accounts with more than one stream also download up to three titles at once, always keeping one stream free for watching.
- **Stays in sync with the TV** (2026-10-17, D-186, issue #227): after this computer has scanned the TV's code once, it keeps profiles, progress and My List the same as the TV by itself, whenever the app opens or its window comes back and every 10 minutes, while the TV app is open on the same home network. Titles removed from My List or Continue watching and deleted profiles stay removed on both.
- **Split or merge titles** (2026-10-17, D-185, issue #243): when two versions that are not the same film or series end up as one title, or one title shows up twice, the Split or merge button in its details splits a version off or merges the other title in. It can be undone the same way.
- **A reload keeps your page** (2026-10-17, D-025, issue #221): the page you are on, its category, your search and the open details now stay after a reload instead of going back to Home.
- **Scan a sync code with the webcam** (2026-10-17, D-178, issue #254): the computer can now read another device's QR code with its camera: Scan a code instead under Sync with another device, or Scan a code on the sign-in page. Signed in, both devices get the same profiles, My List and progress; signed out, the computer signs in with the other device's account.
- **Two days of TV guide, with descriptions** (2026-10-17, D-032, issue #248): the guide now has programmes for the next two days, as far as it goes, instead of one, and search finds them too. Programmes filled in from your provider's full guide now show their description when you open them.
- **Guide reminders** (2026-10-17, D-184, issue #239): Remind me in a programme's details. When it starts, a banner says so, also during a movie, with Watch to tune in; with the window in the background, a system notification too. The app has to be open.
- **Better series on My List** (2026-10-17, D-176, issue #251): a series on My List that only had cinema copies (CAM, TS…) is now announced on Home when a better version arrives, like movies. More Info opens it on that version.
- **Fewer doubled titles** (2026-10-17, D-133, issue #217): titles listed with and without a French, Spanish, Italian, German or Dutch article ("La Casa de Papel", "Casa de Papel, La", "Casa de Papel") now show as one title. After the update, the library is grouped again once.
- **Catch-up only offers what your provider keeps** (2026-10-17, D-032, issue #247): programmes older than your provider keeps recordings for no longer carry ↺, so they no longer fail with a provider error. In time zones half an hour or a quarter off the hour, the guide's hours now start on your :00 and :30 (issue #225).
- **Details buttons stay together** (2026-10-16, D-183): when Play reads Resume and not every button fits on one line, the buttons that move down now go under the other small buttons, not under Resume.
- **Icons in the card menu** (2026-10-16, D-182): the menu that opens when you right-click a cover now shows an icon next to each option, the same icons the app uses elsewhere.
- **Home loads after switching profiles** (2026-10-14, D-063): choosing another profile from the account menu while on Home left Home empty until you refreshed the library or opened another page. Home now loads the new profile's titles straight away.
- **Sync with another device** (2026-10-12, D-178): the account menu's Sync with phone is now Sync with another device. Its code also works for tablets, and a signed-out phone or tablet that scans it gets this computer's sign-in.
- **Better quality on My List** (2026-10-12, D-176): when a movie on My List was only a cinema copy (CAM, TS…) and a better copy arrives, Home tells you with a popup, with Play and More Info.
- **My List and progress survive renamed titles** (2026-10-12, D-133, issue #216): when your provider renames a movie or series, it stays on My List and Continue watching instead of disappearing from them.
- **A longer TV guide** (2026-10-12, D-032, issue #229): the guide used to stop after each channel's next 12 programmes. Further ahead, it now shows the programmes of your provider's full TV guide, up to a day ahead.
- **Catch-up: watch what you missed** (2026-10-12, D-032, issue #226): on channels whose provider keeps recordings, ended programmes in the guide carry ↺, and their details offer Watch, which plays the recording with pause and seeking. The programme on now offers From the start. The guide now goes back a day.
- **Live TV on more providers** (2026-10-12, D-023, issue #220): channels from providers that only send live TV as MPEG-TS, not HLS, now play in the desktop app. Before, they did not play at all.
- **A warning when all your streams are in use** (2026-10-12, D-175, issue #242): before a channel or title starts, the app asks your provider how many of the account's streams are in use. When all of them are, probably on another device, it says so and offers Play anyway or Go back, instead of an error from the provider. Switching channels or going on to the next episode does not ask again.
- **Timeline previews no longer cost you the stream** (2026-10-12, D-175, issue #218): the preview frames over the timeline need a second stream, so they only show when your account allows more than one at a time and one is free. On one-stream accounts the provider no longer stops the video when you hover the timeline.
- **More programmes in search** (2026-10-12, D-130, issue #241): programmes from TV guides that leave out when a show ends now appear in search, ending where the channel's next programme starts.

### 1.0

The first version line: every build since 2026-09-27 (1.0.0, 1.0.1, …).

#### Latest

- **The log hides more** (2026-10-11, D-039): besides usernames and passwords, the log now hides the server address, keys, tokens, e-mail and IP addresses.
- **The player says when the provider stops sending the video** (2026-10-11, D-074): when your provider's server stops answering in the middle of a movie, the player says the problem is on the provider's side instead of "Playback stopped (media error)", and offers Try again, which carries on from where the video stopped.
- **Log has its own icon** (2026-10-09): in the account menu, Log now shows a page of lines instead of the same "i" icon as About.
- **A movie's details use more of the window** (2026-10-08, D-158): in the side-by-side details, a movie's one column takes 2/3 of the window; a series' episodes use the compact rows.
- **A quick first refresh after this update** (2026-10-08, D-017): the first library refresh after an update that only changes how titles are grouped no longer reads every movie and series name again, so it no longer creeps along one percent at a time.
- **You see the update downloading** (2026-10-08, D-073): after Install now, a box at the top right of the window shows the download of the new version with its percentage, until the app asks to restart.
- **A movie's details in one column** (2026-10-08, D-158): in the side-by-side details, a movie's cast, genres, director and source now follow under the version, with the rest; only a series has a second column, for its episodes, and only the episode list scrolls: "Episodes", the season's Watched button and the season choice stay at the top. The left side no longer grows past 720 px on a big screen.
- **Details side by side** (2026-10-08, D-158, issue #186): in a window wider than tall, a movie's or series' details fill the window in two columns, as on the TV: the title, Play and the other buttons, and the description stay on the left; a series' episodes scroll on the right, and a movie's cast and other facts sit there, so its page fits without scrolling. A narrow window keeps the panel.
- **Connecting a phone brings its settings too** (2026-10-07, D-060): scanning the TV's or computer's QR code with the phone now also brings each profile's settings, so both devices end up the same: content languages, app language, the subtitles, audio and version last picked, hidden categories, kids categories, watched series, recent channels and the automatic-subtitles settings. Where the two differed, the phone's choice wins.
- **Top rated skips perfect scores** (2026-10-07, D-040): titles rated 100 % are left out of the Top rated rows; they are usually niche titles just out with a single review.
- **Top rated rows say what they hold** (2026-10-07, D-040): the Top rated rows on Home are now called "Top rated of the 100 newest movies" and "Top rated of the 100 newest series", and show 25 titles instead of 10.
- **Row arrows only where they lead somewhere** (2026-10-07, D-040): on Home, a row's ‹ arrow is hidden while the row is at its beginning and its › arrow once it reaches the end; a row that fits on the screen shows neither.
- **Top rated shows what is new** (2026-10-07, D-040, issue #188): the "Top rated movies" and "Top rated series" rows on Home show the 10 best rated of the titles added last, instead of the best of all time, and have no "See all".
- **Same name, different film** (2026-10-07, D-133, issue #187): two films with the same name and year, such as the two "The Odyssey" of 2026, are no longer shown as one title when your provider gives them different TMDB ids. The library is rebuilt once after the update.
- **Top rated on Home** (2026-10-07, D-040, issue #181): Home has a "Top rated movies" and a "Top rated series" row, from your provider's ratings, highest first; "See all" opens Movies or Series sorted that way, and their Sort by has "Highest rated".
- **Media keys** (2026-10-07, issue #178): a keyboard's or headset's play, pause, stop, back and forward keys control the player.
- **"Who's watching?" every time** (2026-10-06, D-151): opening the app asks who is watching; an account with one profile opens it directly.
- **Skips add up** (2026-10-06, D-128): presses in a row of → / ← or of the ±10 s buttons skip 10 s, 30 s, 1 min, 2 min, then 5 min; holding a key still skips 10 s at a time.
- **English before EAR** (2026-10-06, D-087): a title with an EAR version (English audio, Arabic subtitles in the picture) and a plain English one starts with the English one when English is one of your languages; the version list calls them "ENG" and "ENG (EAR)" instead of "ENG" and "ENG (2)".
- **Quality tag on My List** (2026-10-06, D-141): titles on My List, in its Home row and on its page, show "4K" or "CAM" / "TS" / "TC" / "SCR" on their cover like everywhere else.
- **No more doubled episodes** (2026-10-05, D-066): when the provider lists the same episode twice in one version ("S01E03" twice), it shows once; the second copy is a choice in the episode's version picker.
- **Back from Continue Watching shows the details** (2026-10-05, issue #166): a movie or episode started from Home's Continue Watching row goes back to its details page, not Home.
- **Languages in order of preference** (2026-10-05, D-063, issue #163): in the content language filter, the order you tick languages in is their priority, shown as a number next to each; versions follow it.
- **Titles start in your language** (2026-10-05, D-087, issue #163): a title with a version in the profile's language starts with the best of those, even when another language has a better quality.
- **Whole episode descriptions** (2026-10-05, issue #160): an episode's description stops after two lines with "…"; a click on it shows all of it, another click folds it again.
- **Season "Watched" button on the left** (2026-10-05, issue #159): it sits just left of the season choice, like an episode's tag, with the same spacing as the other buttons.
- **Bookmark for My List** (2026-10-05, issue #157): a title on My List has a bookmark at the top right of its cover; the details button is a bookmark too, filled when the title is saved.
- **The account menu stays open** (2026-10-05, issue #155): moving the mouse off it no longer closes it; a click elsewhere or Escape does.
- **Cinema copies on covers** (2026-10-05, D-141, issue #151): a title whose versions are all cinema copies says so on its cover, where "4K" goes: "CAM", "TS", "TC" or "SCR".
- **Library banner at the bottom; roomier About and Log** (2026-10-05, D-119, issue #150): the offline and "organizing your library" banner floats over the content at the bottom, with progress per kind, as on TV.
- **Playback fixes** (2026-10-04, [#236](https://github.com/brunoccst/iptv-player/issues/236)): streams that the provider redirects to another server play again (they were blocked); the player tries the provider's stream server when the portal fails, as the TV app does; MKV with H.264 / AAC is no longer refused; a video the computer cannot decode (HEVC without a decoder, MPEG-4 / Xvid, MPEG-2) gets its own message, and the error offers Open in VLC.
- **Open in VLC uses the stream server** (2026-10-04) when the portal does not answer with a video.
- **Live TV fits the window** (2026-10-04, D-032): the categories and the guide scroll on their own; the guide's time header and channel column stay put.
- **Faster "Refresh library"** (2026-10-04, D-135): an update with few changes changes the library in place, and a list that has not changed since last time is not compared at all.
- **"(best)" only for the highest quality** (2026-10-04, D-087, issue #141): equally good versions are ordered by the profile's or the app's language.
- **Titles with unknown language prefixes are grouped** (2026-10-04, D-017).
- **Play goes on to the next episode** (2026-10-03, D-131, issue #133), **mark a season as watched** (D-081, issue #132), **search finds TV programmes** (D-130, issue #119), **channels watched last on Home** (D-129, issue #122), **titles grouped by the database** (D-133, issue #134).
- **"Select all" in Categories shown** (2026-09-30, D-110, issue #120).

#### Earlier in 1.0

- The library lives in a database on the computer: Home shows at once after a start; lists, search, live channels, details, profiles, progress and My List read only what they show (D-121).
- Automatic subtitles from OpenSubtitles with your own API key (D-111); Categories shown per profile (D-110).
- The app in English, Português (Brasil), Deutsch and Srpskohrvatski (BiH) (D-084).
- Category chips on one line with Show all / Show less (D-047).
- Watched tags, card menu by right-click, the guide over the playing channel (Guide button or G), Open in VLC (D-079, D-081).
- Your last subtitles, audio and version are every title's default (D-087); pauses when an output device is removed (D-092).
- Sign in and sync with the phone by QR code; the app installs its own updates on Windows and with the AppImage (D-060, D-073).
