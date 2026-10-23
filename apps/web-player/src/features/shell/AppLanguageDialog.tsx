import { t, UI_LANGUAGES, useUiLanguage, type UiLanguage } from '@iptv/shared';
import { appContext } from '../../appContext';
import { Modal } from '../../components/Modal';

/** Picks the app's language; the whole app redraws in it. Kept for the open profile and as this device's default. */
export const chooseUiLanguage = (language: string) => void appContext.uiLanguage.choose(language as UiLanguage);

/**
 * Account menu → App → App language (D-084), like the TV app's: the language of the app's own words. Titles and
 * categories keep the provider's names.
 */
export function AppLanguageDialog({ onClose }: { onClose(): void }) {
  const language = useUiLanguage();
  return (
    <Modal label={t('App language')} onClose={onClose}>
      <div className="profile-editor" style={{ display: 'grid', gap: 12 }} data-testid="app-language">
        <h2 style={{ margin: 0 }}>{t('App language')}</h2>
        <p className="muted" style={{ margin: 0 }}>
          {t('Titles and categories keep the names your provider gives them.')}
        </p>
        {UI_LANGUAGES.map((option) => (
          <label key={option.id} className="checkbox">
            <input
              type="radio"
              name="app-language"
              checked={language === option.id}
              onChange={() => {
                onClose();
                chooseUiLanguage(option.id);
              }}
            />{' '}
            {option.name}
          </label>
        ))}
        <button type="button" className="button" onClick={onClose}>
          {t('Close')}
        </button>
      </div>
    </Modal>
  );
}
