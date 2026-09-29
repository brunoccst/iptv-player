// @ts-check
const { withAndroidManifest } = require('expo/config-plugins');

/**
 * `android:largeHeap="true"`: TVs with 1–1.5 GB of RAM give an app a 192 MB Java heap by default, which a big catalog
 * nearly filled (issue #109). The library itself is read and saved in pieces (D-113); this is headroom on top.
 * @type {import('expo/config-plugins').ConfigPlugin}
 */
const withLargeHeap = (config) =>
  withAndroidManifest(config, (manifest) => {
    const application = manifest.modResults.manifest.application?.[0];
    if (!application) throw new Error('withLargeHeap: AndroidManifest.xml has no <application>');
    application.$['android:largeHeap'] = 'true';
    return manifest;
  });

module.exports = withLargeHeap;
