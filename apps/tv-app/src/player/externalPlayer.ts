import { appLog, errorMessage, savePlaybackProgress, tvPlaybackAttempts, type PlayTarget, t } from '@iptv/shared';
import { TvMedia } from '../../modules/tv-media';
import { api, stores } from '../appContext';
import { providerUserAgent } from '../config';

/** The title last handed to another player, waiting for where it stopped (issue #234). */
let opened: PlayTarget | null = null;
let returned: { remove(): void } | null = null;

/** Saves the other player's stop point as the title's progress, like our player does (issue #234). */
export async function externalPlayerReturned(positionMs: number, durationMs: number) {
  const target = opened;
  opened = null;
  if (!target) return;
  appLog.info('player', `external player returned at ${Math.round(positionMs / 1000)} of ${Math.round(durationMs / 1000)} s`);
  // The progress list may not be loaded yet (details opened straight from a Watch Next link): saving needs its profile.
  const profileId = stores.session.getState().activeProfileId;
  if (profileId && stores.progress.getState().profileId !== profileId) await stores.progress.getState().load(profileId);
  savePlaybackProgress(stores.progress, target, positionMs / 1000, durationMs / 1000);
}

/** Where to start: the title's saved progress, unless it was watched to the end. */
function resumeMs(target: PlayTarget): number {
  if (target.startAt !== undefined) return target.startAt * 1000;
  const saved = (stores.progress.getState().items.data ?? []).find((p) => p.kind === target.kind && p.itemId === target.streamId);
  return saved && saved.positionSeconds < saved.durationSeconds * 0.95 ? saved.positionSeconds * 1000 : 0;
}

/**
 * Opens a movie or episode in another installed player (VLC, MX Player, Just Player, …), D-057. Streams the original
 * file (else HLS) with the provider User-Agent, like our player, from the saved progress; where that player stops is
 * saved as progress when it returns (issue #234). Returns a message for the user when it did not work.
 */
export async function openInExternalPlayer(target: PlayTarget): Promise<string | null> {
  if (stores.session.getState().offline)
    return t('External players need a connection. Downloads only play in this app, because they are encrypted.');
  const [step] = tvPlaybackAttempts(target.kind, target.container);
  if (!step) return t('This title cannot be played.');
  try {
    const info = await api.playback.get(target.kind, target.streamId, step.container);
    const hls = step.engine === 'hls' || info.url.includes('.m3u8');
    const title = target.kind === 'episode' && target.subtitle ? `${target.title} · ${target.subtitle}` : target.title;
    returned?.remove();
    returned = TvMedia.addListener('onExternalPlayerResult', ({ positionMs, durationMs }) =>
      externalPlayerReturned(positionMs, durationMs),
    );
    const result = TvMedia.openExternalPlayer(
      info.url,
      hls ? 'application/vnd.apple.mpegurl' : 'video/*',
      title,
      { 'User-Agent': providerUserAgent },
      resumeMs(target),
    );
    opened = result === 'none' ? null : target;
    appLog.info('player', `external player (${result}): ${target.kind} ${target.streamId}`);
    return result === 'none' ? t('No video player app is installed. Install one (e.g. VLC) and try again.') : null;
  } catch (error) {
    appLog.warn('player', `external player failed: ${errorMessage(error)}`);
    return t('The stream could not be opened in another app.');
  }
}
