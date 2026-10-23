import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useAppStore, type PlayTarget, t } from '@iptv/shared';
import { pairedTv, playOnTv } from './remote';

/** Phones with a paired TV (D-060): the TV's name and starting the title there (D-061). Null elsewhere. */
export function usePlayOnTv(target: PlayTarget | null) {
  const tv = useAppStore(pairedTv, (s) => s.tv);
  const [busy, setBusy] = useState(false);
  if (Platform.isTV || !tv || !target) return null;
  const name = target.kind === 'episode' && target.subtitle ? target.subtitle : target.title;
  return {
    tvName: tv.tvName,
    label: t('Play {title} on {tv}', { title: name, tv: tv.tvName }),
    play: () => {
      if (busy) return;
      setBusy(true);
      playOnTv(target)
        .then((message) => Alert.alert(t('Play on TV'), message))
        .catch((error: unknown) => Alert.alert(t('Play on TV'), error instanceof Error ? error.message : String(error)))
        .finally(() => setBusy(false));
    },
  };
}
