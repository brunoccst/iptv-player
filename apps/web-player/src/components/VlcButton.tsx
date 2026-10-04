import {
  appLog,
  errorMessage,
  probeStream,
  selectActiveProfile,
  tvPlaybackAttempts,
  type PlaybackInfoWithAlternates,
  type PlayTarget,
  type StreamProbe,
  t,
} from '@iptv/shared';
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
    <button
      type="button"
      className="icon-button"
      aria-label={t('Open {name} in VLC', { name })}
      title={t('Open in VLC')}
      onClick={() => vlc(target)}
    >
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
  if (stores.session.getState().offline) return t('VLC needs a connection. Downloads only play in this app, because they are encrypted.');
  const [step] = tvPlaybackAttempts(target.kind, target.container);
  if (!step) return t('This title cannot be played.');
  try {
    const playback: PlaybackInfoWithAlternates = await api.playback.get(target.kind, target.streamId, step.container);
    const url = await answeringUrl([playback.url, ...(playback.alternateUrls ?? [])]);
    const title = target.kind === 'episode' && target.subtitle ? `${target.title} · ${target.subtitle}` : target.title;
    const result = await desktop.openInVlc(url, title);
    appLog.info('player', `VLC (${result}): ${target.kind} ${target.streamId}`);
    return result === 'none' ? t('VLC is not installed. Install it from videolan.org and try again.') : null;
  } catch (error) {
    appLog.warn('player', `VLC failed: ${errorMessage(error)}`);
    return t('The stream could not be opened in VLC.');
  }
}

/**
 * VLC gets one address: with a stream server from the login reply (D-038), the first address that answers with a
 * video or playlist, else the portal's. Without one, no extra request.
 */
export async function answeringUrl(urls: string[], probe: (url: string) => Promise<StreamProbe> = probeStream): Promise<string> {
  if (urls.length <= 1) return urls[0]!;
  for (const url of urls) {
    const answer = await probe(url);
    if (looksLikeMedia(answer)) return url;
    appLog.info('player', `VLC: skipping ${new URL(url).host}, HTTP ${answer.status}${answer.error ? ` (${answer.error})` : ''}`);
  }
  return urls[0]!;
}

function looksLikeMedia(probe: StreamProbe): boolean {
  if (probe.error || probe.status < 200 || probe.status >= 300 || probe.length === 0) return false;
  return probe.text === null || probe.text.startsWith('#EXTM3U');
}
