import { Image, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { t, upgradeLine, useAppStore, type WatchlistDto } from '@iptv/shared';
import { navStore, updater } from '../appContext';
import { useQualityUpgrades } from '../hooks';
import { colors, fonts } from '../theme';
import { FocusButton } from './FocusButton';
import { FocusRow } from './FocusRow';

/**
 * Home: movies on My List that turned from a cinema copy (CAM, TS…) into a better one (DECISIONS.md#d-176). Each has
 * Play and More info; any choice, OK or Back marks them all as shown. `visible`: Home is on screen with nothing over it.
 */
export function QualityUpgradeDialog({ visible }: { visible: boolean }) {
  const { upgrades, dismiss, playTarget } = useQualityUpgrades();
  const updatePrompt = useAppStore(updater.store, (s) => s.prompt);
  if (!visible || updatePrompt || upgrades.length === 0) return null;

  const play = (entry: WatchlistDto) => {
    dismiss();
    void playTarget(entry).then((target) =>
      navStore.getState().push(target ? { name: 'player', target } : { name: 'details', section: 'movies', masterId: entry.masterId }),
    );
  };
  const details = (entry: WatchlistDto) => {
    dismiss();
    navStore.getState().push({ name: 'details', section: 'movies', masterId: entry.masterId });
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.scrim}>
        <View style={styles.panel} testID="quality-upgrades">
          <Text style={styles.title}>{t('Better quality on My List')}</Text>
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {upgrades.map((entry, index) => (
              <View key={entry.masterId} style={styles.entry} testID={`quality-upgrade-${entry.masterId}`}>
                {entry.posterUrl ? <Image source={{ uri: entry.posterUrl }} style={styles.poster} resizeMode="cover" /> : null}
                <View style={styles.text}>
                  <Text style={styles.name} numberOfLines={2}>
                    {entry.year ? `${entry.title} (${entry.year})` : entry.title}
                  </Text>
                  <Text style={styles.line}>{upgradeLine(entry)}</Text>
                  <FocusRow style={styles.actions}>
                    <FocusButton
                      label={t('Play')}
                      icon="play"
                      variant="primary"
                      hasTVPreferredFocus={index === 0}
                      testID={`quality-upgrade-play-${entry.masterId}`}
                      onPress={() => play(entry)}
                    />
                    <FocusButton
                      label={t('More Info')}
                      icon="info"
                      testID={`quality-upgrade-info-${entry.masterId}`}
                      onPress={() => details(entry)}
                    />
                  </FocusRow>
                </View>
              </View>
            ))}
          </ScrollView>
          <FocusButton label={t('OK')} variant="ghost" onPress={dismiss} testID="quality-upgrades-ok" />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: 16 },
  panel: {
    width: 560,
    maxWidth: '100%',
    maxHeight: '90%',
    padding: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  title: { color: colors.strong, fontSize: fonts.heading, fontWeight: '700' },
  list: { flexGrow: 0 },
  listContent: { gap: 16 },
  entry: { flexDirection: 'row', gap: 16 },
  poster: { width: 80, height: 120, borderRadius: 4, backgroundColor: colors.raised },
  text: { flex: 1, gap: 6 },
  name: { color: colors.strong, fontSize: fonts.body, fontWeight: '700' },
  line: { color: colors.muted, fontSize: fonts.small },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
});
