import type { LibrarySection, MasterCard } from '@iptv/shared';
import { useWatchlistToggle } from '../hooks/stores';
import { Icon } from './Icon';

/** Round "My List" toggle on the details panel (D-055): plus to add, check when saved. Logic shared (D-124). */
export function WatchlistButton({
  section,
  title,
}: {
  section: LibrarySection;
  title: Pick<MasterCard, 'id' | 'title' | 'year' | 'posterUrl'>;
}) {
  const { saved, icon, label, hint, toggle } = useWatchlistToggle(section, title);
  return (
    <button type="button" className="icon-button" aria-pressed={saved} aria-label={label} title={hint} onClick={toggle}>
      <Icon name={icon} size={20} />
    </button>
  );
}
