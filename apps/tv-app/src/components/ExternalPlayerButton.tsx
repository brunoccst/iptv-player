import { Alert } from 'react-native';
import { selectActiveProfile, type PlayTarget } from '@iptv/shared';
import { useSession } from '../hooks';
import { openInExternalPlayer } from '../player/externalPlayer';
import { IconButton } from './IconButton';

/** Opening the title in another video player app (D-057). Null on Kids profiles: that app is outside the app's Kids limits. */
export function useExternalPlayer(target: PlayTarget) {
  const kids = useSession((s) => selectActiveProfile(s)?.isKids === true);
  if (kids) return null;
  const name = target.kind === 'episode' && target.subtitle ? target.subtitle : target.title;
  return {
    label: `Open ${name} in another player`,
    open: () =>
      void openInExternalPlayer(target).then((message) => {
        if (message) Alert.alert('Open in another player', message);
      }),
  };
}

/** Round button next to Play: opens the title in another video player app. */
export function ExternalPlayerButton({ target, testID }: { target: PlayTarget; testID?: string }) {
  const external = useExternalPlayer(target);
  if (!external) return null;
  return <IconButton icon="external" label={external.label} testID={testID} onPress={external.open} />;
}
