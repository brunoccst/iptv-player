import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useAppStore, type PlayTarget } from '@iptv/shared';
import { pairedTv, playOnTv } from '../pairing/remote';
import { IconButton } from './IconButton';

/** Phones with a paired TV (D-060): round button that starts the title on the TV instead (D-061). */
export function PlayOnTvButton({ target, testID }: { target: PlayTarget | null; testID?: string }) {
  const tv = useAppStore(pairedTv, (s) => s.tv);
  const [busy, setBusy] = useState(false);
  if (Platform.isTV || !tv || !target) return null;
  const name = target.kind === 'episode' && target.subtitle ? target.subtitle : target.title;
  return (
    <IconButton
      icon="tv"
      label={`Play ${name} on ${tv.tvName}`}
      testID={testID}
      onPress={() => {
        if (busy) return;
        setBusy(true);
        playOnTv(target)
          .then((message) => Alert.alert('Play on TV', message))
          .catch((error: unknown) => Alert.alert('Play on TV', error instanceof Error ? error.message : String(error)))
          .finally(() => setBusy(false));
      }}
    />
  );
}
