import { t } from '@iptv/shared';

/**
 * The desktop app's own texts (its update dialogs, apps/desktop/app.mjs and rescue.mjs) in the app's language, keyed by their English
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
  // The rescue window when the app cannot start (D-251), and the conversion that needs FFmpeg.
  'The app could not start': t('The app could not start'),
  'Something went wrong while starting. Your data is safe. A newer version may fix it.': t(
    'Something went wrong while starting. Your data is safe. A newer version may fix it.',
  ),
  'Update now': t('Update now'),
  'Download from GitHub': t('Download from GitHub'),
  'Checking for an update…': t('Checking for an update…'),
  'Version {version} is available. It may fix this.': t('Version {version} is available. It may fix this.'),
  'No newer version is available yet. Check the download page later.': t(
    'No newer version is available yet. Check the download page later.',
  ),
  'Could not check for an update. Try the download page.': t('Could not check for an update. Try the download page.'),
  'Update from the download page: install the newest version over this one. Your data stays.': t(
    'Update from the download page: install the newest version over this one. Your data stays.',
  ),
  'Downloading… {percent}%': t('Downloading… {percent}%'),
  'Installing the update. The app opens again by itself.': t('Installing the update. The app opens again by itself.'),
  'Video conversion is not available in this installation. Update the app to fix it.': t(
    'Video conversion is not available in this installation. Update the app to fix it.',
  ),
  // The tray icon while downloads go on with the window closed (issue #219).
  'Downloading in the background': t('Downloading in the background'),
  // …and with "Start with the computer" on (issue #309).
  'Running in the background': t('Running in the background'),
  Open: t('Open'),
  Quit: t('Quit'),
});
