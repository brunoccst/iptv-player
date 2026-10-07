import { useEffect, useState, type ReactNode } from 'react';
import {
  continueWatching,
  pageKey,
  watchlistCard,
  recentChannelTarget,
  TOP_RATED_SORT,
  type LibrarySection,
  type LibrarySortChoice,
  type MediaCategory,
  type ProgressDto,
  t,
} from '@iptv/shared';
import { stores, uiStore } from '../../appContext';
import { CardMenu, type MenuPosition } from '../../components/CardMenu';
import { PosterCard } from '../../components/PosterCard';
import { Row } from '../../components/Row';
import { continueMenuItems, useLiveHomeRow, useCatalog, useLibrary, useProgress, useUi, useWatchlist } from '../../hooks/stores';
import { usePagedLibrary } from '../../hooks/stores';
import { playFromContinue } from '../../ui/targets';
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
        <MyListRow />
        <LiveRow />
        {/* The provider's best-rated titles (D-153, issue #181). */}
        <LibraryRow key={`top-movies-${revision}`} section="movies" sort={TOP_RATED_SORT} title={t('Top rated movies')} />
        <LibraryRow key={`top-series-${revision}`} section="series" sort={TOP_RATED_SORT} title={t('Top rated series')} />
        <LibraryRow key={`all-series-${revision}`} section="series" title={t('Series')} />
        {movieCategories.slice(0, MOVIE_ROWS).map((category) => (
          <LibraryRow key={`m-${category.id}-${revision}`} section="movies" category={category} title={category.name} />
        ))}
        {seriesCategories.slice(0, SERIES_ROWS).map((category) => (
          <LibraryRow
            key={`s-${category.id}-${revision}`}
            section="series"
            category={category}
            title={t('Series: {name}', { name: category.name })}
          />
        ))}
      </div>
    </div>
  );
}

const NO_PROGRESS: ProgressDto[] = [];

function ContinueWatchingRow() {
  const all = useProgress((s) => s.items.data) ?? NO_PROGRESS;
  const items = continueWatching(all);
  // Right-click on a card opens its options (holding OK on TV, D-078, D-079).
  const [menu, setMenu] = useState<{ item: ProgressDto; position: MenuPosition } | null>(null);
  if (items.length === 0) return null;
  const subtitleOf = (item: ProgressDto) =>
    item.kind === 'episode' && item.seasonNumber != null ? `S${item.seasonNumber}:E${item.episodeNumber ?? '?'}` : null;
  return (
    <Row title={t('Continue Watching')}>
      {items.map((item) => (
        <PosterCard
          key={`${item.kind}-${item.itemId}`}
          title={item.title}
          posterUrl={item.posterUrl}
          progress={item.positionSeconds / item.durationSeconds}
          subtitle={subtitleOf(item)}
          onSelect={() => playFromContinue(uiStore, item)}
          onMenu={(position) => setMenu({ item, position })}
        />
      ))}
      {menu ? (
        <CardMenu
          title={menu.item.title}
          subtitle={subtitleOf(menu.item)}
          position={menu.position}
          onClose={() => setMenu(null)}
          actions={continueMenuItems(menu.item, (section, masterId) => uiStore.getState().openDetails({ section, masterId })).map(
            (entry) => ({
              label: entry.label,
              onSelect: entry.run,
            }),
          )}
        />
      ) : null}
    </Row>
  );
}

/** Saved titles (D-055); the title opens the My List page. */
function MyListRow() {
  const items = useWatchlist((s) => s.items.data ?? []);
  if (items.length === 0) return null;
  return (
    <Row title={t('My List')} onTitleClick={() => uiStore.getState().navigate('mylist')}>
      {items.slice(0, ROW_SIZE).map((item) => (
        <MasterCard key={`${item.section}-${item.masterId}`} section={item.section} item={watchlistCard(item)} />
      ))}
    </Row>
  );
}

/** The channels the profile watched last; until there are any, the first live category (issue #122, D-129). */
function LiveRow() {
  const [visible, setVisible] = useState(false);
  const row = useLiveHomeRow(visible);
  return (
    <Row title={row.title} onVisible={() => setVisible(true)} empty={t('No channels.')}>
      {row.channels.slice(0, ROW_SIZE).map((channel) => (
        <PosterCard
          key={channel.id}
          landscape
          title={channel.name}
          posterUrl={channel.logoUrl}
          badge={t('LIVE')}
          onSelect={() => uiStore.getState().play(recentChannelTarget(channel))}
        />
      ))}
    </Row>
  );
}

function LibraryRow({
  section,
  category,
  title,
  sort,
}: {
  section: LibrarySection;
  category?: MediaCategory;
  title: string;
  /** A row in another order (Top rated, D-153); its title opens the list in it. */
  sort?: LibrarySortChoice;
}) {
  const [visible, setVisible] = useState(false);
  const page = usePagedLibrary(section, { categoryId: category?.id, sort }, ROW_SIZE, visible);
  if (page.done && page.items.length === 0) return null;

  return (
    <Row
      title={title}
      onVisible={() => setVisible(true)}
      onTitleClick={() => {
        if (sort) stores.library.getState().chooseSort(section, sort);
        uiStore.getState().openCategory(section, category?.id ?? null);
      }}
      onNearEnd={page.loadMore}
      loadingMore={page.loadingMore}
      empty={page.error ? t('Could not load this row.') : ' '}
    >
      {page.items.map((item) => (
        <MasterCard key={item.id} section={section} item={item} />
      ))}
    </Row>
  );
}

/** Continue Watching card menu: is its title on My List, and add/remove it (D-104). */
