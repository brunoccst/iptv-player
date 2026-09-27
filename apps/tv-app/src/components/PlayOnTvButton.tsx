import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useAppStore, type PlayTarget } from '@iptv/shared';
import { pairedTv, playOnTv } from '../pairing/remote';
import { IconButton } from './IconButton';

/** Phones with a paired TV (D-060): the TV's name and starting the title there (D-061). Null elsewhere. */
export function usePlayOnTv(target: PlayTarget | null) {
  const tv = useAppStore(pairedTv, (s) => s.tv);
  const [busy, setBusy] = useState(false);
  if (Platform.isTV || !tv || !target) return null;
  const name = target.kind === 'episode' && target.subtitle ? target.subtitle : target.title;
  return {
    tvName: tv.tvName,
    label: `Play ${name} on ${tv.tvName}`,
    play: () => {
      if (busy) return;
      setBusy(true);
      playOnTv(target)
        .then((message) => Alert.alert('Play on TV', message))
        .catch((error: unknown) => Alert.alert('Play on TV', error instanceof Error ? error.message : String(error)))
        .finally(() => setBusy(false));
    },
  };
}

/** Round button that starts the title on the paired TV instead. */
export function PlayOnTvButton({ target, testID }: { target: PlayTarget | null; testID?: string }) {
  const playOnTv = usePlayOnTv(target);
  if (!playOnTv) return null;
  return <IconButton icon="tv" label={playOnTv.label} testID={testID} onPress={playOnTv.play} />;
}
