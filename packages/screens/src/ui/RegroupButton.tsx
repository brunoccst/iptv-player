import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { t, tn, type LibrarySection, type MasterDetails, type VariantInfo } from '@iptv/shared';
import { useScreenHost, type MenuItem } from '../host';
import { colors, fonts } from './theme';
import { Field } from './Field';
import { FocusButton } from './FocusButton';
import { IconButton } from './IconButton';

/**
 * Split or merge titles by hand (issue #243, DECISIONS.md#d-185): a round button beside My List opens the options for
 * this title; "Merge with another title" asks which one by its name. Only where the library is in a database.
 */
export function RegroupButton({ section, master, variant }: { section: LibrarySection; master: MasterDetails; variant: VariantInfo }) {
  const host = useScreenHost();
  const regroup = host.hooks.useRegroup(section, master, (masterId) => host.details.replace(section, masterId));
  const button = useRef<View | null>(null);
  const [menu, setMenu] = useState<{ anchor?: View } | null>(null);
  const [merging, setMerging] = useState(false);
  if (!regroup.available) return null;
  if (regroup.busy) return <ActivityIndicator color={colors.accent} style={styles.busy} accessibilityLabel={t('Loading')} />;

  const items: MenuItem[] = [
    ...(master.variants.length > 1
      ? [
          {
            id: 'split',
            label: t('Split off this version ({version})', { version: variant.label }),
            icon: 'split' as const,
            run: () => regroup.split(variant.streamId),
          },
        ]
      : []),
    { id: 'merge', label: t('Merge with another title…'), icon: 'merge', run: () => setMerging(true) },
    ...(regroup.merged ? [{ id: 'undo', label: t('Separate the merged titles'), icon: 'split' as const, run: regroup.undo }] : []),
    ...(regroup.splitOff ? [{ id: 'undo', label: t('Put back with its title'), icon: 'merge' as const, run: regroup.undo }] : []),
  ];
  return (
    <>
      <IconButton
        icon="merge"
        label={t('Split or merge')}
        testID="details-regroup"
        focusRef={(view) => {
          button.current = view;
        }}
        onPress={() => setMenu({ anchor: button.current ?? undefined })}
      />
      {regroup.error ? (
        <Text style={styles.error} role="alert">
          {regroup.error}
        </Text>
      ) : null}
      {menu ? <host.Menu title={master.title} items={items} anchor={menu.anchor} onClose={() => setMenu(null)} /> : null}
      {merging ? (
        <MergePicker
          section={section}
          master={master}
          onPick={(fromId) => {
            setMerging(false);
            regroup.merge(fromId);
          }}
          onClose={() => setMerging(false)}
        />
      ) : null}
    </>
  );
}

/** Finds the title to merge into this one by its name; Back (Escape on the desktop) closes it. */
function MergePicker({
  section,
  master,
  onPick,
  onClose,
}: {
  section: LibrarySection;
  master: MasterDetails;
  onPick(fromId: string): void;
  onClose(): void;
}) {
  const host = useScreenHost();
  const [query, setQuery] = useState(master.title);
  const found = host.hooks.useMergeCandidates(section, query, master.id);
  // Desktop: Escape closes only this picker, not the details under it (their dialog closes on the same key).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
    };
    // Capture: before the search field and the details' dialog see the key.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  const title = t('Merge with another title');
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.panel} testID="merge-picker" role="dialog" accessibilityLabel={title}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.line}>{t('The title you pick joins “{title}”, with all its versions.', { title: master.title })}</Text>
          <Field label={t('Title to merge')} value={query} onChange={setQuery} testID="merge-search" compact autoFocus />
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {query.trim().length < 2 ? null : found === null ? (
              <ActivityIndicator color={colors.accent} />
            ) : found.length === 0 ? (
              <Text style={styles.line}>{t('No titles found.')}</Text>
            ) : (
              found.map((card) => (
                <FocusButton
                  key={card.id}
                  label={`${card.year ? `${card.title} (${card.year})` : card.title} · ${tn('{count} version', '{count} versions', card.variantCount)}`}
                  testID={`merge-pick-${card.id}`}
                  onPress={() => onPick(card.id)}
                />
              ))
            )}
          </ScrollView>
          <FocusButton label={t('Cancel')} variant="ghost" icon="close" iconAfter testID="merge-cancel" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  busy: { width: 40, height: 40 },
  error: { color: colors.accent, fontSize: fonts.small },
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
  line: { color: colors.muted, fontSize: fonts.body },
  list: { flexGrow: 0 },
  listContent: { gap: 8 },
});
