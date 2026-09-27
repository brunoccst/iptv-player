import { stores } from '../../appContext';
import { buildInfo } from '../../buildInfo';
import { Modal } from '../../components/Modal';
import { appConfig } from '../../config';
import { desktop } from '../../desktop';
import { t, intlLocale } from '@iptv/shared';

/**
 * Account menu → App → About, like the TV app's (D-070, D-079): version, the commit and date it was built from, and how
 * it connects.
 */
export function AboutDialog({ onClose }: { onClose(): void }) {
  const connection = stores.connection?.getState();
  const rows: [string, string][] = [
    [t('App'), desktop ? t('Desktop app for {platform}', { platform: desktop.platform }) : t('Web player (browser)')],
    ...(desktop ? ([[t('Version'), desktop.version]] as [string, string][]) : []),
    [t('Built from'), buildInfo.commit ? buildInfo.commit.slice(0, 7) : t('a local build')],
    ...(buildInfo.date ? ([[t('Built on'), new Date(buildInfo.date).toLocaleString(intlLocale())]] as [string, string][]) : []),
    [
      t('Connection'),
      desktop && connection?.mode !== 'server'
        ? t('Directly to the IPTV provider')
        : t('My server ({address})', { address: connection?.serverUrl || appConfig.apiBaseUrl || t('this site') }),
    ],
  ];
  return (
    <Modal label={t('About')} onClose={onClose}>
      <div className="about" data-testid="about-dialog">
        <h2>{appConfig.appName}</h2>
        <dl className="about__rows">
          {rows.map(([label, value]) => (
            <div key={label} className="about__row">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {desktop ? (
          <button type="button" className="button button--accent" onClick={() => void desktop?.checkForUpdates()}>
            {t('Check for updates')}
          </button>
        ) : null}
        <button type="button" className="button button--ghost" onClick={onClose}>
          {t('Close')}
        </button>
      </div>
    </Modal>
  );
}
