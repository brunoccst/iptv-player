import { languageNames, t } from '@iptv/shared';

import { Modal } from '../../components/Modal';
import { useLanguageSettings } from '../../hooks/stores';

/**
 * Account menu → Content language filter (D-063, D-067, D-086): only titles with audio or subtitles in one of the chosen languages, for the
 * active profile. No language ticked = all languages. Applied when the dialog closes (every list reloads).
 */
export function LanguageSettings({ onClose, profile }: { onClose(): void; profile?: { id: string; name: string } }) {
  // The active profile from the account menu; a given one from the profile editor (e.g. a Kids profile).
  const { title, chosen, toggle, allLanguages, close } = useLanguageSettings(profile, onClose);
  return (
    <Modal label={title} onClose={close}>
      <div className="profile-editor" style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <p className="muted" style={{ margin: 0 }}>
          {t(
            'Show only titles in one of these languages: from the title\'s name ("EN - …", "SUB ITA"), else from its category\'s name. Titles in a category without a language are always shown. Each profile has its own choice; none ticked shows all languages.',
          )}
        </p>
        <label className="checkbox">
          <input type="checkbox" checked={chosen.length === 0} onChange={() => allLanguages()} /> {t('All languages')}
        </label>
        {Object.entries(languageNames()).map(([code, name]) => (
          <label key={code} className="checkbox">
            <input type="checkbox" checked={chosen.includes(code)} onChange={() => toggle(code)} /> {name}
          </label>
        ))}
        <button type="button" className="button" onClick={close}>
          {t('Done')}
        </button>
      </div>
    </Modal>
  );
}
