import { lazy, Suspense } from 'react';
import { Spinner } from '../../components/Spinner';
import { useUi } from '../../hooks/stores';
import { BrowsePage } from '../browse/BrowsePage';
import { SearchPage } from '../browse/SearchPage';
import { DetailsModal } from '../details/DetailsModal';
import { DownloadsPage } from '../downloads/DownloadsPage';
import { HomePage } from '../home/HomePage';
import { LiveTvPage } from '../live/LiveTvPage';
import { LibraryBanner } from './LibraryBanner';
import { TopNav } from './TopNav';

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
        {view === 'movies' || view === 'series' ? <BrowsePage section={view} banner={<LibraryBanner />} /> : null}
        {view === 'search' ? <SearchPage /> : null}
        {view === 'live' ? <LiveTvPage /> : null}
        {view === 'downloads' ? <DownloadsPage /> : null}
      </main>
      {details ? <DetailsModal target={details} /> : null}
      {playing ? (
        <Suspense
          fallback={
            <div className="player">
              <div className="player__center">
                <Spinner label="Loading player" />
              </div>
            </div>
          }
        >
          <PlayerOverlay key={`${playing.kind}-${playing.streamId}`} target={playing} />
        </Suspense>
      ) : null}
    </>
  );
}
