import { lazy, Suspense } from 'react';
import { Spinner } from '../../components/Spinner';
import { useUi } from '../../hooks/stores';
import { SearchPage } from '../browse/SearchPage';
import { DetailsModal } from '../details/DetailsModal';
import { DownloadsPage } from '../downloads/DownloadsPage';
import { HomePage } from '../home/HomePage';
import { QualityUpgradeDialog } from '../home/QualityUpgradeDialog';
import { ReminderToast } from '../live/ReminderToast';
import { LiveTvPage } from '../live/LiveTvPage';
import { LibraryBanner, LibraryNotice } from './LibraryBanner';
import { TopNav } from './TopNav';
import { t } from '@iptv/shared';

// Screens shared with the TV app come with React Native Web (issue #237, DECISIONS.md#d-193): loaded when first shown.
const MyListPage = lazy(() => import('../browse/MyListPage').then((module) => ({ default: module.MyListPage })));
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
        {view === 'search' ? <SearchPage /> : null}
        {view === 'live' ? <LiveTvPage /> : null}
        {view === 'mylist' ? (
          <Suspense fallback={<Spinner />}>
            <MyListPage />
          </Suspense>
        ) : null}
        {view === 'downloads' ? <DownloadsPage /> : null}
      </main>
      <LibraryNotice />
      {details ? <DetailsModal target={details} /> : null}
      {/* Better copies of movies on My List, over Home only (DECISIONS.md#d-176). */}
      {view === 'home' && !details && !playing ? <QualityUpgradeDialog /> : null}
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
      <ReminderToast />
    </>
  );
}
