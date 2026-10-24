# Features: code index

Where each feature in [FEATURES.md](FEATURES.md) lives in the code: the files to read first, from the repository root. Same groups and features, in the same order; `npm run lint:features` checks that every feature has a row and every path exists.

TV and phone are the React Native app in `apps/tv-app` (Android code in `apps/tv-app/modules/tv-media`); desktop is the web player in `apps/web-player` inside Electron (`apps/desktop`). Logic both share is in `packages/shared`.

## Sign-in and accounts

| Feature | Code |
|---------|------|
| [Sign-in](FEATURES.md#sign-in) | `packages/shared/src/stores/sessionStore.ts`, `packages/shared/src/direct/directApiClient.ts`, `packages/shared/src/direct/xtream.ts`, `packages/shared/src/stores/downloadsOwner.ts`, `apps/desktop/main.mjs`, `packages/screens/src/LoginScreen.tsx`, `apps/tv-app/src/screens/LoginScreen.tsx`, `apps/web-player/src/features/auth/LoginPage.tsx` |
| [Backup and restore](FEATURES.md#backup-and-restore) | `packages/shared/src/backup/userData.ts`, `apps/tv-app/src/components/BackupDialog.tsx`, `apps/web-player/src/features/backup/BackupDialog.tsx` |

## Library

| Feature | Code |
|---------|------|
| [Title grouping](FEATURES.md#title-grouping) | `packages/shared/src/direct/normalizer/parser.ts`, `packages/shared/src/direct/normalizer/matching.ts`, `packages/shared/src/direct/normalizer/pipeline.ts`, `packages/shared/src/direct/sqlLibrary.ts`, `packages/shared/src/direct/reattach.ts`, `apps/tv-app/modules/tv-media/android/src/main/java/expo/modules/tvmedia/LibraryDb.kt`, `apps/desktop/lib/libraryDb.mjs` |
| [Split or merge titles](FEATURES.md#split-or-merge-titles) | `packages/shared/src/direct/sqlLibrary.ts`, `packages/shared/src/direct/directApiClient.ts`, `packages/shared/src/hooks.ts`, `packages/screens/src/ui/RegroupButton.tsx` |
| [Version choice and "(best)"](FEATURES.md#version-choice-and-best) | `packages/shared/src/playback/playbackChoices.ts`, `packages/shared/src/stores/libraryStore.ts`, `packages/shared/src/direct/normalizer/pipeline.ts`, `packages/screens/src/DetailsScreen.tsx` |
| [Library updates](FEATURES.md#library-updates) | `packages/shared/src/direct/directApiClient.ts`, `packages/shared/src/direct/sqlLibrary.ts`, `packages/shared/src/stores/libraryStore.ts`, `apps/tv-app/modules/tv-media/android/src/main/java/expo/modules/tvmedia/ListReader.kt`, `packages/shared/src/direct/nameRow.ts`, `apps/tv-app/modules/tv-media/android/src/main/java/expo/modules/tvmedia/NameParser.kt`, `apps/tv-app/scripts/build-name-parser.mjs` |
| [Library banner](FEATURES.md#library-banner) | `packages/shared/src/stores/libraryStore.ts`, `apps/tv-app/src/useLibraryWatcher.ts`, `apps/tv-app/src/components/LibraryBanner.tsx`, `apps/web-player/src/features/shell/LibraryBanner.tsx` |

## Browsing

| Feature | Code |
|---------|------|
| [Home](FEATURES.md#home) | `packages/shared/src/hooks.ts`, `packages/shared/src/stores/libraryStore.ts`, `packages/screens/src/HomeScreen.tsx`, `packages/screens/src/ui/Row.tsx`, `apps/tv-app/src/screens/HomeScreen.tsx`, `apps/web-player/src/features/home/HomePage.tsx` |
| [Continue Watching](FEATURES.md#continue-watching) | `packages/shared/src/playback/rules.ts`, `packages/shared/src/stores/progressStore.ts`, `packages/shared/src/playback/targets.ts`, `apps/tv-app/src/navigation/navStore.ts`, `apps/web-player/src/ui/targets.ts` |
| [Continue watching on the TV home screen](FEATURES.md#continue-watching-on-the-tv-home-screen) | `apps/tv-app/src/tv/watchNext.ts`, `apps/tv-app/modules/tv-media/android/src/main/java/expo/modules/tvmedia/WatchNext.kt`, `apps/tv-app/src/App.tsx` |
| [Movies and Series](FEATURES.md#movies-and-series) | `packages/shared/src/hooks.ts`, `packages/shared/src/stores/libraryStore.ts`, `packages/shared/src/direct/sqlLibrary.ts`, `packages/screens/src/BrowseScreen.tsx`, `packages/screens/src/TitleGrid.tsx`, `apps/tv-app/src/screens/BrowseScreen.tsx`, `apps/web-player/src/features/browse/BrowsePage.tsx`, `apps/web-player/src/features/browse/screenHost.tsx` |
| [Category chips](FEATURES.md#category-chips) | `packages/shared/src/stores/catalogStore.ts`, `packages/screens/src/ui/ChipBar.tsx` |
| [Focus in the middle (TV)](FEATURES.md#focus-in-the-middle-tv) | `apps/tv-app/src/components/CenterScroll.tsx`, `apps/tv-app/src/components/FocusRow.tsx`, `apps/tv-app/src/components/Row.tsx`, `apps/tv-app/src/components/rowReveal.ts`, `apps/tv-app/src/screens/titles.tsx` |
| [Colour keys (TV)](FEATURES.md#colour-keys-tv) | `apps/tv-app/src/tv/colourKeys.tsx`, `apps/tv-app/src/tv/remote.ts`, `apps/tv-app/src/tv/remoteEvents.ts`, `apps/tv-app/src/player/PlayerScreen.tsx` |
| [Page address (desktop)](FEATURES.md#page-address-desktop) | `apps/web-player/src/ui/uiStore.ts` |

## Covers and cards

| Feature | Code |
|---------|------|
| [Card menu](FEATURES.md#card-menu) | `packages/shared/src/playback/watched.ts`, `packages/shared/src/hooks.ts`, `apps/tv-app/src/components/CardMenu.tsx`, `apps/web-player/src/components/CardMenu.tsx` |
| [Watched tag](FEATURES.md#watched-tag) | `packages/shared/src/playback/watched.ts`, `packages/shared/src/playback/rules.ts`, `apps/tv-app/src/components/WatchedTag.tsx` |
| [Quality tag](FEATURES.md#quality-tag) | `packages/shared/src/hooks.ts`, `packages/shared/src/direct/normalizer/pipeline.ts`, `packages/shared/src/direct/normalizer/tags.ts`, `packages/shared/src/stores/watchlistStore.ts` |

## Details

| Feature | Code |
|---------|------|
| [Movie and series details](FEATURES.md#movie-and-series-details) | `packages/shared/src/hooks.ts`, `packages/shared/src/playback/watched.ts`, `packages/screens/src/DetailsScreen.tsx`, `apps/tv-app/src/components/pageFocus.ts`, `apps/tv-app/src/App.tsx`, `apps/web-player/src/features/details/DetailsModal.tsx` |
| [Seasons and episodes](FEATURES.md#seasons-and-episodes) | `packages/shared/src/playback/seriesVersions.ts`, `packages/shared/src/playback/watched.ts`, `packages/screens/src/ui/focusGrid.ts`, `packages/screens/src/DetailsScreen.tsx` |

## Player

| Feature | Code |
|---------|------|
| [Playback controls](FEATURES.md#playback-controls) | `packages/shared/src/playback/remoteSeek.ts`, `packages/shared/src/playback/rules.ts`, `apps/tv-app/src/player/PlayerScreen.tsx`, `apps/tv-app/src/player/TouchLevels.tsx`, `apps/tv-app/src/player/framePreview.ts`, `apps/tv-app/modules/tv-media/android/src/main/java/expo/modules/tvmedia/FramePreview.kt`, `apps/web-player/src/features/player/PlayerOverlay.tsx`, `apps/web-player/src/features/player/frameGrabber.ts` |
| [Audio, subtitles, versions and episodes](FEATURES.md#audio-subtitles-versions-and-episodes) | `packages/shared/src/playback/playbackChoices.ts`, `apps/tv-app/src/player/QuickDrawer.tsx`, `apps/web-player/src/features/player/TracksMenu.tsx`, `apps/web-player/src/features/player/EpisodesDrawer.tsx`, `apps/web-player/src/features/player/tracks.ts` |
| [Automatic subtitles](FEATURES.md#automatic-subtitles) | `packages/shared/src/subtitles/openSubtitles.ts`, `packages/screens/src/SubtitleSettings.tsx`, `apps/tv-app/src/player/PlayerScreen.tsx`, `apps/web-player/src/features/player/PlayerOverlay.tsx` |
| [Pause when the headphones go away](FEATURES.md#pause-when-the-headphones-go-away) | `apps/tv-app/modules/tv-media/android/src/main/java/expo/modules/tvmedia/TvPlayerView.kt`, `apps/web-player/src/features/player/audioOutput.ts` |
| [Playback errors](FEATURES.md#playback-errors) | `packages/shared/src/playback/sources.ts`, `packages/shared/src/playback/probe.ts`, `apps/web-player/src/features/player/playbackEngine.ts`, `apps/tv-app/src/player/PlayerScreen.tsx`, `apps/desktop/lib/transcoder.mjs` |
| [Connection limit](FEATURES.md#connection-limit) | `packages/shared/src/playback/connectionLimit.ts`, `packages/shared/src/direct/xtream.ts`, `apps/tv-app/src/player/PlayerScreen.tsx`, `apps/web-player/src/features/player/PlayerOverlay.tsx` |
| [Audio decoder (TV and phone)](FEATURES.md#audio-decoder-tv-and-phone) | `apps/tv-app/modules/tv-media/android/build.gradle`, `apps/tv-app/src/playbackSettings.ts`, `apps/tv-app/src/components/PlaybackSettings.tsx`, `apps/tv-app/modules/tv-media/android/src/main/java/expo/modules/tvmedia/TvPlayerView.kt` |
| [Open in another player](FEATURES.md#open-in-another-player) | `apps/tv-app/src/player/externalPlayer.ts`, `apps/tv-app/src/player/useExternalPlayer.ts`, `apps/tv-app/modules/tv-media/android/src/main/java/expo/modules/tvmedia/TvMediaModule.kt`, `apps/web-player/src/components/vlc.ts`, `apps/desktop/main.mjs`, `apps/desktop/lib/vlc.mjs` |

## Live TV

| Feature | Code |
|---------|------|
| [TV guide](FEATURES.md#tv-guide) | `packages/shared/src/epg/guide.ts`, `packages/shared/src/direct/directApiClient.ts`, `packages/shared/src/stores/epgStore.ts`, `packages/shared/src/react.ts`, `packages/screens/src/LiveScreen.tsx`, `apps/web-player/src/features/live/LiveTvPage.tsx` |
| [Catch-up](FEATURES.md#catch-up) | `packages/shared/src/playback/catchup.ts`, `packages/shared/src/direct/xtream.ts`, `packages/shared/src/direct/directApiClient.ts`, `packages/screens/src/LiveScreen.tsx`, `apps/web-player/src/features/live/LiveTvPage.tsx`, `apps/web-player/src/features/player/playbackEngine.ts`, `packages/shared/src/direct/sqlLibrary.ts` |
| [Guide reminders](FEATURES.md#guide-reminders) | `packages/shared/src/playback/reminders.ts`, `packages/shared/src/hooks.ts`, `packages/screens/src/LiveScreen.tsx`, `apps/tv-app/src/components/ReminderDialog.tsx`, `apps/web-player/src/features/live/LiveTvPage.tsx`, `apps/web-player/src/features/live/ReminderToast.tsx` |
| [Guide over the playing channel](FEATURES.md#guide-over-the-playing-channel) | `apps/tv-app/src/player/GuideOverlay.tsx`, `apps/web-player/src/features/player/GuidePanel.tsx` |
| [Channels watched last](FEATURES.md#channels-watched-last) | `packages/shared/src/playback/recentChannels.ts`, `packages/shared/src/hooks.ts`, `apps/tv-app/src/player/RecentChannelsOverlay.tsx` |

## Search

| Feature | Code |
|---------|------|
| [Titles, channels and programmes](FEATURES.md#titles-channels-and-programmes) | `packages/screens/src/TopNav.tsx`, `packages/shared/src/search/useSearchQuery.ts`, `packages/shared/src/search/searchDelay.ts`, `packages/shared/src/direct/directApiClient.ts`, `apps/tv-app/modules/tv-media/android/src/main/java/expo/modules/tvmedia/XmltvFilter.kt`, `packages/screens/src/SearchScreen.tsx`, `apps/tv-app/src/screens/SearchScreen.tsx`, `apps/web-player/src/features/browse/SearchPage.tsx` |

## My List

| Feature | Code |
|---------|------|
| [Watchlist](FEATURES.md#watchlist) | `packages/shared/src/stores/watchlistStore.ts`, `packages/screens/src/MyListScreen.tsx`, `packages/screens/src/TitleCard.tsx`, `packages/screens/src/ui/pageFocus.ts`, `apps/tv-app/src/screenHost.tsx`, `apps/web-player/src/features/browse/MyListPage.tsx` |
| [Better quality on My List](FEATURES.md#better-quality-on-my-list) | `packages/shared/src/stores/watchlistStore.ts`, `packages/shared/src/hooks.ts`, `packages/shared/src/direct/directApiClient.ts`, `packages/screens/src/QualityUpgradeDialog.tsx` |

## Downloads

| Feature | Code |
|---------|------|
| [Offline downloads](FEATURES.md#offline-downloads) | `packages/screens/src/DownloadsScreen.tsx`, `apps/tv-app/modules/tv-media/android/src/main/java/expo/modules/tvmedia/DownloadCenter.kt`, `apps/tv-app/modules/tv-media/android/src/main/java/expo/modules/tvmedia/OfflineKey.kt`, `apps/web-player/src/offline/downloadManager.ts`, `apps/web-player/src/offline/offlineResponder.ts`, `apps/web-player/src/offline/desktopReads.ts`, `apps/web-player/src/features/downloads/backgroundDownloads.ts`, `apps/desktop/main.mjs`, `packages/shared/src/playback/offlineAccess.ts` |

## Profiles

| Feature | Code |
|---------|------|
| [Profiles and Kids](FEATURES.md#profiles-and-kids) | `packages/shared/src/profiles/kidsFilter.ts`, `packages/shared/src/appContext.ts`, `packages/shared/src/stores/sessionStore.ts`, `packages/screens/src/ProfilesScreen.tsx`, `packages/screens/src/KidsCategories.tsx`, `apps/tv-app/src/screens/ProfilesScreen.tsx`, `apps/web-player/src/features/profiles/ProfilePicker.tsx` |
| [Parental PIN](FEATURES.md#parental-pin) | `packages/shared/src/stores/pinStore.ts`, `apps/tv-app/src/components/PinPad.tsx`, `apps/web-player/src/features/profiles/PinDialog.tsx` |
| [Content language filter](FEATURES.md#content-language-filter) | `packages/shared/src/profiles/contentLanguages.ts`, `packages/shared/src/stores/profilePrefsStore.ts`, `packages/shared/src/hooks.ts`, `packages/shared/src/appContext.ts`, `packages/shared/src/direct/sqlLibrary.ts`, `packages/shared/src/playback/playbackChoices.ts`, `packages/screens/src/LanguageSettings.tsx` |
| [Categories shown](FEATURES.md#categories-shown) | `packages/shared/src/profiles/hiddenCategories.ts`, `packages/shared/src/hooks.ts`, `packages/shared/src/direct/sqlLibrary.ts`, `packages/screens/src/HiddenCategories.tsx` |
| [App language](FEATURES.md#app-language) | `packages/shared/src/i18n/i18n.ts`, `packages/shared/src/i18n/uiLanguage.ts`, `packages/shared/src/i18n/catalogs`, `packages/screens/src/AppLanguageDialog.tsx` |

## Devices

| Feature | Code |
|---------|------|
| [Sign in and sync by QR code](FEATURES.md#sign-in-and-sync-by-qr-code) | `packages/shared/src/pairing/pairing.ts`, `packages/shared/src/pairing/settings.ts`, `packages/shared/src/pairing/sealed.ts`, `packages/shared/src/pairing/usePairingServer.ts`, `apps/tv-app/src/pairing/pairing.ts`, `apps/tv-app/src/pairing/PairingDialogs.tsx`, `apps/tv-app/src/screens/LoginScreen.tsx`, `apps/tv-app/modules/tv-media/android/src/main/java/expo/modules/tvmedia/PairingServer.kt`, `apps/web-player/src/features/pairing/SyncWithPhone.tsx`, `apps/web-player/src/features/pairing/WebcamScanner.tsx`, `apps/web-player/src/features/pairing/pairing.ts`, `apps/desktop/main.mjs` |
| [Staying in sync with the TV](FEATURES.md#staying-in-sync-with-the-tv) | `packages/shared/src/pairing/autoSync.ts`, `packages/shared/src/pairing/pairing.ts`, `packages/shared/src/direct/removals.ts`, `apps/tv-app/src/pairing/remote.ts`, `apps/web-player/src/features/pairing/pairing.ts`, `apps/desktop/main.mjs` |
| [Play on TV](FEATURES.md#play-on-tv) | `packages/shared/src/pairing/remote.ts`, `apps/tv-app/src/pairing/remote.ts`, `apps/tv-app/src/pairing/usePlayOnTv.ts`, `apps/tv-app/src/App.tsx` |

## App

| Feature | Code |
|---------|------|
| [Account menu](FEATURES.md#account-menu) | `packages/screens/src/AccountMenu.tsx`, `packages/screens/src/TopNav.tsx`, `apps/tv-app/src/components/AccountMenu.tsx`, `apps/tv-app/src/navigation/navStore.ts`, `apps/web-player/src/features/shell/TopNav.tsx` |
| [About](FEATURES.md#about) | `packages/screens/src/AboutDialog.tsx`, `apps/tv-app/src/about.ts`, `apps/tv-app/app.config.ts`, `apps/web-player/src/features/shell/about.ts`, `apps/web-player/src/buildInfo.ts`, `apps/web-player/vite.config.ts` |
| [Diagnostics log](FEATURES.md#diagnostics-log) | `packages/shared/src/utils/logger.ts`, `packages/shared/src/pairing/remote.ts`, `apps/tv-app/src/diagnostics/logReport.ts`, `apps/tv-app/src/pairing/remote.ts`, `apps/tv-app/src/startupLog.ts`, `apps/tv-app/src/screens/LogScreen.tsx`, `apps/tv-app/src/diagnostics/stallWatch.ts`, `apps/tv-app/modules/tv-media/android/src/main/java/expo/modules/tvmedia/CrashLog.kt`, `apps/web-player/src/features/shell/LogDialog.tsx` |
| [App updates](FEATURES.md#app-updates) | `apps/tv-app/src/update/updates.ts`, `apps/tv-app/src/update/UpdateDialog.tsx`, `apps/tv-app/modules/tv-media/android/src/main/java/expo/modules/tvmedia/AppUpdater.kt`, `apps/desktop/main.mjs`, `apps/desktop/preload.cjs`, `apps/web-player/src/features/shell/UpdateProgress.tsx`, `scripts/release-notes.mjs` |
| [Full screen (phone and tablet)](FEATURES.md#full-screen-phone-and-tablet) | `apps/tv-app/src/App.tsx`, `apps/tv-app/app.config.ts` |
| [Close the app (TV and phone)](FEATURES.md#close-the-app-tv-and-phone) | `apps/tv-app/src/signOut.ts`, `apps/tv-app/modules/tv-media/android/src/main/java/expo/modules/tvmedia/TvMediaModule.kt` |
