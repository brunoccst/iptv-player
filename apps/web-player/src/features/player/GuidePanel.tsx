import { useState } from 'react';
import {
  floorToSlot,
  formatGuideTime,
  formatProgrammeTime,
  programmeAt,
  programmeProgress,
  useEpgGuide,
  useNow,
  type EpgListing,
  type LiveChannel,
} from '@iptv/shared';
import { stores } from '../../appContext';
import { useCatalog } from '../../hooks/stores';

/** Now and next are enough; the Live TV page has the full grid. */
const GUIDE_HOURS = 3;

/**
 * Guide over the playing channel (D-058 on TV, D-081 here): channels of the same category with what is on now and next,
 * over the still-playing video. Opened with the Guide button or G (↑/↓ keep the volume here); a click on a channel
 * switches to it; Escape, a click beside the panel or the button again close it.
 */
export function GuidePanel({
  channelId,
  categoryId,
  onSelect,
  onClose,
}: {
  channelId: string;
  categoryId: string | null;
  onSelect(channel: LiveChannel, programme: EpgListing | null): void;
  onClose(): void;
}) {
  const now = useNow();
  const [from] = useState(() => floorToSlot(Date.now()));
  const guide = useEpgGuide(stores.epg, { categoryId, from, hours: GUIDE_HOURS });
  const category = useCatalog((s) => s.categories.live?.data?.find((c) => c.id === categoryId)?.name);

  return (
    <div className="guide-panel" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="guide-panel__list" aria-label="Guide">
        <div className="guide-panel__header">
          <h2>{category ?? 'All channels'}</h2>
          <span className="muted">{formatGuideTime(now)}</span>
        </div>
        {guide.rows.length === 0 ? (
          <p className="muted">
            {guide.loading ? 'Loading the guide…' : guide.error ? 'The guide could not be loaded.' : 'No channels in this category.'}
          </p>
        ) : (
          guide.rows.map(({ channel, programmes }) => {
            const onNow = programmeAt(programmes, now);
            const next = programmes.find((p) => Date.parse(p.start) >= (onNow ? Date.parse(onNow.end) : now)) ?? null;
            const current = channel.id === channelId;
            return (
              <button
                key={channel.id}
                type="button"
                className={`guide-panel__row${current ? ' guide-panel__row--current' : ''}`}
                aria-current={current ? 'true' : undefined}
                aria-label={`${channel.name}${onNow ? `, now: ${onNow.title}` : ''}${current ? ', playing' : ''}`}
                onClick={() => onSelect(channel, onNow)}
                // The playing channel has the focus first, so the keyboard starts there.
                ref={current ? (element) => element?.focus({ preventScroll: false }) : undefined}
              >
                <span className="guide-panel__logo">
                  {channel.logoUrl ? <img src={channel.logoUrl} alt="" loading="lazy" /> : (channel.number ?? channel.name.charAt(0))}
                </span>
                <span className="guide-panel__info">
                  <strong>
                    {channel.number ? `${channel.number}  ` : ''}
                    {channel.name}
                    {current ? <span className="guide-panel__playing"> ● Playing</span> : null}
                  </strong>
                  {onNow ? (
                    <>
                      <span>
                        {formatProgrammeTime(onNow)} · {onNow.title}
                      </span>
                      <span className="guide-panel__track">
                        <span style={{ width: `${Math.round(programmeProgress(onNow, now) * 100)}%` }} />
                      </span>
                    </>
                  ) : (
                    <span className="muted">No guide information</span>
                  )}
                  {next ? (
                    <span className="muted">
                      Next {formatGuideTime(Date.parse(next.start))} · {next.title}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })
        )}
      </aside>
    </div>
  );
}
