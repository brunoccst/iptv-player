import { useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { t, tn, type LibrarySection, type MasterDetails, type VariantInfo } from '@iptv/shared';
import { useScreenHost, type MenuItem } from '../host';
import { colors, fonts } from './theme';
import { Dialog } from './Dialog';
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

/** Finds the title to merge into this one by its name; Back (Escape on the desktop) closes it, not the details under it. */
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
  const title = t('Merge with another title');
  return (
    <Dialog title={title} onClose={onClose} testID="merge-picker">
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
    </Dialog>
  );
}

const styles = StyleSheet.create({
  busy: { width: 40, height: 40 },
  error: { color: colors.accent, fontSize: fonts.small },
  line: { color: colors.muted, fontSize: fonts.body },
  list: { flexGrow: 0 },
  listContent: { gap: 8 },
});
