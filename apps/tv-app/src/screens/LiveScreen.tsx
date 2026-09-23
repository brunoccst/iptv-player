import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { ALL_CATEGORIES_KEY } from '@iptv/shared';
import { navStore, stores } from '../appContext';
import { ErrorText, errorText, Loading } from '../components/Feedback';
import { FocusButton } from '../components/FocusButton';
import { PosterCard } from '../components/PosterCard';
import { useCatalog } from '../hooks';
import { colors, fonts, safe, spacing } from '../theme';

/** Live channels by category. EPG grid arrives in Step 7. */
export function LiveScreen() {
  const categories = useCatalog((s) => s.categories.live?.data ?? []);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const resource = useCatalog((s) => s.liveChannels[categoryId ?? ALL_CATEGORIES_KEY]);

  useEffect(() => {
    void stores.catalog.getState().loadCategories('live');
  }, []);
  useEffect(() => {
    void stores.catalog.getState().loadLiveChannels(categoryId);
  }, [categoryId]);

  return (
    <View style={styles.screen} testID="live-screen">
      <Text style={styles.title}>Live TV</Text>
      <View style={styles.chips}>
        <FocusButton label="All" variant={categoryId === null ? 'primary' : 'ghost'} onPress={() => setCategoryId(null)} />
        {categories.map((c) => (
          <FocusButton key={c.id} label={c.name} variant={categoryId === c.id ? 'primary' : 'ghost'} onPress={() => setCategoryId(c.id)} />
        ))}
      </View>
      {resource?.status === 'error' ? <ErrorText>{errorText(resource.error)}</ErrorText> : null}
      {resource?.status === 'loading' && !resource.data ? <Loading /> : null}
      <FlatList
        data={resource?.data ?? []}
        numColumns={4}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <PosterCard landscape title={item.name} posterUrl={item.logoUrl} subtitle={item.number != null ? `Channel ${item.number}` : null}
              onPress={() => navStore.getState().push({ name: 'player', target: { kind: 'live', streamId: item.id, container: 'm3u8', title: item.name, posterUrl: item.logoUrl } })} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingTop: safe.vertical, paddingHorizontal: safe.horizontal },
  title: { color: colors.strong, fontSize: fonts.title, fontWeight: '700', marginBottom: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  grid: { paddingBottom: spacing.xl },
  cell: { marginBottom: spacing.lg },
});
