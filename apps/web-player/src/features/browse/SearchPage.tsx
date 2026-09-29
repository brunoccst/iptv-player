import { useState } from 'react';
import { SEARCH_BY_TITLE, SEARCH_KINDS, type SearchKind, useSearchQuery } from '@iptv/shared';
import { uiStore } from '../../appContext';
import { PosterCard } from '../../components/PosterCard';
import { useChannelSearch, useUi } from '../../hooks/stores';
import { PagedGrid } from './BrowsePage';
import { t } from '@iptv/shared';

/** Searches movies and series (title or normalized key) and live channels by name; same as the TV app. */
export function SearchPage() {
  const search = useUi((s) => s.search);
  // Waits until typing pauses, adapted to the typing speed; the same as the TV app (D-124).
  const query = useSearchQuery(search);

  const [kind, setKind] = useState<SearchKind>('all');
  const shows = (section: SearchKind) => kind === 'all' || kind === section;

  return (
    <div className="page">
      <h1 className="page__title">{t('Results for “{query}”', { query })}</h1>
      {query ? (
        <>
          <div className="chips" role="tablist" aria-label={t('Search')} style={{ marginBottom: 24 }}>
            {SEARCH_KINDS.map((option) => (
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
              <PagedGrid key={`m-${query}`} section="movies" search={query} sort={SEARCH_BY_TITLE} />
            </>
          ) : null}
          {shows('series') ? (
            <>
              <h2 className="row__title" style={{ margin: kind === 'all' ? '32px 0 12px' : '0 0 12px' }}>
                {t('Series')}
              </h2>
              <PagedGrid key={`s-${query}`} section="series" search={query} sort={SEARCH_BY_TITLE} />
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
  const channels = useChannelSearch(query);

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
