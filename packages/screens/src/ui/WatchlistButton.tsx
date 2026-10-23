import type { LibrarySection, MasterCard } from '@iptv/shared';
import { useScreenHost } from '../host';
import { IconButton } from './IconButton';

/** Round "My List" toggle on the details panel (D-055): a bookmark, outlined to add, filled when saved (issue #157). */
export function WatchlistButton({
  section,
  title,
}: {
  section: LibrarySection;
  title: Pick<MasterCard, 'id' | 'title' | 'year' | 'posterUrl'>;
}) {
  const host = useScreenHost();
  const { icon, label, toggle } = host.hooks.useWatchlistToggle(section, title);
  // TV: the remote's Red key presses it too, while no card has the focus (D-154).
  host.details.usePageTitle?.(section, title);
  return (
    <IconButton
      icon={icon}
      label={label}
      testID="details-mylist"
      onPress={toggle}
      colourKey={host.details.usePageTitle ? 'red' : undefined}
    />
  );
}
