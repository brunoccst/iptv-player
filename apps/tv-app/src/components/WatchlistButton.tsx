import type { LibrarySection, MasterCard } from '@iptv/shared';
import { useWatchlistToggle } from '../hooks';
import { IconButton } from './IconButton';

/** Web `WatchlistButton`: round "My List" toggle on the details panel (D-055; logic shared, D-124). */
export function WatchlistButton({
  section,
  title,
}: {
  section: LibrarySection;
  title: Pick<MasterCard, 'id' | 'title' | 'year' | 'posterUrl'>;
}) {
  const { icon, label, toggle } = useWatchlistToggle(section, title);
  return <IconButton icon={icon} label={label} testID="details-mylist" onPress={toggle} />;
}
