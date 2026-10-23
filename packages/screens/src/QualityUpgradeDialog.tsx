import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { t, upgradeLine, type WatchlistDto } from '@iptv/shared';
import { useScreenHost } from './host';
import { Dialog } from './ui/Dialog';
import { FocusButton } from './ui/FocusButton';
import { FocusRow } from './ui/FocusRow';
import { colors, fonts } from './ui/theme';

/**
 * Home: titles on My List that turned from a cinema copy (CAM, TS…) into a better one (DECISIONS.md#d-176). A movie has
 * Play and More info, a series More info on the better version (issue #251); any choice, OK or Back marks them all as
 * shown. Every app shows it (issue #237). `visible`: Home is on screen with nothing over it.
 */
export function QualityUpgradeDialog({ visible }: { visible: boolean }) {
  const host = useScreenHost();
  const { upgrades, dismiss, playTarget } = host.hooks.useQualityUpgrades();
  if (!visible || upgrades.length === 0) return null;

  const play = (entry: WatchlistDto) => {
    dismiss();
    void playTarget(entry).then((target) => (target ? host.play(target) : host.openDetails(entry.section, entry.masterId)));
  };
  const details = (entry: WatchlistDto) => {
    dismiss();
    const open = () => host.openDetails(entry.section, entry.masterId);
    if (entry.section === 'series') void playTarget(entry).then(open, open);
    else open();
  };

  return (
    <Dialog title={t('Better quality on My List')} onClose={dismiss} testID="quality-upgrades">
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
                {entry.section === 'movies' ? (
                  <FocusButton
                    label={t('Play')}
                    icon="play"
                    variant="primary"
                    hasTVPreferredFocus={index === 0}
                    testID={`quality-upgrade-play-${entry.masterId}`}
                    onPress={() => play(entry)}
                  />
                ) : null}
                <FocusButton
                  label={t('More Info')}
                  icon="info"
                  hasTVPreferredFocus={index === 0 && entry.section !== 'movies'}
                  testID={`quality-upgrade-info-${entry.masterId}`}
                  onPress={() => details(entry)}
                />
              </FocusRow>
            </View>
          </View>
        ))}
      </ScrollView>
      <FocusButton label={t('OK')} variant="ghost" onPress={dismiss} testID="quality-upgrades-ok" />
    </Dialog>
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 0 },
  listContent: { gap: 16 },
  entry: { flexDirection: 'row', gap: 16 },
  poster: { width: 80, height: 120, borderRadius: 4, backgroundColor: colors.raised },
  text: { flex: 1, gap: 6 },
  name: { color: colors.strong, fontSize: fonts.body, fontWeight: '700' },
  line: { color: colors.muted, fontSize: fonts.small },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
});
