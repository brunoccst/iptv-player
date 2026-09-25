import { watchlistCard } from '@iptv/shared';
import { Spinner } from '../../components/Spinner';
import { useWatchlist } from '../../hooks/stores';
import { MasterCard } from '../home/MasterCard';

/** "My List": titles the active profile saved, newest first (D-055). */
export function MyListPage() {
  const items = useWatchlist((s) => s.items);
  return (
    <div className="page">
      <h1 className="page__title">My List</h1>
      {items.status === 'loading' && !items.data ? (
        <Spinner />
      ) : !items.data?.length ? (
        <p className="muted">Add movies and series with the + button on their details to watch them later.</p>
      ) : (
        <div className="grid">
          {items.data.map((item) => (
            <MasterCard key={`${item.section}-${item.masterId}`} section={item.section} item={watchlistCard(item)} />
          ))}
        </div>
      )}
    </div>
  );
}
