import { useWatchedToggle } from '@iptv/shared';
import { IconButton } from './IconButton';

/** Round "Watched" toggle on the details panel (D-104), next to My List; logic shared with the web app (D-124). */
export function WatchedButton({
  kind,
  watched,
  onChange,
}: {
  kind: 'movie' | 'series';
  watched: boolean;
  onChange(watched: boolean): Promise<void>;
}) {
  const { icon, label, toggle } = useWatchedToggle(kind, watched, onChange);
  return <IconButton icon={icon} label={label} testID="details-watched-toggle" onPress={toggle} />;
}
