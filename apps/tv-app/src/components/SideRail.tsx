import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TVFocusGuideView, View } from 'react-native';
import { selectActiveProfile } from '@iptv/shared';
import { navStore, stores } from '../appContext';
import { fileStorage } from '../dataStorage';
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

const COLLAPSED_KEY = 'ui.railCollapsed';

/** Left navigation rail. ☰ collapses it to a narrow strip (choice remembered). `autoFocus` guide returns focus to the last item. */
export function SideRail() {
  const route = useNav(currentRoute);
  const collapsed = useNav((s) => s.railCollapsed);
  const profile = useSession(selectActiveProfile);
  const active = route.name === 'section' ? route.section : null;

  useEffect(() => {
    void Promise.resolve(fileStorage.getItem(COLLAPSED_KEY))
      .then((value) => navStore.getState().setRailCollapsed(value === 'true'))
      .catch(() => undefined);
  }, []);

  const toggle = () => {
    const next = !collapsed;
    navStore.getState().setRailCollapsed(next);
    void Promise.resolve(fileStorage.setItem(COLLAPSED_KEY, String(next))).catch(() => undefined);
  };

  if (collapsed) {
    return (
      <TVFocusGuideView autoFocus style={[styles.rail, styles.railCollapsed]} accessibilityLabel="Main menu">
        <RailItem label="☰" accessibilityLabel="Show menu" onPress={toggle} testID="rail-toggle" />
      </TVFocusGuideView>
    );
  }

  return (
    <TVFocusGuideView autoFocus style={styles.rail} accessibilityLabel="Main menu">
      <RailItem label="☰" accessibilityLabel="Hide menu" onPress={toggle} testID="rail-toggle" />
      <RailItem label={profile?.name ?? 'Profile'} onPress={() => stores.session.getState().selectProfile(null)} testID="rail-profile" />
      <View style={styles.spacer} />
      {ITEMS.map((item) => (
        <RailItem
          key={item.section}
          label={item.label}
          active={active === item.section}
          testID={`rail-${item.section}`}
          onPress={() => navStore.getState().goSection(item.section)}
        />
      ))}
    </TVFocusGuideView>
  );
}

function RailItem({
  label,
  accessibilityLabel,
  active,
  onPress,
  testID,
}: {
  label: string;
  accessibilityLabel?: string;
  active?: boolean;
  onPress(): void;
  testID: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.item, focused && styles.itemFocused]}
    >
      <Text style={[styles.label, active && styles.labelActive, focused && styles.labelFocused]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rail: { width: 150, paddingTop: safe.vertical, paddingLeft: spacing.lg, backgroundColor: 'rgba(0,0,0,0.6)' },
  railCollapsed: { width: 56, paddingLeft: spacing.xs },
  spacer: { height: spacing.lg },
  item: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: 4, marginBottom: spacing.xs },
  itemFocused: { backgroundColor: colors.strong },
  label: { color: colors.muted, fontSize: fonts.body },
  labelActive: { color: colors.strong, fontWeight: '700' },
  labelFocused: { color: '#000' },
});
