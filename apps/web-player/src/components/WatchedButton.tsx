import { useRef } from 'react';
import { t } from '@iptv/shared';
import { Icon } from './Icon';

/**
 * Round "Watched" toggle on the details panel (D-104), next to My List: an open eye when watched, a closed one when
 * not. For a series it marks every episode. Clicks while a change is still being saved are ignored.
 */
export function WatchedButton({
  kind,
  watched,
  onChange,
}: {
  kind: 'movie' | 'series';
  watched: boolean;
  onChange(watched: boolean): Promise<void>;
}) {
  const busy = useRef(false);
  const label =
    kind === 'series'
      ? watched
        ? t('Mark series as not watched')
        : t('Mark series as watched')
      : watched
        ? t('Mark as not watched')
        : t('Mark as watched');
  return (
    <button
      type="button"
      className="icon-button"
      aria-pressed={watched}
      aria-label={label}
      title={label}
      data-testid="details-watched-toggle"
      onClick={() => {
        if (busy.current) return;
        busy.current = true;
        void onChange(!watched).finally(() => (busy.current = false));
      }}
    >
      <Icon name={watched ? 'eye' : 'eyeOff'} size={20} />
    </button>
  );
}
