import { useRef } from 'react';
import { t } from '@iptv/shared';
import { IconButton } from './IconButton';

/**
 * Round "Watched" toggle on the details panel (D-104), next to My List: an open eye when watched, a closed one when
 * not. For a series it marks every episode. Presses while a change is still being saved are ignored.
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
    <IconButton
      icon={watched ? 'eye' : 'eyeOff'}
      label={label}
      testID="details-watched-toggle"
      onPress={() => {
        if (busy.current) return;
        busy.current = true;
        void onChange(!watched).finally(() => (busy.current = false));
      }}
    />
  );
}
