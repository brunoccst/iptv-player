// @ts-check
const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Release builds use the key in `ANDROID_KEYSTORE_FILE` when it is set at Gradle time (tv-apk.yml, from repo
 * secrets), so every APK has the same signature and installs over the previous one. Without it: debug key. D-052.
 * @type {import('expo/config-plugins').ConfigPlugin}
 */
const withReleaseSigning = (config) =>
  withAppBuildGradle(config, (gradle) => {
    let contents = gradle.modResults.contents;
    if (contents.includes('ANDROID_KEYSTORE_FILE')) return gradle;
    const debugConfig = /(signingConfigs \{\n\s+debug \{[^}]*\}\n)/;
    const releaseInBuildTypes = /(release \{\n(?:\s*\/\/.*\n)*\s*)signingConfig signingConfigs\.debug/;
    if (!debugConfig.test(contents) || !releaseInBuildTypes.test(contents))
      throw new Error('withReleaseSigning: android/app/build.gradle no longer matches the expected template');
    contents = contents.replace(
      debugConfig,
      `$1        release {
            if (System.getenv('ANDROID_KEYSTORE_FILE')) {
                storeFile file(System.getenv('ANDROID_KEYSTORE_FILE'))
                storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
                keyAlias System.getenv('ANDROID_KEY_ALIAS') ?: 'iptv-player'
                keyPassword System.getenv('ANDROID_KEY_PASSWORD') ?: System.getenv('ANDROID_KEYSTORE_PASSWORD')
            }
        }
`,
    );
    contents = contents.replace(
      releaseInBuildTypes,
      "$1signingConfig System.getenv('ANDROID_KEYSTORE_FILE') ? signingConfigs.release : signingConfigs.debug",
    );
    gradle.modResults.contents = contents;
    return gradle;
  });

module.exports = withReleaseSigning;
