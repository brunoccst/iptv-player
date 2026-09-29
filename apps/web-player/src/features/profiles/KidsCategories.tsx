import { CATEGORY_SECTIONS, t } from '@iptv/shared';

import { Modal } from '../../components/Modal';
import { useKidsCategories } from '../../hooks/stores';

/** Profile editor → Choose categories (D-064): what a Kids profile may see, per section; starts from the automatic choice. */
export function KidsCategories({ profileId, name, onClose }: { profileId: string; name: string; onClose(): void }) {
  const { section, setSection, categories, error, chosen, isPicked, toggle, automatic, save } = useKidsCategories(profileId, onClose);

  return (
    <Modal label={t('Categories for {name}', { name })} onClose={onClose}>
      <div className="profile-editor" style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0 }}>{t('Categories for {name}', { name })}</h2>
        <div className="chips" role="tablist">
          {CATEGORY_SECTIONS.map((s) => (
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
          {chosen ? t('Chosen by you.') : t('Automatic: categories whose names say they are for kids.')}{' '}
          {t('Only checked categories are shown.')}
        </p>
        {error ? (
          <p className="error-text" role="alert">
            {error}
          </p>
        ) : null}
        <div style={{ maxHeight: '45vh', overflowY: 'auto', display: 'grid', gap: 4 }}>
          {categories?.map((category) => (
            <label key={category.id} className="checkbox">
              <input type="checkbox" checked={isPicked(category.id)} onChange={() => toggle(category.id)} /> {category.name}
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" className="button button--primary" onClick={() => void save()}>
            {t('Save')}
          </button>
          <button type="button" className="button button--ghost" disabled={!chosen} onClick={automatic}>
            {t('Automatic')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
