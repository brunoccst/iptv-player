import { useRef } from 'react';
import { LANGUAGE_NAMES, profileLanguages, selectActiveProfile } from '@iptv/shared';
import { stores, uiStore } from '../../appContext';
import { Modal } from '../../components/Modal';
import { useProfilePrefs, useSession } from '../../hooks/stores';

/**
 * Account menu → Languages (D-063, D-067): only titles with audio or subtitles in one of the chosen languages, for the
 * active profile. No language ticked = all languages.
 */
export function LanguageSettings({ onClose }: { onClose(): void }) {
  const profileId = useSession((s) => s.activeProfileId);
  const profileName = useSession((s) => selectActiveProfile(s)?.name ?? null);
  const chosen = useProfilePrefs((s) => (profileId ? profileLanguages(s.prefs[profileId]) : []));
  const changed = useRef(false);
  const save = async (languages: string[]) => {
    if (!profileId) return;
    changed.current = true;
    await stores.profilePrefs.getState().update(profileId, { languages, language: null });
  };
  const toggle = (code: string) => save(chosen.includes(code) ? chosen.filter((c) => c !== code) : [...chosen, code]);
  const close = () => {
    if (changed.current) uiStore.getState().bumpLibrary();
    onClose();
  };
  const title = profileName ? `Languages for ${profileName}` : 'Languages';
  return (
    <Modal label={title} onClose={close}>
      <div className="profile-editor" style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <p className="muted" style={{ margin: 0 }}>
          Show only titles with audio or subtitles in one of these languages, as the provider names them. Each profile has its own choice;
          none ticked shows all languages.
        </p>
        <label className="checkbox">
          <input type="checkbox" checked={chosen.length === 0} onChange={() => void save([])} /> All languages
        </label>
        {Object.entries(LANGUAGE_NAMES).map(([code, name]) => (
          <label key={code} className="checkbox">
            <input type="checkbox" checked={chosen.includes(code)} onChange={() => void toggle(code)} /> {name}
          </label>
        ))}
        <button type="button" className="button" onClick={close}>
          Done
        </button>
      </div>
    </Modal>
  );
}
