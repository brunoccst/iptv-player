import { useEffect } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { downloadsStore, navStore } from '../appContext';
import { IconButton } from '../components/IconButton';
import type { TvDownload } from '../downloads/downloadsStore';
import { useDownloads } from '../hooks';
import { colors, fonts, radius, useSizes, useNavHeight } from '../theme';

const formatBytes = (bytes: number) => (bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.round(bytes / 1e6)} MB`);

/** Same as the web "My Downloads": list of downloads with progress bar and round Play/Pause/Resume/Delete buttons. */
export function DownloadsScreen() {
  const records = useDownloads((s) => Object.values(s.records).filter((r) => r.state !== 'removing'));
  const sizes = useSizes();
  const navH = useNavHeight();

  useEffect(() => {
    downloadsStore.getState().refresh();
  }, []);

  return (
    <FlatList
      style={styles.screen}
      testID="downloads-screen"
      removeClippedSubviews={false}
      contentContainerStyle={{ paddingTop: navH + 24, paddingHorizontal: sizes.gutter, paddingBottom: 60, gap: 12 }}
      ListHeaderComponent={
        <>
          <Text style={[styles.title, { fontSize: sizes.pageTitle }]}>My Downloads</Text>
          {records.length === 0 ? <Text style={styles.muted}>Movies and episodes you download appear here.</Text> : null}
        </>
      }
      data={records}
      keyExtractor={(r) => r.id}
      renderItem={({ item, index }) => <DownloadItem record={item} first={index === 0} />}
    />
  );
}

function DownloadItem({ record, first }: { record: TvDownload; first: boolean }) {
  const { pause, resume, remove } = downloadsStore.getState();
  const percent = Math.round(record.progress * 100);
  const title = record.target.title;
  const status = {
    completed: `Downloaded · ${formatBytes(record.bytesDownloaded)}`,
    downloading: `Downloading ${percent}%`,
    queued: 'Waiting…',
    paused: `Paused at ${percent}%`,
    failed: 'Download failed',
    removing: 'Removing…',
    unknown: '',
  }[record.state];

  return (
    <View style={styles.item} accessibilityLabel={title}>
      {record.target.posterUrl ? <Image source={{ uri: record.target.posterUrl }} style={styles.art} /> : <View style={styles.art} />}
      <View style={styles.info}>
        <Text style={styles.name}>{title}</Text>
        {record.target.subtitle ? <Text style={styles.muted}>{record.target.subtitle}</Text> : null}
        <Text style={[record.state === 'failed' ? styles.error : styles.muted, styles.status]}>{status}</Text>
        {record.state !== 'completed' ? (
          <View style={styles.bar}>
            <View style={[styles.barValue, { width: `${percent}%` }]} />
          </View>
        ) : null}
      </View>
      <View style={styles.actions}>
        {record.state === 'completed' ? (
          <IconButton
            icon="play"
            label={`Play ${title}`}
            hasTVPreferredFocus={first}
            testID={`download-play-${record.id}`}
            onPress={() => navStore.getState().push({ name: 'player', target: record.target })}
          />
        ) : record.state === 'downloading' || record.state === 'queued' ? (
          <IconButton icon="pause" label={`Pause ${title}`} hasTVPreferredFocus={first} onPress={() => pause(record.id)} />
        ) : (
          <IconButton icon="download" label={`Resume ${title}`} hasTVPreferredFocus={first} onPress={() => resume(record.id)} />
        )}
        <IconButton icon="trash" label={`Delete ${title}`} onPress={() => remove(record.id)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
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
