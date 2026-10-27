import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { newSeasonLine, t, type NewSeason } from '@iptv/shared';
import { useScreenHost } from './host';
import { Dialog } from './ui/Dialog';
import { FocusButton } from './ui/FocusButton';
import { colors, fonts } from './ui/theme';

/**
 * Home: series the profile watched that have a new season (DECISIONS.md#d-234). More info opens the series; any choice,
 * OK or Back marks them all as shown. It waits while "Better quality on My List" is open, so only one popup shows at a
 * time. Every app shows it. `visible`: Home is on screen with nothing over it.
 */
export function NewSeasonsDialog({ visible }: { visible: boolean }) {
  const host = useScreenHost();
  const { items, dismiss } = host.hooks.useNewSeasons();
  const { upgrades } = host.hooks.useQualityUpgrades();
  if (!visible || items.length === 0 || upgrades.length > 0) return null;

  const details = (entry: NewSeason) => {
    dismiss();
    host.openDetails('series', entry.masterId);
  };

  return (
    <Dialog title={t('New seasons')} onClose={dismiss} testID="new-seasons">
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {items.map((entry, index) => (
          <View key={entry.masterId} style={styles.entry} testID={`new-season-${entry.masterId}`}>
            {entry.posterUrl ? <Image source={{ uri: entry.posterUrl }} style={styles.poster} resizeMode="cover" /> : null}
            <View style={styles.text}>
              <Text style={styles.name} numberOfLines={2}>
                {entry.year ? `${entry.title} (${entry.year})` : entry.title}
              </Text>
              <Text style={styles.line}>{newSeasonLine(entry)}</Text>
              <View style={styles.actions}>
                <FocusButton
                  label={t('More Info')}
                  icon="info"
                  variant="primary"
                  hasTVPreferredFocus={index === 0}
                  testID={`new-season-info-${entry.masterId}`}
                  onPress={() => details(entry)}
                />
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
      <FocusButton label={t('OK')} variant="ghost" onPress={dismiss} testID="new-seasons-ok" />
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
