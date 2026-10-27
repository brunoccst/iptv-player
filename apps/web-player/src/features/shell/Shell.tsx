import { lazy, Suspense } from 'react';
import { Spinner } from '../../components/Spinner';
import { useUi } from '../../hooks/stores';
import { DetailsModal } from '../details/DetailsModal';
import { DownloadsPage } from '../downloads/DownloadsPage';
import { HomePage } from '../home/HomePage';
import { QualityUpgradeDialog } from '../home/QualityUpgradeDialog';
import { NewSeasonsDialog } from '../home/NewSeasonsDialog';
import { Reminder } from '../live/Reminder';
import { LiveTvPage } from '../live/LiveTvPage';
import { ConnectionBanner, LibraryBanner, LibraryNotice } from './LibraryBanner';
import { TopNav } from './TopNav';
import { t } from '@iptv/shared';

// Screens shared with the TV app come with React Native Web (issue #237, DECISIONS.md#d-193): loaded when first shown.
const MyListPage = lazy(() => import('../browse/MyListPage').then((module) => ({ default: module.MyListPage })));
const SearchPage = lazy(() => import('../browse/SearchPage').then((module) => ({ default: module.SearchPage })));
const BrowsePage = lazy(() => import('../browse/BrowsePage').then((module) => ({ default: module.BrowsePage })));

// hls.js is large: load the player only when something plays.
const PlayerOverlay = lazy(() => import('../player/PlayerOverlay').then((module) => ({ default: module.PlayerOverlay })));

/** Signed-in layout: navigation, current view, details modal, player. */
export function Shell() {
  const view = useUi((s) => s.view);
  const details = useUi((s) => s.details);
  const playing = useUi((s) => s.playing);

  return (
    <>
      <TopNav />
      <main aria-hidden={playing ? true : undefined}>
        {view === 'home' ? <HomePage banner={<LibraryBanner />} /> : null}
        {view === 'movies' || view === 'series' ? (
          <Suspense fallback={<Spinner />}>
            <BrowsePage section={view} banner={<LibraryBanner />} />
          </Suspense>
        ) : null}
        {view === 'search' ? (
          <Suspense fallback={<Spinner />}>
            <SearchPage />
          </Suspense>
        ) : null}
        {view === 'live' ? <LiveTvPage /> : null}
        {view === 'mylist' ? (
          <Suspense fallback={<Spinner />}>
            <MyListPage />
          </Suspense>
        ) : null}
        {view === 'downloads' ? <DownloadsPage /> : null}
      </main>
      <LibraryNotice />
      {/* Offline or the provider down, on every page but the player (DECISIONS.md#d-230). */}
      {details || playing ? null : <ConnectionBanner />}
      {details ? <DetailsModal target={details} /> : null}
      {/* Better copies of movies on My List, over Home only (DECISIONS.md#d-176). */}
      {view === 'home' && !details && !playing ? <QualityUpgradeDialog /> : null}
      {/* New seasons of watched series, after it (DECISIONS.md#d-234). */}
      {view === 'home' && !details && !playing ? <NewSeasonsDialog /> : null}
      {playing ? (
        <Suspense
          fallback={
            <div className="player">
              <div className="player__center">
                <Spinner label={t('Loading player')} />
              </div>
            </div>
          }
        >
          <PlayerOverlay key={`${playing.kind}-${playing.streamId}`} target={playing} />
        </Suspense>
      ) : null}
      <Reminder />
    </>
  );
}
