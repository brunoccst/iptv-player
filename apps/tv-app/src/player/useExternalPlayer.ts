import { Alert } from 'react-native';
import { selectActiveProfile, type PlayTarget, t } from '@iptv/shared';
import { useSession } from '../hooks';
import { openInExternalPlayer } from './externalPlayer';

/** Opening the title in another video player app (D-057). Null on Kids profiles: that app is outside the app's Kids limits. */
export function useExternalPlayer(target: PlayTarget) {
  const kids = useSession((s) => selectActiveProfile(s)?.isKids === true);
  if (kids) return null;
  const name = target.kind === 'episode' && target.subtitle ? target.subtitle : target.title;
  return {
    kind: 'app' as const,
    label: t('Open {title} in another player', { title: name }),
    open: () =>
      void openInExternalPlayer(target).then((message) => {
        if (message) Alert.alert(t('Open in another player'), message);
      }),
  };
}
