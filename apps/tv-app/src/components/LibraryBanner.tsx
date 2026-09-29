import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { describeLibraryProgress, t } from '@iptv/shared';
import { stores } from '../appContext';
import { useLibrary, useSession } from '../hooks';
import { colors, fonts, radius, useSizes } from '../theme';

/**
 * Web `.banner`: offline notice or "organizing your library" with per-kind progress (direct mode). Floats at the bottom
 * of Home and the Movies/Series pages, so an empty page while the library is organized explains itself.
 */
export function LibraryBanner({ processing }: { processing: boolean }) {
  const offline = useSession((s) => s.offline);
  const progress = describeLibraryProgress(useLibrary((s) => s.status.data));
  const { gutter } = useSizes();
  if (!offline && !processing) return null;
  return (
    <View
      style={[styles.banner, { left: gutter, right: gutter }]}
      testID="library-processing"
      accessibilityRole="alert"
      pointerEvents="none"
    >
      {offline ? (
        <Text style={styles.bannerText}>{t("You're offline. Downloaded titles are available in My Downloads.")}</Text>
      ) : (
        <>
          <View style={styles.bannerLine}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.bannerText}>{t('Organizing your library: grouping duplicate titles and versions…')}</Text>
          </View>
          {progress.map((line) => (
            <Text key={line} style={styles.bannerDetail}>
              {line}
            </Text>
          ))}
        </>
      )}
    </View>
  );
}

/** How long the result of a refresh stays on screen. */
export const NOTICE_MS = 8000;

/**
 * After a "Refresh library" the user started: what it did, e.g. "Your library is up to date: nothing new from your
 * provider." (D-119). On every screen, for a few seconds.
 */
export function LibraryNotice() {
  const notice = useLibrary((s) => s.refreshNotice);
  const { gutter } = useSizes();
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => stores.library.getState().dismissRefreshNotice(), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);
  if (!notice) return null;
  return (
    <View style={[styles.banner, { left: gutter, right: gutter }]} testID="library-notice" accessibilityRole="alert" pointerEvents="none">
      <Text style={styles.bannerText}>{notice}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    bottom: 16,
    zIndex: 50,
    elevation: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(20,20,20,0.95)',
    gap: 4,
  },
  bannerLine: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bannerText: { color: colors.text, fontSize: 14.4, flexShrink: 1 },
  bannerDetail: { color: colors.muted, fontSize: fonts.small, marginLeft: 32 },
});
