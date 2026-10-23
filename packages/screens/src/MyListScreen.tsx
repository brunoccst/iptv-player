import { ActivityIndicator, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { t, watchlistCard } from '@iptv/shared';
import { useScreenHost } from './host';
import { TitleCard } from './TitleCard';
import { FocusRow } from './ui/FocusRow';
import { colors, useSizes } from './ui/theme';

/** Cards sit this far apart, like the web grid. */
export const GRID_GAP = 8;

/** Cards per line and their width for this screen, like the web grid (`auto-fill` of `--card-width`, stretched). */
export function useGridColumns() {
  const { width } = useWindowDimensions();
  const { gutter, cardWidth } = useSizes();
  const available = width - gutter * 2;
  const columns = Math.max(1, Math.floor((available + GRID_GAP) / (cardWidth + GRID_GAP)));
  return { columns, itemWidth: Math.floor((available - GRID_GAP * (columns - 1)) / columns) };
}

/** "My List": titles the active profile saved, newest first (D-055). One screen for TV, phone and desktop (D-193). */
export function MyListScreen() {
  const { hooks, Page } = useScreenHost();
  const items = hooks.useWatchlist((s) => s.items);
  const { columns, itemWidth } = useGridColumns();
  const sizes = useSizes();
  const list = items.data ?? [];
  const rows = Array.from({ length: Math.ceil(list.length / columns) }, (_, i) => list.slice(i * columns, (i + 1) * columns));
  return (
    <Page testID="mylist-screen">
      <Text accessibilityRole="header" style={[styles.title, { fontSize: sizes.pageTitle, marginHorizontal: sizes.gutter }]}>
        {t('My List')}
      </Text>
      {items.status === 'loading' && !items.data ? (
        <ActivityIndicator size="large" color={colors.accent} accessibilityLabel={t('Loading')} />
      ) : list.length === 0 ? (
        <Text style={[styles.muted, { marginHorizontal: sizes.gutter }]}>
          {t('Add movies and series with the + button on their details to watch them later.')}
        </Text>
      ) : (
        rows.map((row, index) => (
          // A focus row: on TV Left/Right stop at its ends (D-069).
          <FocusRow key={index} style={[styles.row, { paddingHorizontal: sizes.gutter }]}>
            {row.map((item, column) => (
              <TitleCard
                key={`${item.section}-${item.masterId}`}
                section={item.section}
                item={watchlistCard(item)}
                width={itemWidth}
                hasTVPreferredFocus={index === 0 && column === 0}
              />
            ))}
          </FocusRow>
        ))
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.strong, fontWeight: '700', marginBottom: 24 },
  muted: { color: colors.muted, fontSize: 16 },
  row: { flexDirection: 'row', gap: GRID_GAP, marginBottom: 24 },
});
