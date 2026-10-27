// Screens written once in React Native for every app (issue #237, DECISIONS.md#d-193): the TV and phone app render
// them natively, the desktop app through React Native Web. No app imports; each app brings its `ScreenHost`.
export { AboutDialog } from './AboutDialog';
export { AccountMenu, type AccountMenuGroup } from './AccountMenu';
export { AppLanguageDialog } from './AppLanguageDialog';
export { StartupDialog } from './StartupDialog';
export { BackupDialog } from './BackupDialog';
export {
  ScreenHostProvider,
  setScreenHost,
  useScreenHost,
  type DownloadEntry,
  type MenuAction,
  type RemoteEvent,
  type ScreenHost,
  type TitleDownload,
  type TitleMenuItem,
} from './host';
export { DetailsScreen } from './DetailsScreen';
export { DownloadsScreen } from './DownloadsScreen';
export { ConnectionBanner, LibraryBanner, LibraryNotice, NOTICE_MS } from './LibraryBanner';
export { categoryPage, LiveScreen } from './LiveScreen';
export { GUIDE_HIDE_MS, GuideOverlay } from './GuideOverlay';
export { HiddenCategories } from './HiddenCategories';
export { LanguageSettings } from './LanguageSettings';
export { LoginScreen } from './LoginScreen';
export { NextUp } from './NextUp';
export { PlayerControls } from './PlayerControls';
export { PlayerHeader } from './PlayerHeader';
export { ProfilesScreen } from './ProfilesScreen';
export { QualityUpgradeDialog } from './QualityUpgradeDialog';
export { NewSeasonsDialog } from './NewSeasonsDialog';
export { ReminderDialog } from './ReminderDialog';
export { QuickDrawer, type DrawerTab, type TrackOption } from './QuickDrawer';
export { BrowseScreen } from './BrowseScreen';
export { HomeScreen } from './HomeScreen';
export { MyListScreen, useGridColumns } from './MyListScreen';
export { SearchScreen } from './SearchScreen';
export { SkipAhead } from './SkipAhead';
export { SubtitleSettings } from './SubtitleSettings';
export { TopNav, useNavFocusTarget, type NavSection } from './TopNav';
export { LoadingMoreNote, TitleGrid, TvLines } from './TitleGrid';
export { TitleCard } from './TitleCard';
export { Dialog } from './ui/Dialog';
export { IconButton } from './ui/IconButton';
export { TimelineRail } from './TimelineRail';
export { PinPad, pinMessage, usePinGate } from './PinPad';
export { PinSettings } from './PinSettings';
export { LogView, type LogAction } from './LogView';
export { CardMenu, TitleMenu } from './CardMenu';
