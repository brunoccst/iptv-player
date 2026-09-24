import { useEffect, useState, type ReactNode } from 'react';
import { continueWatching, pageKey, type LibrarySection, type MediaCategory } from '@iptv/shared';
import { stores, uiStore } from '../../appContext';
import { PosterCard } from '../../components/PosterCard';
import { Row } from '../../components/Row';
import { useCatalog, useLibrary, useProgress, useUi } from '../../hooks/stores';
import { usePagedLibrary } from '../../hooks/usePagedLibrary';
import { progressTarget } from '../../ui/targets';
import { Hero } from './Hero';
import { MasterCard } from './MasterCard';

const ROW_SIZE = 30;
const MOVIE_ROWS = 6;
const SERIES_ROWS = 3;

export function HomePage({ banner }: { banner: ReactNode }) {
  const revision = useUi((s) => s.libraryRevision);
  const featured = useLibrary((s) => s.pages[pageKey('movies', { limit: ROW_SIZE })]?.data?.items ?? []);
  const movieCategories = useCatalog((s) => s.categories.movies?.data ?? []);
  const seriesCategories = useCatalog((s) => s.categories.series?.data ?? []);

  useEffect(() => {
    const { library, catalog } = stores;
    void library.getState().loadPage('movies', { limit: ROW_SIZE });
    void catalog.getState().loadCategories('movies');
    void catalog.getState().loadCategories('series');
  }, [revision]);

  return (
    <div className="home">
      <Hero candidates={featured} />
      <div className="home__rows">
        {banner}
        <ContinueWatchingRow />
        <LiveRow />
        <LibraryRow key={`all-series-${revision}`} section="series" title="Series" />
        {movieCategories.slice(0, MOVIE_ROWS).map((category) => (
          <LibraryRow key={`m-${category.id}-${revision}`} section="movies" category={category} title={category.name} />
        ))}
        {seriesCategories.slice(0, SERIES_ROWS).map((category) => (
          <LibraryRow key={`s-${category.id}-${revision}`} section="series" category={category} title={`Series: ${category.name}`} />
        ))}
      </div>
    </div>
  );
}

function ContinueWatchingRow() {
  const items = useProgress((s) => continueWatching(s.items.data ?? []));
  if (items.length === 0) return null;
  return (
    <Row title="Continue Watching">
      {items.map((item) => (
        <PosterCard
          key={`${item.kind}-${item.itemId}`}
          title={item.title}
          posterUrl={item.posterUrl}
          progress={item.positionSeconds / item.durationSeconds}
          subtitle={item.kind === 'episode' && item.seasonNumber != null ? `S${item.seasonNumber}:E${item.episodeNumber ?? '?'}` : null}
          onSelect={() => uiStore.getState().play(progressTarget(item))}
        />
      ))}
    </Row>
  );
}

function LiveRow() {
  const categories = useCatalog((s) => s.categories.live?.data ?? null);
  const firstCategory = categories?.[0]?.id ?? null;
  const channels = useCatalog((s) => (firstCategory ? (s.liveChannels[firstCategory]?.data ?? []) : []));

  const load = () => {
    void stores.catalog
      .getState()
      .loadCategories('live')
      .then((loaded) => {
        if (loaded?.[0]) void stores.catalog.getState().loadLiveChannels(loaded[0].id);
      });
  };

  return (
    <Row title={categories?.[0] ? `Live TV: ${categories[0].name}` : 'Live TV'} onVisible={load} empty="No channels.">
      {channels.slice(0, ROW_SIZE).map((channel) => (
        <PosterCard
          key={channel.id}
          landscape
          title={channel.name}
          posterUrl={channel.logoUrl}
          badge="LIVE"
          onSelect={() =>
            uiStore
              .getState()
              .play({ kind: 'live', streamId: channel.id, container: 'm3u8', title: channel.name, posterUrl: channel.logoUrl })
          }
        />
      ))}
    </Row>
  );
}

function LibraryRow({ section, category, title }: { section: LibrarySection; category?: MediaCategory; title: string }) {
  const [visible, setVisible] = useState(false);
  const page = usePagedLibrary(section, { categoryId: category?.id }, ROW_SIZE, visible);
  if (page.done && page.items.length === 0) return null;

  return (
    <Row
      title={title}
      onVisible={() => setVisible(true)}
      onTitleClick={() => uiStore.getState().openCategory(section, category?.id ?? null)}
      onNearEnd={page.loadMore}
      loadingMore={page.loadingMore}
      empty={page.error ? 'Could not load this row.' : ' '}
    >
      {page.items.map((item) => (
        <MasterCard key={item.id} section={section} item={item} />
      ))}
    </Row>
  );
}
