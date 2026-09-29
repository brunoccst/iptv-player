import { useEffect, useState } from 'react';
import { selectActiveProfile, type CatalogSection, type MediaCategory, t } from '@iptv/shared';
import { api, stores, uiStore } from '../../appContext';
import { Modal } from '../../components/Modal';
import { useProfilePrefs, useSession } from '../../hooks/stores';

const SECTIONS: { section: CatalogSection; label: () => string }[] = [
  { section: 'movies', label: () => t('Movies') },
  { section: 'series', label: () => t('Series') },
  { section: 'live', label: () => t('Live TV') },
];

type Hidden = Partial<Record<CatalogSection, string[]>>;

/**
 * Account menu → Profiles → Categories shown (D-110), same as the TV app: unchecked categories leave the category
 * bars, lists, Home rows and the guide; search still finds them. Applied when saved (every list reloads).
 */
export function HiddenCategories({ onClose }: { onClose(): void }) {
  const profileId = useSession((s) => s.activeProfileId);
  const profileName = useSession((s) => selectActiveProfile(s)?.name ?? null);
  const saved = useProfilePrefs((s) => (profileId ? (s.prefs[profileId]?.hiddenCategories ?? {}) : {}));
  const [section, setSection] = useState<CatalogSection>('movies');
  const [lists, setLists] = useState<Partial<Record<CatalogSection, MediaCategory[]>>>({});
  const [hidden, setHidden] = useState<Hidden>(saved);
  const [error, setError] = useState<string | null>(null);
  const categories = lists[section];
  const hiddenHere = hidden[section] ?? [];

  useEffect(() => {
    if (lists[section]) return;
    api.catalog
      .categories(section, undefined, { includeHidden: true })
      .then((list) => setLists((current) => ({ ...current, [section]: list })))
      .catch(() => setError(t('The categories could not be loaded.')));
  }, [section, lists]);

  const toggle = (id: string) =>
    setHidden({ ...hidden, [section]: hiddenHere.includes(id) ? hiddenHere.filter((c) => c !== id) : [...hiddenHere, id] });
  const save = () => {
    onClose();
    if (!profileId || JSON.stringify(hidden) === JSON.stringify(saved)) return;
    void stores.profilePrefs
      .getState()
      .update(profileId, { hiddenCategories: hidden })
      .then(() => uiStore.getState().bumpLibrary());
  };
  const title = profileName ? t('Categories shown to {name}', { name: profileName }) : t('Categories shown');

  return (
    <Modal label={title} onClose={onClose}>
      <div className="profile-editor" style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <div className="chips" role="tablist" aria-label={title}>
          {SECTIONS.map((s) => (
            <button
              key={s.section}
              type="button"
              role="tab"
              aria-selected={section === s.section}
              className={`chip${section === s.section ? ' chip--active' : ''}`}
              onClick={() => setSection(s.section)}
            >
              {s.label()}
            </button>
          ))}
        </div>
        <p className="muted" style={{ margin: 0 }}>
          {t('Unchecked categories are left out of browsing: the category bar, the lists, Home and the guide. Search still finds them.')}
        </p>
        {error ? <p role="alert">{error}</p> : null}
        {categories ? (
          <div style={{ display: 'grid', gap: 4, maxHeight: '50vh', overflowY: 'auto' }}>
            {categories.length === 0 ? <p className="muted">{t('No categories.')}</p> : null}
            {categories.map((category) => (
              <label key={category.id} className="checkbox">
                <input type="checkbox" checked={!hiddenHere.includes(category.id)} onChange={() => toggle(category.id)} /> {category.name}
              </label>
            ))}
          </div>
        ) : error ? null : (
          <p className="muted">{t('Loading')}</p>
        )}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" className="button" onClick={save}>
            {t('Save')}
          </button>
          <button
            type="button"
            className="button button--ghost"
            disabled={hiddenHere.length === 0}
            onClick={() => setHidden({ ...hidden, [section]: [] })}
          >
            {t('Show all')}
          </button>
          <button type="button" className="button button--ghost" onClick={onClose}>
            {t('Cancel')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
