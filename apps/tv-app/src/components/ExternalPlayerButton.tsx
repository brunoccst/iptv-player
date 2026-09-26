import { Alert } from 'react-native';
import { selectActiveProfile, type PlayTarget } from '@iptv/shared';
import { useSession } from '../hooks';
import { openInExternalPlayer } from '../player/externalPlayer';
import { IconButton } from './IconButton';

/** Round button next to Play: opens the title in another video player app (D-057). Not on Kids profiles: that app is outside the app's Kids limits. */
export function ExternalPlayerButton({ target, testID }: { target: PlayTarget; testID?: string }) {
  const kids = useSession((s) => selectActiveProfile(s)?.isKids === true);
  if (kids) return null;
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
