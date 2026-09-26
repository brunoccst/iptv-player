import { useEffect, useState } from 'react';
import { isKidsCategory, type CatalogSection, type MediaCategory } from '@iptv/shared';
import { api, stores } from '../../appContext';
import { Modal } from '../../components/Modal';

const SECTIONS: { section: CatalogSection; label: string }[] = [
  { section: 'movies', label: 'Movies' },
  { section: 'series', label: 'Series' },
  { section: 'live', label: 'Live TV' },
];

/** Profile editor → Choose categories (D-064): what a Kids profile may see, per section; starts from the automatic choice. */
export function KidsCategories({ profileId, name, onClose }: { profileId: string; name: string; onClose(): void }) {
  const [section, setSection] = useState<CatalogSection>('movies');
  const [lists, setLists] = useState<Partial<Record<CatalogSection, MediaCategory[]>>>({});
  const [picks, setPicks] = useState(stores.profilePrefs.getState().prefs[profileId]?.kidsCategories ?? {});
  const [error, setError] = useState<string | null>(null);
  const categories = lists[section];

  useEffect(() => {
    if (lists[section]) return;
    api.catalog
      .categories(section)
      .then((list) => setLists((current) => ({ ...current, [section]: list })))
      .catch(() => setError('The categories could not be loaded.'));
  }, [section, lists]);

  const picked = (list: MediaCategory[]) => picks[section] ?? list.filter((c) => isKidsCategory(c.name)).map((c) => c.id);
  const toggle = (list: MediaCategory[], id: string) => {
    const current = picked(list);
    setPicks({ ...picks, [section]: current.includes(id) ? current.filter((c) => c !== id) : [...current, id] });
  };

  return (
    <Modal label={`Categories for ${name}`} onClose={onClose}>
      <div className="profile-editor" style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Categories for {name}</h2>
        <div className="chips" role="tablist">
          {SECTIONS.map((s) => (
            <button
              key={s.section}
              type="button"
              role="tab"
              aria-selected={section === s.section}
              className={`chip${section === s.section ? ' chip--active' : ''}`}
              onClick={() => setSection(s.section)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="muted" style={{ margin: 0 }}>
          {picks[section] ? 'Chosen by you.' : 'Automatic: categories whose names say they are for kids.'} Only checked categories are
          shown.
        </p>
        {error ? (
          <p className="error-text" role="alert">
            {error}
          </p>
        ) : null}
        <div style={{ maxHeight: '45vh', overflowY: 'auto', display: 'grid', gap: 4 }}>
          {categories?.map((category) => (
            <label key={category.id} className="checkbox">
              <input type="checkbox" checked={picked(categories).includes(category.id)} onChange={() => toggle(categories, category.id)} />{' '}
              {category.name}
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="button button--primary"
            onClick={() => void stores.profilePrefs.getState().update(profileId, { kidsCategories: picks }).then(onClose)}
          >
            Save
          </button>
          <button
            type="button"
            className="button button--ghost"
            disabled={!picks[section]}
            onClick={() => setPicks({ ...picks, [section]: null })}
          >
            Automatic
          </button>
        </div>
      </div>
    </Modal>
  );
}
