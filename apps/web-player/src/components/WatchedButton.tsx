import { useWatchedToggle } from '@iptv/shared';
import { Icon } from './Icon';

/** Round "Watched" toggle on the details panel (D-104), next to My List; logic shared with the TV app (D-124). */
export function WatchedButton({
  kind,
  watched,
  onChange,
  testID = 'details-watched-toggle',
}: {
  kind: 'movie' | 'series' | 'season';
  watched: boolean;
  onChange(watched: boolean): Promise<void>;
  testID?: string;
}) {
  const { icon, label, toggle } = useWatchedToggle(kind, watched, onChange);
  return (
    <button
      type="button"
      className="icon-button"
      aria-pressed={watched}
      aria-label={label}
      title={label}
      data-testid={testID}
      onClick={toggle}
    >
      <Icon name={icon} size={20} />
    </button>
  );
}
