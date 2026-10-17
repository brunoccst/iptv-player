import { useRef, useState } from 'react';
import { t, tn, type LibrarySection, type MasterDetails, type VariantInfo } from '@iptv/shared';
import { uiStore } from '../../appContext';
import { CardMenu, menuBelow, type CardMenuAction, type MenuPosition } from '../../components/CardMenu';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { Spinner } from '../../components/Spinner';
import { useMergeCandidates, useRegroup } from '../../hooks/stores';

/**
 * Split or merge titles by hand (issue #243, DECISIONS.md#d-185): a round button beside My List opens the options for
 * this title; "Merge with another title" asks which one. Only where the library is in a database (the desktop app).
 */
export function RegroupButton({ section, master, variant }: { section: LibrarySection; master: MasterDetails; variant: VariantInfo }) {
  const regroup = useRegroup(section, master, (masterId) => uiStore.getState().replaceDetails({ section, masterId }));
  const button = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState<MenuPosition | null>(null);
  const [merging, setMerging] = useState(false);
  if (!regroup.available) return null;

  const actions: CardMenuAction[] = [
    ...(master.variants.length > 1
      ? [
          {
            label: t('Split off this version ({version})', { version: variant.label }),
            icon: 'split' as const,
            onSelect: () => regroup.split(variant.streamId),
          },
        ]
      : []),
    { label: t('Merge with another title…'), icon: 'merge', onSelect: () => setMerging(true) },
    ...(regroup.merged ? [{ label: t('Separate the merged titles'), icon: 'split' as const, onSelect: regroup.undo }] : []),
    ...(regroup.splitOff ? [{ label: t('Put back with its title'), icon: 'merge' as const, onSelect: regroup.undo }] : []),
  ];
  const label = t('Split or merge');
  return (
    <>
      <button
        ref={button}
        type="button"
        className="icon-button"
        aria-label={label}
        title={regroup.error ?? label}
        aria-busy={regroup.busy}
        disabled={regroup.busy}
        data-testid="details-regroup"
        onClick={() => setMenu(menuBelow(button.current!))}
      >
        {regroup.busy ? <Spinner small /> : <Icon name="merge" size={20} />}
      </button>
      {regroup.error ? (
        <span className="error-text" role="alert">
          {regroup.error}
        </span>
      ) : null}
      {menu ? <CardMenu title={master.title} actions={actions} position={menu} onClose={() => setMenu(null)} /> : null}
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

/** Finds the title to merge into this one by its name. */
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
  const title = t('Merge with another title');
  return (
    <Modal label={title} onClose={onClose}>
      <div className="merge-picker">
        <h2>{title}</h2>
        <p className="muted">{t('The title you pick joins “{title}”, with all its versions.', { title: master.title })}</p>
        <input
          className="input"
          type="search"
          aria-label={t('Title to merge')}
          value={query}
          autoFocus
          onChange={(event) => setQuery(event.target.value)}
        />
        {query.trim().length < 2 ? null : found === null ? (
          <Spinner />
        ) : found.length === 0 ? (
          <p className="muted">{t('No titles found.')}</p>
        ) : (
          <ul className="merge-picker__list">
            {found.map((card) => (
              <li key={card.id}>
                <button type="button" className="merge-picker__item" onClick={() => onPick(card.id)}>
                  <span>{card.year ? `${card.title} (${card.year})` : card.title}</span>
                  <span className="muted">{tn('{count} version', '{count} versions', card.variantCount)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
