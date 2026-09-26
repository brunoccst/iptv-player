import { LANGUAGE_NAMES } from '@iptv/shared';
import { stores, uiStore } from '../../appContext';
import { Modal } from '../../components/Modal';
import { useProfilePrefs, useSession } from '../../hooks/stores';

/** Account menu → Language (D-063): only titles with audio or subtitles in this language, for the active profile. */
export function LanguageSettings({ onClose }: { onClose(): void }) {
  const profileId = useSession((s) => s.activeProfileId);
  const current = useProfilePrefs((s) => (profileId ? (s.prefs[profileId]?.language ?? '') : ''));
  const choose = async (code: string) => {
    if (!profileId) return;
    await stores.profilePrefs.getState().update(profileId, { language: code || null });
    uiStore.getState().bumpLibrary();
    onClose();
  };
  return (
    <Modal label="Language" onClose={onClose}>
      <div className="profile-editor" style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Language</h2>
        <p className="muted" style={{ margin: 0 }}>
          Show only titles with audio or subtitles in this language, as the provider names them. Applies to this profile.
        </p>
        <div className="field">
          <label htmlFor="language">Language</label>
          <select id="language" className="input" value={current} onChange={(event) => void choose(event.target.value)}>
            <option value="">All languages</option>
            {Object.entries(LANGUAGE_NAMES).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}
