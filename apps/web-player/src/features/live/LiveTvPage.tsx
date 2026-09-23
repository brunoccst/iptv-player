import { useEffect, useState } from 'react';
import { ALL_CATEGORIES_KEY } from '@iptv/shared';
import { stores, uiStore } from '../../appContext';
import { Spinner } from '../../components/Spinner';
import { useCatalog } from '../../hooks/stores';
import { errorText } from '../../ui/errorText';

/** Live channels by category. EPG grid arrives in Step 7. */
export function LiveTvPage() {
  const categories = useCatalog((s) => s.categories.live?.data ?? []);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const resource = useCatalog((s) => s.liveChannels[categoryId ?? ALL_CATEGORIES_KEY]);

  useEffect(() => {
    void stores.catalog.getState().loadCategories('live');
  }, []);
  useEffect(() => {
    void stores.catalog.getState().loadLiveChannels(categoryId);
  }, [categoryId]);

  return (
    <div className="page">
      <h1 className="page__title">Live TV</h1>
      <div className="live">
        <nav className="live__categories" aria-label="Channel categories">
          <button type="button" className={`live__category${categoryId === null ? ' live__category--active' : ''}`} onClick={() => setCategoryId(null)}>
            All channels
          </button>
          {categories.map((category) => (
            <button key={category.id} type="button" className={`live__category${categoryId === category.id ? ' live__category--active' : ''}`}
              onClick={() => setCategoryId(category.id)}>
              {category.name}
            </button>
          ))}
        </nav>
        <div>
          {resource?.status === 'error' ? <p className="error-text" role="alert">{errorText(resource.error)}</p> : null}
          {resource?.status === 'loading' && !resource.data ? <Spinner /> : null}
          <div className="channel-grid">
            {(resource?.data ?? []).map((channel) => (
              <button key={channel.id} type="button" className="channel"
                onClick={() => uiStore.getState().play({ kind: 'live', streamId: channel.id, container: 'm3u8', title: channel.name, posterUrl: channel.logoUrl })}>
                {channel.logoUrl ? <img src={channel.logoUrl} alt="" loading="lazy" /> : <span />}
                <span>
                  {channel.number != null ? <span className="muted">{channel.number} · </span> : null}
                  {channel.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
