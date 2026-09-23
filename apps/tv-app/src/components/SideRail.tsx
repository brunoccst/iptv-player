import { useState } from 'react';
import { Pressable, StyleSheet, Text, TVFocusGuideView, View } from 'react-native';
import { selectActiveProfile } from '@iptv/shared';
import { navStore, stores } from '../appContext';
import { useNav, useSession } from '../hooks';
import { currentRoute, type Section } from '../navigation/navStore';
import { colors, fonts, safe, spacing } from '../theme';

const ITEMS: { section: Section; label: string }[] = [
  { section: 'home', label: 'Home' },
  { section: 'series', label: 'Series' },
  { section: 'movies', label: 'Movies' },
  { section: 'live', label: 'Live TV' },
  { section: 'downloads', label: 'Downloads' },
];

/** Left navigation rail. `autoFocus` guide returns focus to the last focused item when entering the rail. */
export function SideRail() {
  const route = useNav(currentRoute);
  const profile = useSession(selectActiveProfile);
  const active = route.name === 'section' ? route.section : null;

  return (
    <TVFocusGuideView autoFocus style={styles.rail} accessibilityLabel="Main menu">
      <RailItem label={profile?.name ?? 'Profile'} onPress={() => stores.session.getState().selectProfile(null)} testID="rail-profile" />
      <View style={styles.spacer} />
      {ITEMS.map((item) => (
        <RailItem key={item.section} label={item.label} active={active === item.section} testID={`rail-${item.section}`}
          onPress={() => navStore.getState().goSection(item.section)} />
      ))}
    </TVFocusGuideView>
  );
}

function RailItem({ label, active, onPress, testID }: { label: string; active?: boolean; onPress(): void; testID: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!active }}
      onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={[styles.item, focused && styles.itemFocused]}>
      <Text style={[styles.label, active && styles.labelActive, focused && styles.labelFocused]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rail: { width: 150, paddingTop: safe.vertical, paddingLeft: spacing.lg, backgroundColor: 'rgba(0,0,0,0.6)' },
  spacer: { height: spacing.lg },
  item: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: 4, marginBottom: spacing.xs },
  itemFocused: { backgroundColor: colors.strong },
  label: { color: colors.muted, fontSize: fonts.body },
  labelActive: { color: colors.strong, fontWeight: '700' },
  labelFocused: { color: '#000' },
});
