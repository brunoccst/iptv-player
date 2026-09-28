import { memo, useState } from 'react';
import {
  cardMenuItems,
  isMovieWatched,
  isSeriesWatched,
  setMovieWatched,
  setSeriesWatched,
  type LibrarySection,
  type MasterCard as MasterCardData,
  tn,
  isOnWatchlist,
} from '@iptv/shared';
import { api, stores, uiStore } from '../../appContext';
import { CardMenu, type MenuPosition } from '../../components/CardMenu';
import { PosterCard } from '../../components/PosterCard';
import { useProfilePrefs, useProgress, useWatchlist } from '../../hooks/stores';

/**
 * Poster card for one deduplicated title. Opens the details modal; a right-click opens its menu (Go to details, Mark as
 * (not) watched, D-081). Finished movies and fully watched series (D-082) carry the "Watched" tag.
 * Memoized: loading the next grid page then renders only the new cards, not the thousands already shown.
 */
export const MasterCard = memo(function MasterCard({ section, item }: { section: LibrarySection; item: MasterCardData }) {
  const versions = item.variantCount > 1 ? tn('{count} version', '{count} versions', item.variantCount) : null;
  const movieWatched = useProgress((s) => section === 'movies' && isMovieWatched(s.items.data ?? [], item.id));
  const profileId = useProgress((s) => s.profileId);
  const seriesWatched = useProfilePrefs((s) => section === 'series' && isSeriesWatched(s.prefs, profileId, item.id));
  const watched = movieWatched || seriesWatched;
  const onList = useWatchlist((s) => isOnWatchlist(s, section, item.id));
  const [menu, setMenu] = useState<MenuPosition | null>(null);
  const openDetails = () => uiStore.getState().openDetails({ section, masterId: item.id });
  return (
    <>
      <PosterCard
        title={item.title}
        posterUrl={item.posterUrl}
        badge={item.bestQuality === '4K' ? '4K' : null}
        watched={watched}
        subtitle={[item.year, versions].filter(Boolean).join(' · ') || null}
        onSelect={openDetails}
        onMenu={setMenu}
      />
      {menu ? (
        <CardMenu
          title={item.title}
          position={menu}
          onClose={() => setMenu(null)}
          actions={cardMenuItems({ kind: section === 'movies' ? 'movie' : 'series', watched, onList }).map((entry) => ({
            label: entry.label,
            onSelect: () => {
              if (entry.id === 'details') openDetails();
              else if (entry.id === 'mylist-add' || entry.id === 'mylist-remove') void stores.watchlist.getState().toggle(section, item);
              else if (section === 'movies') void setMovieWatched(stores, item.id, entry.id === 'watched');
              else void setSeriesWatched({ api, ...stores }, item.id, entry.id === 'watched');
            },
          }))}
        />
      ) : null}
    </>
  );
});
