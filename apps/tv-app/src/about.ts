import { Platform } from 'react-native';
import { intlLocale, t } from '@iptv/shared';
import { TvMedia } from '../modules/tv-media';
import { updater } from './appContext';
import { buildInfo, updateRepo } from './config';
import { versionLabel } from './update/updates';

const installedVersion = () => {
  try {
    return TvMedia.installedVersion();
  } catch {
    return null;
  }
};

const ffmpegAudio = () => {
  try {
    return TvMedia.ffmpegAudioAvailable();
  } catch {
    return false;
  }
};

/**
 * The TV and phone app's About (shared dialog, DECISIONS.md#d-206): the installed version (MAJOR.MINOR.PATCH and the
 * build number, D-070), the commit and date it was built from, whether the FFmpeg audio decoders are included, and
 * Android's version. Checking for updates opens the update prompt where builds come from GitHub.
 */
export const about = {
  rows: (): [string, string][] => [
    [t('Version'), versionLabel(installedVersion())],
    [t('Built from'), buildInfo.commit ? buildInfo.commit.slice(0, 7) : t('a local build')],
    ...(buildInfo.date ? ([[t('Built on'), new Date(buildInfo.date).toLocaleString(intlLocale())]] as [string, string][]) : []),
    [t('Dolby / DTS audio (FFmpeg)'), ffmpegAudio() ? t('included') : t('not included')],
    ['Android', String(Platform.Version)],
  ],
  checkForUpdates: updateRepo
    ? () => {
        updater.open();
        void updater.check();
      }
    : undefined,
};
