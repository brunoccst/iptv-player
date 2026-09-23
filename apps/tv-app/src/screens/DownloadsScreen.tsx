import { useEffect } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { downloadsStore, navStore } from '../appContext';
import { FocusButton } from '../components/FocusButton';
import { ProgressRing } from '../components/ProgressRing';
import type { TvDownload } from '../downloads/downloadsStore';
import { useDownloads } from '../hooks';
import { colors, fonts, safe, spacing } from '../theme';

const formatBytes = (bytes: number) => (bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.round(bytes / 1e6)} MB`);

/** "My Downloads": Media3 downloads stored in app-private storage. */
export function DownloadsScreen() {
  const records = useDownloads((s) => Object.values(s.records).filter((r) => r.state !== 'removing'));

  useEffect(() => {
    downloadsStore.getState().refresh();
  }, []);

  return (
    <View style={styles.screen} testID="downloads-screen">
      <Text style={styles.title}>My Downloads</Text>
      {records.length === 0 ? <Text style={styles.muted}>Movies and episodes you download appear here.</Text> : null}
      <FlatList data={records} keyExtractor={(r) => r.id} renderItem={({ item, index }) => <DownloadRow record={item} first={index === 0} />} />
    </View>
  );
}

function DownloadRow({ record, first }: { record: TvDownload; first: boolean }) {
  const { pause, resume, remove } = downloadsStore.getState();
  const percent = Math.round(record.progress * 100);
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
    <View style={styles.row} accessibilityLabel={record.target.title}>
      {record.target.posterUrl ? <Image source={{ uri: record.target.posterUrl }} style={styles.art} /> : <View style={styles.art} />}
      <View style={styles.info}>
        <Text style={styles.name}>{record.target.title}</Text>
        {record.target.subtitle ? <Text style={styles.muted}>{record.target.subtitle}</Text> : null}
        <View style={styles.statusLine}>
          {record.state !== 'completed' ? <ProgressRing value={record.progress} size={20} /> : null}
          <Text style={record.state === 'failed' ? styles.error : styles.muted}>{status}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        {record.state === 'completed' ? (
          <FocusButton label="Play" variant="primary" hasTVPreferredFocus={first} accessibilityLabel={`Play ${record.target.title}`}
            onPress={() => navStore.getState().push({ name: 'player', target: record.target })} />
        ) : record.state === 'downloading' || record.state === 'queued' ? (
          <FocusButton label="Pause" hasTVPreferredFocus={first} onPress={() => pause(record.id)} />
        ) : (
          <FocusButton label="Resume" hasTVPreferredFocus={first} onPress={() => resume(record.id)} />
        )}
        <FocusButton label="Delete" variant="ghost" accessibilityLabel={`Delete ${record.target.title}`} onPress={() => remove(record.id)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingTop: safe.vertical, paddingHorizontal: safe.horizontal },
  title: { color: colors.strong, fontSize: fonts.title, fontWeight: '700', marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, padding: spacing.sm, borderRadius: 4, marginBottom: spacing.sm },
  art: { width: 60, height: 90, borderRadius: 4, backgroundColor: colors.raised },
  info: { flex: 1, gap: 2 },
  name: { color: colors.strong, fontSize: fonts.body, fontWeight: '700' },
  statusLine: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginTop: spacing.xs },
  muted: { color: colors.muted, fontSize: fonts.small },
  error: { color: colors.warning, fontSize: fonts.small },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
