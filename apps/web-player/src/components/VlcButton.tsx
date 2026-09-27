import { appLog, errorMessage, selectActiveProfile, tvPlaybackAttempts, type PlayTarget } from '@iptv/shared';
import { api, stores } from '../appContext';
import { desktop } from '../desktop';
import { useSession } from '../hooks/stores';
import { Icon } from './Icon';

/**
 * Desktop app: "Open in VLC" next to Play (D-081), the TV's "open in another player" (D-057). VLC gets the original
 * file (else HLS) with the provider User-Agent. Not in a browser (it cannot start other programs), not on Kids profiles.
 */
export function VlcButton({ target }: { target: PlayTarget }) {
  const vlc = useVlc();
  if (!vlc) return null;
  const name = target.kind === 'episode' && target.subtitle ? target.subtitle : target.title;
  return (
    <button type="button" className="icon-button" aria-label={`Open ${name} in VLC`} title="Open in VLC" onClick={() => vlc(target)}>
      <Icon name="external" />
    </button>
  );
}

/** Opening a title in VLC, where it can be (the desktop app, not Kids profiles); else null. */
export function useVlc() {
  const kids = useSession((s) => selectActiveProfile(s)?.isKids === true);
  if (!desktop || kids) return null;
  return (target: PlayTarget) =>
    void openInVlc(target).then((message) => {
      if (message) window.alert(message);
    });
}

/** Returns a message for the user when it did not work. */
export async function openInVlc(target: PlayTarget): Promise<string | null> {
  if (!desktop) return null;
  if (stores.session.getState().offline) return 'VLC needs a connection. Downloads only play in this app, because they are encrypted.';
  const [step] = tvPlaybackAttempts(target.kind, target.container);
  if (!step) return 'This title cannot be played.';
  try {
    const { url } = await api.playback.get(target.kind, target.streamId, step.container);
    const title = target.kind === 'episode' && target.subtitle ? `${target.title} · ${target.subtitle}` : target.title;
    const result = await desktop.openInVlc(url, title);
    appLog.info('player', `VLC (${result}): ${target.kind} ${target.streamId}`);
    return result === 'none' ? 'VLC is not installed. Install it from videolan.org and try again.' : null;
  } catch (error) {
    appLog.warn('player', `VLC failed: ${errorMessage(error)}`);
    return 'The stream could not be opened in VLC.';
  }
}
