import { stores } from '../../appContext';
import { buildInfo } from '../../buildInfo';
import { Modal } from '../../components/Modal';
import { appConfig } from '../../config';
import { desktop } from '../../desktop';

/**
 * Account menu → App → About, like the TV app's (D-070, D-079): version, the commit and date it was built from, and how
 * it connects.
 */
export function AboutDialog({ onClose }: { onClose(): void }) {
  const connection = stores.connection?.getState();
  const rows: [string, string][] = [
    ['App', desktop ? `Desktop app for ${desktop.platform}` : 'Web player (browser)'],
    ...(desktop ? ([['Version', desktop.version]] as [string, string][]) : []),
    ['Built from', buildInfo.commit ? buildInfo.commit.slice(0, 7) : 'a local build'],
    ...(buildInfo.date ? ([['Built on', new Date(buildInfo.date).toLocaleString()]] as [string, string][]) : []),
    [
      'Connection',
      desktop && connection?.mode !== 'server'
        ? 'Directly to the IPTV provider'
        : `My server (${connection?.serverUrl || appConfig.apiBaseUrl || 'this site'})`,
    ],
  ];
  return (
    <Modal label="About" onClose={onClose}>
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
            Check for updates
          </button>
        ) : null}
        <button type="button" className="button button--ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
