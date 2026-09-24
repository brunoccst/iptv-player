import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { LiveChannel } from '@iptv/shared';
import { api, navStore } from '../appContext';
import { PosterCard } from '../components/PosterCard';
import { Row } from '../components/Row';
import { colors, fonts, safe, spacing } from '../theme';
import { LibraryRow } from './LibraryRow';

const DEBOUNCE_MS = 400;
const MAX_CHANNELS = 30;

/** Searches movies, series (deduplicated library) and live channels by name. */
export function SearchScreen() {
  const [text, setText] = useState('');
  const [term, setTerm] = useState('');
  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTerm(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  useEffect(() => {
    if (term.length < 2) {
      setChannels([]);
      return;
    }
    let cancelled = false;
    const needle = term.toLowerCase();
    api.catalog.liveChannels(null).then(
      (all) => !cancelled && setChannels(all.filter((channel) => channel.name.toLowerCase().includes(needle)).slice(0, MAX_CHANNELS)),
      () => !cancelled && setChannels([]),
    );
    return () => {
      cancelled = true;
    };
  }, [term]);

  const searching = term.length >= 2;
  return (
    <ScrollView style={styles.screen} testID="search-screen" keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Search</Text>
      <TextInput
        testID="search-input"
        accessibilityLabel="Search titles and channels"
        value={text}
        onChangeText={setText}
        placeholder="Movies, series, channels"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        hasTVPreferredFocus
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, focused && styles.inputFocused]}
      />
      {!searching ? (
        <Text style={styles.hint}>Type at least 2 letters.</Text>
      ) : (
        <View>
          <LibraryRow section="movies" search={term} title="Movies" />
          <LibraryRow section="series" search={term} title="Series" />
          {channels.length > 0 ? (
            <Row
              title="Live TV"
              items={channels}
              keyOf={(channel) => channel.id}
              testID="row-live-search"
              render={(channel) => (
                <PosterCard
                  landscape
                  title={channel.name}
                  posterUrl={channel.logoUrl}
                  badge="LIVE"
                  onPress={() =>
                    navStore.getState().push({
                      name: 'player',
                      target: { kind: 'live', streamId: channel.id, container: 'm3u8', title: channel.name, posterUrl: channel.logoUrl },
                    })
                  }
                />
              )}
            />
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingTop: safe.vertical },
  title: { color: colors.strong, fontSize: fonts.title, fontWeight: '700', marginLeft: safe.horizontal, marginBottom: spacing.sm },
  input: {
    marginHorizontal: safe.horizontal,
    marginBottom: spacing.lg,
    backgroundColor: '#333',
    color: colors.strong,
    fontSize: fonts.body,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inputFocused: { borderColor: colors.strong },
  hint: { color: colors.muted, fontSize: fonts.body, marginHorizontal: safe.horizontal },
});
