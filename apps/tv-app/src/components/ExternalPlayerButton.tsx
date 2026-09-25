import { Alert } from 'react-native';
import type { PlayTarget } from '@iptv/shared';
import { openInExternalPlayer } from '../player/externalPlayer';
import { IconButton } from './IconButton';

/** Round button next to Play: opens the title in another video player app (D-057). */
export function ExternalPlayerButton({ target, testID }: { target: PlayTarget; testID?: string }) {
  const name = target.kind === 'episode' && target.subtitle ? target.subtitle : target.title;
  const label = `Open ${name} in another player`;
  return (
    <IconButton
      icon="external"
      label={label}
      testID={testID}
      onPress={() =>
        void openInExternalPlayer(target).then((message) => {
          if (message) Alert.alert('Open in another player', message);
        })
      }
    />
  );
}
