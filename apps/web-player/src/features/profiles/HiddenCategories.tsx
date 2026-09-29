import { CATEGORY_SECTIONS, t } from '@iptv/shared';

import { Modal } from '../../components/Modal';
import { useHiddenCategories } from '../../hooks/stores';

/**
 * Account menu → Profiles → Categories shown (D-110), same as the TV app: unchecked categories leave the category
 * bars, lists, Home rows and the guide; search still finds them. Applied when saved (every list reloads).
 */
export function HiddenCategories({ onClose }: { onClose(): void }) {
  const { section, setSection, categories, error, profileName, isShown, anyHidden, toggle, showAll, save } = useHiddenCategories(onClose);
  const title = profileName ? t('Categories shown to {name}', { name: profileName }) : t('Categories shown');

  return (
    <Modal label={title} onClose={onClose}>
      <div className="profile-editor" style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <div className="chips" role="tablist" aria-label={title}>
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
          {t('Unchecked categories are left out of browsing: the category bar, the lists, Home and the guide. Search still finds them.')}
        </p>
        {error ? <p role="alert">{error}</p> : null}
        {categories ? (
          <div style={{ display: 'grid', gap: 4, maxHeight: '50vh', overflowY: 'auto' }}>
            {categories.length === 0 ? <p className="muted">{t('No categories.')}</p> : null}
            {categories.map((category) => (
              <label key={category.id} className="checkbox">
                <input type="checkbox" checked={isShown(category.id)} onChange={() => toggle(category.id)} /> {category.name}
              </label>
            ))}
          </div>
        ) : error ? null : (
          <p className="muted">{t('Loading')}</p>
        )}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" className="button" onClick={() => void save()}>
            {t('Save')}
          </button>
          <button type="button" className="button button--ghost" disabled={!anyHidden} onClick={showAll}>
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
