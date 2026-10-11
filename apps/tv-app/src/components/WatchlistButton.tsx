import type { LibrarySection, MasterCard } from '@iptv/shared';
import { useWatchlistToggle } from '../hooks';
import { IconButton } from './IconButton';
import { useKeepFocusAfterPress } from './keepFocus';
import { useColourPageTitle } from '../tv/colourKeys';

/** Web `WatchlistButton`: round "My List" toggle on the details panel (D-055; logic shared, D-124). */
export function WatchlistButton({
  section,
  title,
}: {
  section: LibrarySection;
  title: Pick<MasterCard, 'id' | 'title' | 'year' | 'posterUrl'>;
}) {
  const { icon, label, toggle } = useWatchlistToggle(section, title);
  // The remote's Red key presses it too, while no card has the focus (D-154).
  useColourPageTitle({ section, card: title });
  // TV: the focus stays on it after a press; My List behind the panel used to take it (D-170).
  const keep = useKeepFocusAfterPress();
  return (
    <IconButton
      icon={icon}
      label={label}
      testID="details-mylist"
      onPress={() => {
        keep.pressed();
        toggle();
      }}
      colourKey="red"
      focusRef={keep.focusRef}
      onBlur={keep.onBlur}
    />
  );
}
