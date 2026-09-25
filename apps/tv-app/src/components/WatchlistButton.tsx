import { isOnWatchlist, type LibrarySection, type MasterCard } from '@iptv/shared';
import { stores } from '../appContext';
import { useWatchlist } from '../hooks';
import { IconButton } from './IconButton';

/** Web `WatchlistButton`: round "My List" toggle on the details panel (D-055). */
export function WatchlistButton({
  section,
  title,
}: {
  section: LibrarySection;
  title: Pick<MasterCard, 'id' | 'title' | 'year' | 'posterUrl'>;
}) {
  const saved = useWatchlist((s) => isOnWatchlist(s, section, title.id));
  return (
    <IconButton
      icon={saved ? 'check' : 'plus'}
      label={saved ? `Remove ${title.title} from My List` : `Add ${title.title} to My List`}
      testID="details-mylist"
      onPress={() => void stores.watchlist.getState().toggle(section, title)}
    />
  );
}
