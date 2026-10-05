import { useState } from 'react';
import { t } from '@iptv/shared';

/** An episode's length and plot: two lines, then "…"; a click shows all of it, another click folds it again (issue #160). */
export function EpisodePlot({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      className={open ? 'episode__plot episode__plot--toggle' : 'episode__plot episode__plot--toggle episode__plot--clamped'}
      aria-expanded={open}
      title={open ? t('Show less') : t('Show more')}
      onClick={() => setOpen((current) => !current)}
    >
      {text}
    </button>
  );
}
