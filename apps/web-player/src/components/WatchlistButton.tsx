import { isOnWatchlist, type LibrarySection, type MasterCard } from '@iptv/shared';
import { stores } from '../appContext';
import { useWatchlist } from '../hooks/stores';
import { Icon } from './Icon';

/** Round "My List" toggle on the details panel (D-055): plus to add, check when saved. */
export function WatchlistButton({
  section,
  title,
}: {
  section: LibrarySection;
  title: Pick<MasterCard, 'id' | 'title' | 'year' | 'posterUrl'>;
}) {
  const saved = useWatchlist((s) => isOnWatchlist(s, section, title.id));
  return (
    <button
      type="button"
      className="icon-button"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${title.title} from My List` : `Add ${title.title} to My List`}
      title={saved ? 'Remove from My List' : 'Add to My List'}
      onClick={() => void stores.watchlist.getState().toggle(section, title)}
    >
      <Icon name={saved ? 'check' : 'plus'} size={20} />
    </button>
  );
}
