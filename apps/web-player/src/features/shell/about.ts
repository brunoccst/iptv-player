import { intlLocale, t } from '@iptv/shared';
import { buildInfo } from '../../buildInfo';
import { desktop } from '../../desktop';

/**
 * The desktop's About (shared dialog, DECISIONS.md#d-206): which app this is, its version, and the commit and date it
 * was built from (D-070, D-079). Checking for updates only in the desktop app.
 */
export const about = {
  rows: (): [string, string][] => [
    [t('App'), desktop ? t('Desktop app for {platform}', { platform: desktop.platform }) : t('Development build (browser)')],
    ...(desktop ? ([[t('Version'), desktop.version]] as [string, string][]) : []),
    [t('Built from'), buildInfo.commit ? buildInfo.commit.slice(0, 7) : t('a local build')],
    ...(buildInfo.date ? ([[t('Built on'), new Date(buildInfo.date).toLocaleString(intlLocale())]] as [string, string][]) : []),
  ],
  checkForUpdates: desktop ? () => void desktop?.checkForUpdates() : undefined,
};
