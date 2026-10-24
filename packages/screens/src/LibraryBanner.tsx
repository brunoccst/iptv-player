import { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { describeLibraryProgress, t } from '@iptv/shared';
import { useScreenHost } from './host';
import { FocusButton } from './ui/FocusButton';
import { IconButton } from './ui/IconButton';
import { colors, fonts, radius, useSizes } from './ui/theme';

const web = Platform.OS === 'web';
// The desktop's window scrolls: the banner stays at the bottom of the window, not of the page.
const floating = (web ? { position: 'fixed' } : { position: 'absolute' }) as unknown as ViewStyle;
const role = web ? { role: 'status' as const } : { accessibilityRole: 'alert' as const };

/**
 * The offline notice or "organizing your library" with per-kind progress, floating at the bottom of Home and the
 * Movies/Series pages (D-119), the same on every app (issue #237, DECISIONS.md#d-215). The app watches the library and
 * says whether it is `processing`. `onRefresh`: the desktop also says when the library is empty, with Refresh library.
 */
export function LibraryBanner({ processing, onRefresh }: { processing: boolean; onRefresh?: (() => void) | null }) {
  const { hooks } = useScreenHost();
  const offline = hooks.useSession((s) => s.offline);
  const progress = describeLibraryProgress(hooks.useLibrary((s) => s.status.data));
  const { gutter } = useSizes();
  if (!offline && !processing && !onRefresh) return null;
  return (
    <View
      style={[styles.banner, floating, { left: gutter, right: gutter }]}
      testID="library-processing"
      pointerEvents={onRefresh && !offline && !processing ? 'box-none' : 'none'}
      {...role}
    >
      {offline ? (
        <Text style={styles.text}>{t("You're offline. Downloaded titles are available in My Downloads.")}</Text>
      ) : processing ? (
        <>
          <View style={styles.line}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.text}>{t('Organizing your library: grouping duplicate titles and versions…')}</Text>
          </View>
          {progress.map((line) => (
            <Text key={line} style={styles.detail}>
              {line}
            </Text>
          ))}
        </>
      ) : (
        <View style={styles.line}>
          <Text style={styles.text}>{t('Your library is empty. Is the title normalizer worker running?')}</Text>
          <FocusButton label={t('Refresh library')} onPress={onRefresh!} />
        </View>
      )}
    </View>
  );
}

/** How long the result of a refresh stays on screen. */
export const NOTICE_MS = 8000;

/**
 * After a "Refresh library" the user started: what it did, e.g. "Your library is up to date: nothing new from your
 * provider." (D-119). On every screen, for a few seconds; the desktop also has a Close button.
 */
export function LibraryNotice() {
  const { hooks, stores } = useScreenHost();
  const notice = hooks.useLibrary((s) => s.refreshNotice);
  const { gutter } = useSizes();
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => stores.library.getState().dismissRefreshNotice(), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice, stores]);
  if (!notice) return null;
  return (
    <View
      style={[styles.banner, styles.notice, floating, { left: gutter, right: gutter }]}
      testID="library-notice"
      pointerEvents={web ? 'box-none' : 'none'}
      {...role}
    >
      <Text style={styles.text}>{notice}</Text>
      {web ? <IconButton icon="close" label={t('Close')} onPress={() => stores.library.getState().dismissRefreshNotice()} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
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
  notice: { flexDirection: 'row', alignItems: 'center', gap: 12, zIndex: 60 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { color: colors.text, fontSize: 14.4, flexShrink: 1 },
  detail: { color: colors.muted, fontSize: fonts.small, marginLeft: 32 },
});
