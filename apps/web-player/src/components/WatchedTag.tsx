import { watchedLabel } from '@iptv/shared';
import { Icon } from './Icon';

/** "Watched" tag (D-081): bottom right of a watched cover, next to the title in details, on watched episodes. Same look as the TV app's. */
export function WatchedTag({ className }: { className?: string }) {
  return (
    <span className={className ? `watched-tag ${className}` : 'watched-tag'} data-testid="watched-tag">
      <Icon name="check" size={12} /> {watchedLabel()}
    </span>
  );
}
