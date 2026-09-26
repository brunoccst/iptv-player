// Installers for Windows (NSIS), macOS (DMG, Intel + Apple silicon) and Linux (AppImage, deb). See D-071.
// Names come from build-config.json (scripts/prepare.mjs, from the repo .env); the web player is bundled as "web".
const { appName, appSlug } = require('./build-config.json');

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: `com.${appSlug.replace(/[^a-z0-9]/gi, '').toLowerCase()}.desktop`,
  productName: appName,
  // Linux: lets the desktop link the window to the app's menu entry.
  extraMetadata: { desktopName: `${appSlug}.desktop` },
  directories: { output: 'release', buildResources: 'build' },
  files: ['main.mjs', 'preload.cjs', 'lib/**', 'build-config.json', 'package.json'],
  extraResources: [{ from: '../web-player/dist', to: 'web' }],
  // Fixed file names, so the download links in the README never change.
  win: { target: 'nsis', icon: 'build/icon.png', artifactName: `${appSlug}-setup.\${ext}` },
  // Per user, no administrator rights; shortcuts on the desktop and in the Start menu.
  nsis: { oneClick: true, perMachine: false, createDesktopShortcut: true, createStartMenuShortcut: true },
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
