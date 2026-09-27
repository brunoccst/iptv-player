import { useState } from 'react';
import { appLog, t } from '@iptv/shared';
import { stores } from '../../appContext';
import { Modal } from '../../components/Modal';
import { appConfig } from '../../config';
import { desktop } from '../../desktop';

const PREVIEW_LINES = 150;

/**
 * Account menu → App → Log: the diagnostics log, like the TV app's Log screen (D-079). The TV shares it through the
 * Android share sheet; here it is copied or saved as a text file. Usernames and passwords are masked.
 */
export function LogDialog({ onClose }: { onClose(): void }) {
  const [, refresh] = useState(0);
  const [copied, setCopied] = useState(false);
  const entries = appLog.entries();

  const exportText = () => {
    const connection = stores.connection?.getState();
    const { text, lines, omitted } = appLog.shareText(Number.MAX_SAFE_INTEGER);
    return [
      `${appConfig.appName} diagnostics log`,
      `Saved ${new Date().toISOString()} · ${desktop ? `desktop ${desktop.version} (${desktop.platform})` : 'web'} · mode ${connection?.mode ?? 'server'}`,
      `${lines} lines${omitted ? `, ${omitted} older left out` : ''}; repeats folded (credentials masked)`,
      '',
      text,
    ].join('\n');
  };
  const copy = async () => {
    await navigator.clipboard.writeText(exportText());
    setCopied(true);
  };
  const save = () => {
    const url = URL.createObjectURL(new Blob([exportText()], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${appConfig.appSlug}-log-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal label={t('Log')} onClose={onClose}>
      <div className="log" data-testid="log-dialog">
        <h2>{t('Log')}</h2>
        <p className="muted">{t('Send this to support when something goes wrong. Usernames and passwords are hidden.')}</p>
        <div className="log__actions">
          <button type="button" className="button button--accent" onClick={save}>
            {t('Save log')}
          </button>
          <button type="button" className="button" onClick={() => void copy()}>
            {copied ? t('Copied') : t('Copy log')}
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => {
              appLog.clear();
              refresh((n) => n + 1);
            }}
          >
            {t('Clear log')}
          </button>
        </div>
        <pre className="log__lines">
          {entries.length === 0
            ? t('Nothing logged yet.')
            : entries
                .slice(-PREVIEW_LINES)
                .map(
                  (entry) =>
                    `${entry.at.slice(11, 19)} ${entry.level === 'info' ? '' : `${entry.level.toUpperCase()} `}[${entry.area}] ${entry.message}`,
                )
                .join('\n')}
        </pre>
      </div>
    </Modal>
  );
}
