import { useEffect, useState } from 'react';
import { t } from '@iptv/shared';
import { desktop, type UpdateProgress as Progress } from '../../desktop';

/**
 * Desktop app (D-166): after "Install now", the update's download with its percentage, at the top right of any page,
 * until the app asks to restart. The main process (apps/desktop/main.mjs) sends the progress.
 */
export function UpdateProgress() {
  const [progress, setProgress] = useState<Progress | null>(null);
  useEffect(() => desktop?.onUpdateProgress?.(setProgress), []);
  if (!progress) return null;
  const percent = Math.floor(progress.percent);
  return (
    <div className="banner banner--update" role="status" data-testid="update-progress">
      <span>
        {t('Downloading version {version}…', { version: progress.version })} {percent}%
      </span>
      <span className="banner__track" aria-hidden="true">
        <span className="banner__value" style={{ width: `${percent}%` }} />
      </span>
    </div>
  );
}
