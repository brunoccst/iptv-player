// Installers for Windows (NSIS), macOS (DMG, Intel + Apple silicon) and Linux (AppImage, deb). See D-071.
// Names come from build-config.json (scripts/prepare.mjs, from the repo .env); the web player is bundled as "web".
const { appName, appSlug, updateRepo } = require('./build-config.json');

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: `com.${appSlug.replace(/[^a-z0-9]/gi, '').toLowerCase()}.desktop`,
  productName: appName,
  // Linux: lets the desktop link the window to the app's menu entry.
  extraMetadata: { desktopName: `${appSlug}.desktop` },
  directories: { output: 'release', buildResources: 'build' },
  files: ['main.mjs', 'preload.cjs', 'lib/**', 'build-config.json', 'package.json'],
  extraResources: [{ from: '../web-player/dist', to: 'web' }],
  // In-app updates (D-073): electron-updater reads latest.yml / latest-linux.yml next to the installers in the
  // `desktop` release. Builds without an update repository (local) get no feed.
  ...(updateRepo ? { publish: { provider: 'generic', url: `https://github.com/${updateRepo}/releases/download/desktop` } } : {}),
  // Fixed file names, so the download links in the README never change.
  win: { target: 'nsis', icon: 'build/icon.png', artifactName: `${appSlug}-setup.\${ext}` },
  // A normal setup wizard (D-072): for this user only (no administrator rights, default %LOCALAPPDATA%\Programs) or
  // for all users (Program Files), then the folder, which may be on any drive. Shortcuts on the desktop and Start menu.
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
  },
  // Size (D-072): only the English Chromium texts (the app's own texts are English; saves ~9 MB) and the
  // strongest installer compression. Chromium itself (~200 MB) is the rest.
  electronLanguages: ['en-US'],
  compression: 'maximum',
  mac: {
    target: { target: 'dmg', arch: ['universal'] },
    category: 'public.app-category.video',
    // No Apple certificate: ad-hoc signed, which Apple silicon needs to start the app at all (D-071).
    identity: '-',
    icon: 'build/icon.png',
    artifactName: `${appSlug}.\${ext}`,
  },
  linux: {
    target: ['AppImage', 'deb'],
    category: 'AudioVideo',
    icon: 'build/icon.png',
    executableName: appSlug,
    maintainer: 'IPTV Player contributors',
    artifactName: `${appSlug}.\${ext}`,
  },
};
