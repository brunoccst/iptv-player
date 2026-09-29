import { useState } from 'react';
import { subtitleLanguageNames, t, type SubtitleSettings as Settings } from '@iptv/shared';
import { appContext } from '../../appContext';
import { Modal } from '../../components/Modal';

/**
 * Account menu → App → Automatic subtitles (D-111, issue #103), same as the TV app: OpenSubtitles.com downloads a
 * subtitle when a movie or episode starts and none of its own is in a preferred language. Saved on this device.
 */
export function SubtitleSettings({ onClose }: { onClose(): void }) {
  const [draft, setDraft] = useState<Settings>(appContext.subtitles.settings.getState().settings);
  const set = (patch: Partial<Settings>) => setDraft((current) => ({ ...current, ...patch }));
  const toggleLanguage = (code: string) =>
    set({ languages: draft.languages.includes(code) ? draft.languages.filter((c) => c !== code) : [...draft.languages, code] });
  const save = () => {
    void appContext.subtitles.settings.getState().save({ ...draft, apiKey: draft.apiKey.trim(), username: draft.username.trim() });
    onClose();
  };
  const title = t('Automatic subtitles');

  return (
    <Modal label={title} onClose={onClose}>
      <div className="profile-editor" style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <p className="muted" style={{ margin: 0 }}>
          {t(
            'When a movie or episode starts without subtitles in one of your languages, one is downloaded from OpenSubtitles.com and turned on. It needs an API key (free at opensubtitles.com, under API consumers). Without an OpenSubtitles account, 5 subtitles a day can be downloaded.',
          )}
        </p>
        <label className="checkbox">
          <input type="checkbox" checked={draft.enabled} onChange={() => set({ enabled: !draft.enabled })} /> {t('On')}
        </label>
        <label className="field">
          <span className="muted">{t('API key')}</span>
          <input className="input" value={draft.apiKey} onChange={(e) => set({ apiKey: e.target.value })} autoComplete="off" />
        </label>
        <label className="field">
          <span className="muted">{t('OpenSubtitles username (optional)')}</span>
          <input className="input" value={draft.username} onChange={(e) => set({ username: e.target.value })} autoComplete="off" />
        </label>
        <label className="field">
          <span className="muted">{t('OpenSubtitles password (optional)')}</span>
          <input
            className="input"
            type="password"
            value={draft.password}
            onChange={(e) => set({ password: e.target.value })}
            autoComplete="off"
          />
        </label>
        <p className="muted" style={{ margin: 0 }}>
          {t('Languages, in order of preference:')}
        </p>
        <div className="chips" role="group" aria-label={t('Languages, in order of preference:')}>
          {Object.entries(subtitleLanguageNames()).map(([code, name]) => {
            const rank = draft.languages.indexOf(code);
            return (
              <button
                key={code}
                type="button"
                aria-pressed={rank >= 0}
                className={`chip${rank >= 0 ? ' chip--active' : ''}`}
                onClick={() => toggleLanguage(code)}
              >
                {rank >= 0 ? `${rank + 1}. ${name}` : name}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" className="button" onClick={save}>
            {t('Save')}
          </button>
          <button type="button" className="button button--ghost" onClick={onClose}>
            {t('Cancel')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
