import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { formatBytes, formatOfflineDate, t } from '@iptv/shared';
import { useScreenHost, type DownloadEntry } from './host';
import { FocusRow } from './ui/FocusRow';
import { IconButton } from './ui/IconButton';
import { colors, fonts, radius, useSizes } from './ui/theme';

/**
 * My Downloads (DECISIONS.md#d-198): each download with its progress and round Play / Pause / Resume / Delete buttons.
 * One screen for TV, phone and desktop. Play is hidden while downloads are blocked (subscription expired or no online
 * check for 30 days, D-050).
 */
export function DownloadsScreen() {
  const { hooks, useDownloads, Page } = useScreenHost();
  const { entries, notes } = useDownloads();
  const access = hooks.useOfflineAccess();
  const sizes = useSizes();

  return (
    <Page testID="downloads-screen">
      <View style={[styles.content, { paddingHorizontal: sizes.gutter }]}>
        <Text accessibilityRole="header" style={[styles.title, { fontSize: sizes.pageTitle }]}>
          {t('My Downloads')}
        </Text>
        {notes.map((note) => (
          <Text key={note} style={styles.muted}>
            {note}
          </Text>
        ))}
        {entries.length === 0 ? <Text style={styles.muted}>{t('Movies and episodes you download appear here.')}</Text> : null}
        {entries.length === 0 ? null : !access.allowed ? (
          <Text testID="downloads-access" role="status" style={styles.error}>
            {access.message}
          </Text>
        ) : access.recheckBy ? (
          <Text testID="downloads-access" style={styles.muted}>
            {t('Downloads play offline until {offlineDate}; opening the app online extends this.', {
              offlineDate: formatOfflineDate(access.recheckBy),
            })}
          </Text>
        ) : null}
        {entries.map((entry, index) => (
          <DownloadItem key={entry.id} entry={entry} first={index === 0} playable={access.allowed} />
        ))}
      </View>
    </Page>
  );
}

function DownloadItem({ entry, first, playable }: { entry: DownloadEntry; first: boolean; playable: boolean }) {
  const percent = Math.round(entry.progress * 100);
  const { title } = entry;
  const [poster, setPoster] = useState(entry.posterUrl ?? entry.posterFallback ?? null);
  const status = {
    completed: t('Downloaded · {size}', { size: formatBytes(entry.bytesDownloaded) }),
    downloading: t('Downloading {percent}%', { percent }),
    queued: t('Waiting…'),
    paused: t('Paused {percent}%', { percent }),
    failed: entry.error ?? t('Download failed'),
    unknown: '',
  }[entry.state];

  return (
    <View style={styles.item} role="article" accessibilityLabel={title} testID={`download-${entry.id}`}>
      {poster ? (
        <Image
          source={{ uri: poster }}
          style={styles.art}
          onError={() => setPoster((now) => (now !== entry.posterFallback ? (entry.posterFallback ?? null) : null))}
        />
      ) : (
        <View style={styles.art} />
      )}
      <View style={styles.info}>
        <Text style={styles.name}>{title}</Text>
        {entry.subtitle ? <Text style={styles.muted}>{entry.subtitle}</Text> : null}
        <Text style={[entry.state === 'failed' ? styles.error : styles.muted, styles.status]}>{status}</Text>
        {entry.state !== 'completed' ? (
          <View style={styles.bar}>
            <View style={[styles.barValue, { width: `${percent}%` }]} />
          </View>
        ) : null}
      </View>
      <FocusRow style={styles.actions}>
        {entry.state === 'completed' ? (
          playable ? (
            <IconButton
              icon="play"
              label={t('Play {title}', { title })}
              hasTVPreferredFocus={first}
              testID={`download-play-${entry.id}`}
              onPress={entry.play}
            />
          ) : null
        ) : entry.state === 'downloading' || entry.state === 'queued' ? (
          <IconButton icon="pause" label={t('Pause {title}', { title })} hasTVPreferredFocus={first} onPress={entry.pause} />
        ) : (
          <IconButton icon="download" label={t('Resume {title}', { title })} hasTVPreferredFocus={first} onPress={entry.resume} />
        )}
        <IconButton icon="trash" label={t('Delete {title}', { title })} onPress={entry.remove} />
      </FocusRow>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12 },
  title: { color: colors.strong, fontWeight: '700', marginBottom: 20 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 12, borderRadius: radius, backgroundColor: colors.surface },
  art: { width: 90, aspectRatio: 2 / 3, borderRadius: radius, backgroundColor: '#333' },
  info: { flex: 1 },
  name: { color: colors.strong, fontSize: fonts.body, fontWeight: '700', marginBottom: 4 },
  status: { marginTop: 6 },
  bar: { height: 4, marginTop: 8, backgroundColor: 'rgba(255,255,255,0.2)' },
  barValue: { height: 4, backgroundColor: colors.accent },
  muted: { color: colors.muted, fontSize: fonts.body },
  error: { color: colors.warning, fontSize: 14.4 },
  actions: { flexDirection: 'row', gap: 8 },
});
