import { useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { t, tn, type LibrarySection, type MasterDetails, type VariantInfo } from '@iptv/shared';
import { navStore } from '../appContext';
import { useMergeCandidates, useRegroup } from '../hooks';
import { colors, fonts } from '../theme';
import { CardMenu, type CardMenuAction } from './CardMenu';
import { Field } from './Field';
import { FocusButton } from './FocusButton';
import { IconButton } from './IconButton';

/**
 * Web `RegroupButton`: split or merge titles by hand (issue #243, DECISIONS.md#d-185). A round button beside My List
 * opens the options for this title; "Merge with another title" asks which one by its name.
 */
export function RegroupButton({ section, master, variant }: { section: LibrarySection; master: MasterDetails; variant: VariantInfo }) {
  const regroup = useRegroup(section, master, (masterId) => navStore.getState().replaceTop({ name: 'details', section, masterId }));
  const [menu, setMenu] = useState(false);
  const [merging, setMerging] = useState(false);
  if (!regroup.available) return null;
  if (regroup.busy) return <ActivityIndicator color={colors.accent} style={styles.busy} accessibilityLabel={t('Loading')} />;

  const actions: CardMenuAction[] = [
    ...(master.variants.length > 1
      ? [
          {
            label: t('Split off this version ({version})', { version: variant.label }),
            icon: 'split' as const,
            testID: 'regroup-split',
            onPress: () => regroup.split(variant.streamId),
          },
        ]
      : []),
    { label: t('Merge with another title…'), icon: 'merge', testID: 'regroup-merge', onPress: () => setMerging(true) },
    ...(regroup.merged
      ? [{ label: t('Separate the merged titles'), icon: 'split' as const, testID: 'regroup-undo', onPress: regroup.undo }]
      : []),
    ...(regroup.splitOff
      ? [{ label: t('Put back with its title'), icon: 'merge' as const, testID: 'regroup-undo', onPress: regroup.undo }]
      : []),
  ];
  return (
    <>
      <IconButton icon="merge" label={t('Split or merge')} testID="details-regroup" onPress={() => setMenu(true)} />
      {regroup.error ? <Text style={styles.error}>{regroup.error}</Text> : null}
      {menu ? <CardMenu title={master.title} actions={actions} onClose={() => setMenu(false)} /> : null}
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

/** Finds the title to merge into this one by its name; Back closes it. */
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
  const [query, setQuery] = useState(master.title);
  const found = useMergeCandidates(section, query, master.id);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.panel} testID="merge-picker">
          <Text style={styles.title}>{t('Merge with another title')}</Text>
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
