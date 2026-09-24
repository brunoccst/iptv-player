import { useEffect, useState } from 'react';
import type { LiveChannel } from '@iptv/shared';
import { api, uiStore } from '../../appContext';
import { PosterCard } from '../../components/PosterCard';
import { useUi } from '../../hooks/stores';
import { PagedGrid } from './BrowsePage';

const DEBOUNCE_MS = 300;
const MAX_CHANNELS = 30;

/** Searches movies and series (title or normalized key) and live channels by name; same as the TV app. */
export function SearchPage() {
  const search = useUi((s) => s.search);
  const [query, setQuery] = useState(search.trim());

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className="page">
      <h1 className="page__title">Results for “{query}”</h1>
      {query ? (
        <>
          <h2 className="row__title" style={{ margin: '0 0 12px' }}>
            Movies
          </h2>
          <PagedGrid key={`m-${query}`} section="movies" search={query} />
          <h2 className="row__title" style={{ margin: '32px 0 12px' }}>
            Series
          </h2>
          <PagedGrid key={`s-${query}`} section="series" search={query} />
          <ChannelResults key={`c-${query}`} query={query} />
        </>
      ) : null}
    </div>
  );
}

function ChannelResults({ query }: { query: string }) {
  const [channels, setChannels] = useState<LiveChannel[]>([]);

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

  if (channels.length === 0) return null;
  return (
    <>
      <h2 className="row__title" style={{ margin: '32px 0 12px' }}>
        Live TV
      </h2>
      <div className="grid">
        {channels.map((channel) => (
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
      </div>
    </>
  );
}
