import { useState } from 'react';
import { LANGUAGE_NAMES, profileLanguages, selectActiveProfile } from '@iptv/shared';
import { stores, uiStore } from '../../appContext';
import { Modal } from '../../components/Modal';
import { useProfilePrefs, useSession } from '../../hooks/stores';

/**
 * Account menu → Languages (D-063, D-067): only titles with audio or subtitles in one of the chosen languages, for the
 * active profile. No language ticked = all languages. Applied when the dialog closes (every list reloads).
 */
export function LanguageSettings({ onClose, profile }: { onClose(): void; profile?: { id: string; name: string } }) {
  // The active profile from the account menu; a given one from the profile editor (e.g. a Kids profile).
  const activeId = useSession((s) => s.activeProfileId);
  const activeName = useSession((s) => selectActiveProfile(s)?.name ?? null);
  const profileId = profile?.id ?? activeId;
  const profileName = profile?.name ?? activeName;
  const saved = useProfilePrefs((s) => (profileId ? profileLanguages(s.prefs[profileId]) : []));
  const [chosen, setChosen] = useState(saved);
  const toggle = (code: string) =>
    setChosen((current) => (current.includes(code) ? current.filter((c) => c !== code) : [...current, code]));
  const close = () => {
    onClose();
    if (!profileId || chosen.join(',') === saved.join(',')) return;
    void stores.profilePrefs
      .getState()
      .update(profileId, { languages: chosen, language: null })
      .then(() => uiStore.getState().bumpLibrary());
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
          <input type="checkbox" checked={chosen.length === 0} onChange={() => setChosen([])} /> All languages
        </label>
        {Object.entries(LANGUAGE_NAMES).map(([code, name]) => (
          <label key={code} className="checkbox">
            <input type="checkbox" checked={chosen.includes(code)} onChange={() => toggle(code)} /> {name}
          </label>
        ))}
        <button type="button" className="button" onClick={close}>
          Done
        </button>
      </div>
    </Modal>
  );
}
