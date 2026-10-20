import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colorTokens, t, type WatchlistDto } from '@iptv/shared';

/**
 * What each app brings to a shared screen (issue #237, DECISIONS.md#d-193): how the page scrolls and how a row and a
 * title card behave (TV focus, desktop hover and right-click). The screen itself (texts, states, layout) is written once.
 */
export interface MyListParts {
  /** The scrolling page; `children` are the title and the rows. */
  Page(props: { children: ReactNode; testID: string }): ReactNode;
  /** One row of cards: on TV a focus row, so Left/Right stop at its ends. */
  Row(props: { children: ReactNode; style: StyleProp<ViewStyle> }): ReactNode;
  /** One saved title; `first` is the top-left card (where TV focus starts). */
  Card(props: { item: WatchlistDto; width: number; first: boolean }): ReactNode;
}

/** "My List": titles the active profile saved, newest first (D-055). One screen for TV, phone and desktop. */
export function MyListScreen({
  items,
  loading,
  columns,
  itemWidth,
  gutter,
  titleSize,
  parts: { Page, Row, Card },
}: {
  items: WatchlistDto[] | null;
  loading: boolean;
  /** Cards per row and their width, from the screen width (each app measures it its own way). */
  columns: number;
  itemWidth: number;
  gutter: number;
  titleSize: number;
  parts: MyListParts;
}) {
  const list = items ?? [];
  const rows = Array.from({ length: Math.ceil(list.length / columns) }, (_, i) => list.slice(i * columns, (i + 1) * columns));
  return (
    <Page testID="mylist-screen">
      <Text accessibilityRole="header" style={[styles.title, { fontSize: titleSize, marginHorizontal: gutter }]}>
        {t('My List')}
      </Text>
      {loading && !items ? (
        <ActivityIndicator size="large" color={colorTokens.accent} accessibilityLabel={t('Loading')} />
      ) : list.length === 0 ? (
        <Text style={[styles.muted, { marginHorizontal: gutter }]}>
          {t('Add movies and series with the + button on their details to watch them later.')}
        </Text>
      ) : (
        rows.map((row, index) => (
          <Row key={index} style={[styles.row, { paddingHorizontal: gutter }]}>
            {row.map((item, column) => (
              <Card key={`${item.section}-${item.masterId}`} item={item} width={itemWidth} first={index === 0 && column === 0} />
            ))}
          </Row>
        ))
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  title: { color: colorTokens.textStrong, fontWeight: '700', marginBottom: 24 },
  muted: { color: colorTokens.muted, fontSize: 16 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 24 },
});
