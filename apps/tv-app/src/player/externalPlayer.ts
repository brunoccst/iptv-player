import { appLog, errorMessage, tvPlaybackAttempts, type PlayTarget } from '@iptv/shared';
import { TvMedia } from '../../modules/tv-media';
import { api, stores } from '../appContext';
import { providerUserAgent } from '../config';

/**
 * Opens a movie or episode in another installed player (VLC, MX Player, Just Player, …), D-057. Streams the original
 * file (else HLS) with the provider User-Agent, like our player. Returns a message for the user when it did not work.
 */
export async function openInExternalPlayer(target: PlayTarget): Promise<string | null> {
  if (stores.session.getState().offline)
    return 'External players need a connection. Downloads only play in this app, because they are encrypted.';
  const [step] = tvPlaybackAttempts(target.kind, target.container);
  if (!step) return 'This title cannot be played.';
  try {
    const info = await api.playback.get(target.kind, target.streamId, step.container);
    const hls = step.engine === 'hls' || info.url.includes('.m3u8');
    const title = target.kind === 'episode' && target.subtitle ? `${target.title} · ${target.subtitle}` : target.title;
    const result = TvMedia.openExternalPlayer(info.url, hls ? 'application/vnd.apple.mpegurl' : 'video/*', title, {
      'User-Agent': providerUserAgent,
    });
    appLog.info('player', `external player (${result}): ${target.kind} ${target.streamId}`);
    return result === 'none' ? 'No video player app is installed. Install one (e.g. VLC) and try again.' : null;
  } catch (error) {
    appLog.warn('player', `external player failed: ${errorMessage(error)}`);
    return 'The stream could not be opened in another app.';
  }
}
