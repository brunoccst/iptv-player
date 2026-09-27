import { t } from '@iptv/shared';

/**
 * The desktop app's own texts (its update dialogs, apps/desktop/main.mjs) in the app's language, keyed by their English
 * text (D-084). The page sends them to the main process whenever the language changes.
 */
export const desktopTexts = (): Record<string, string> => ({
  'App update': t('App update'),
  'This build does not check for updates.': t('This build does not check for updates.'),
  'You have the newest version ({version}).': t('You have the newest version ({version}).'),
  'Version {version} is available (you have {current}).': t('Version {version} is available (you have {current}).'),
  'The app downloads it and restarts with the new version. Your data stays.': t(
    'The app downloads it and restarts with the new version. Your data stays.',
  ),
  'The download page opens in your browser. Install the new version over this one; your data stays.': t(
    'The download page opens in your browser. Install the new version over this one; your data stays.',
  ),
  'Install now': t('Install now'),
  Download: t('Download'),
  Later: t('Later'),
  'The update did not work.': t('The update did not work.'),
  'You can download the new version from the release page instead.': t('You can download the new version from the release page instead.'),
  'Open the download page': t('Open the download page'),
  Close: t('Close'),
  'Version {version} is ready.': t('Version {version} is ready.'),
  'The app closes, installs it in the same folder and opens again.': t('The app closes, installs it in the same folder and opens again.'),
  'Restart now': t('Restart now'),
  'When I close the app': t('When I close the app'),
});
