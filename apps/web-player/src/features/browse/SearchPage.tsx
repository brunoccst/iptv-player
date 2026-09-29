import { useEffect, useState } from 'react';
import type { LibrarySortChoice, LiveChannel } from '@iptv/shared';
import { api, uiStore } from '../../appContext';
import { PosterCard } from '../../components/PosterCard';
import { useUi } from '../../hooks/stores';
import { PagedGrid } from './BrowsePage';
import { t } from '@iptv/shared';

const DEBOUNCE_MS = 300;
const MAX_CHANNELS = 30;
/** Which results show (D-108): everything, or only movies, series or live channels. Same as the TV app. */
type SearchKind = 'all' | 'movies' | 'series' | 'live';
const KINDS: { kind: SearchKind; label: () => string }[] = [
  { kind: 'all', label: () => t('All') },
  { kind: 'movies', label: () => t('Movies') },
  { kind: 'series', label: () => t('Series') },
  { kind: 'live', label: () => t('Live TV') },
];
/** Search results read best alphabetically. */
const BY_TITLE: LibrarySortChoice = { sort: 'title', order: 'asc' };

/** Searches movies and series (title or normalized key) and live channels by name; same as the TV app. */
export function SearchPage() {
  const search = useUi((s) => s.search);
  const [query, setQuery] = useState(search.trim());

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const [kind, setKind] = useState<SearchKind>('all');
  const shows = (section: SearchKind) => kind === 'all' || kind === section;

  return (
    <div className="page">
      <h1 className="page__title">{t('Results for “{query}”', { query })}</h1>
      {query ? (
        <>
          <div className="chips" role="tablist" aria-label={t('Search')} style={{ marginBottom: 24 }}>
            {KINDS.map((option) => (
              <button
                key={option.kind}
                type="button"
                role="tab"
                aria-selected={kind === option.kind}
                className={`chip${kind === option.kind ? ' chip--active' : ''}`}
                onClick={() => setKind(option.kind)}
              >
                {option.label()}
              </button>
            ))}
          </div>
          {shows('movies') ? (
            <>
              <h2 className="row__title" style={{ margin: '0 0 12px' }}>
                {t('Movies')}
              </h2>
              <PagedGrid key={`m-${query}`} section="movies" search={query} sort={BY_TITLE} />
            </>
          ) : null}
          {shows('series') ? (
            <>
              <h2 className="row__title" style={{ margin: kind === 'all' ? '32px 0 12px' : '0 0 12px' }}>
                {t('Series')}
              </h2>
              <PagedGrid key={`s-${query}`} section="series" search={query} sort={BY_TITLE} />
            </>
          ) : null}
          {shows('live') ? <ChannelResults key={`c-${query}`} query={query} alone={kind === 'live'} /> : null}
        </>
      ) : null}
    </div>
  );
}

/** Matching live channels; `alone` (the Live TV filter): says so when there are none. */
function ChannelResults({ query, alone }: { query: string; alone: boolean }) {
  const [channels, setChannels] = useState<LiveChannel[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const needle = query.toLowerCase();
    api.catalog.liveChannels(null).then(
      (all) => !cancelled && setChannels(all.filter((channel) => channel.name.toLowerCase().includes(needle)).slice(0, MAX_CHANNELS)),
      () => !cancelled && setChannels([]),
    );
    return () => {
      cancelled = true;
    };
  }, [query]);

  if (!channels?.length) return alone && channels ? <p className="muted">{t('No channels.')}</p> : null;
  return (
    <>
      <h2 className="row__title" style={{ margin: alone ? '0 0 12px' : '32px 0 12px' }}>
        {t('Live TV')}
      </h2>
      <div className="grid">
        {channels.map((channel) => (
          <PosterCard
            key={channel.id}
            landscape
            title={channel.name}
            posterUrl={channel.logoUrl}
            badge={t('LIVE')}
            onSelect={() =>
              uiStore
                .getState()
                .play({ kind: 'live', streamId: channel.id, container: 'm3u8', title: channel.name, posterUrl: channel.logoUrl })
            }
          />
        ))}
      </div>
    </>
  );
}
