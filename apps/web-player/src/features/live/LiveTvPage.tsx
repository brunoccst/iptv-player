import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  EPG_SLOT_MS,
  floorToSlot,
  formatGuideTime,
  formatProgrammeTime,
  guideSlots,
  layoutGuideRow,
  nowFraction,
  programmeAt,
  programmeProgress,
  useEpgGuide,
  useNow,
  type EpgListing,
  type LiveChannel,
} from '@iptv/shared';
import { stores, uiStore } from '../../appContext';
import { Spinner } from '../../components/Spinner';
import { useCatalog } from '../../hooks/stores';
import { errorText } from '../../ui/errorText';

const HOURS = 3;
const STEP_MS = 2 * EPG_SLOT_MS;
/** The backend caches now −3 h … +48 h (DECISIONS.md#d-031). */
const MIN_BACK_MS = 3 * 3600_000;
const MAX_AHEAD_MS = 45 * 3600_000;

interface Selection {
  channel: LiveChannel;
  programme: EpgListing;
}

function play(channel: LiveChannel, programme: EpgListing | null) {
  uiStore.getState().play({
    kind: 'live',
    streamId: channel.id,
    container: 'm3u8',
    title: channel.name,
    subtitle: programme?.title ?? null,
    posterUrl: channel.logoUrl,
  });
}

/** Live TV guide: categories, a 3-hour channel × time grid and programme details. See DECISIONS.md#d-032. */
export function LiveTvPage() {
  const categories = useCatalog((s) => s.categories.live?.data ?? []);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const now = useNow();
  const [from, setFrom] = useState(() => floorToSlot(Date.now()));
  const [pages, setPages] = useState(1);
  const [selected, setSelected] = useState<Selection | null>(null);
  const guide = useEpgGuide(stores.epg, { categoryId, from, hours: HOURS }, pages);
  const to = from + HOURS * 3600_000;
  const nowSlot = floorToSlot(now);

  useEffect(() => {
    void stores.catalog.getState().loadCategories('live');
  }, []);

  const chooseCategory = (id: string | null) => {
    setCategoryId(id);
    setPages(1);
    setSelected(null);
  };

  return (
    <div className="page">
      <h1 className="page__title">Live TV</h1>
      <div className="live">
        <nav className="live__categories" aria-label="Channel categories">
          <button
            type="button"
            className={`live__category${categoryId === null ? ' live__category--active' : ''}`}
            onClick={() => chooseCategory(null)}
          >
            All channels
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={`live__category${categoryId === category.id ? ' live__category--active' : ''}`}
              onClick={() => chooseCategory(category.id)}
            >
              {category.name}
            </button>
          ))}
        </nav>

        <div className="guide-page">
          <div className="guide-toolbar">
            <button
              type="button"
              className="button button--ghost"
              disabled={from - STEP_MS < nowSlot - MIN_BACK_MS}
              onClick={() => setFrom(from - STEP_MS)}
            >
              ◀ Earlier
            </button>
            <button type="button" className="button button--secondary" disabled={from === nowSlot} onClick={() => setFrom(nowSlot)}>
              Now
            </button>
            <button
              type="button"
              className="button button--ghost"
              disabled={from + STEP_MS > nowSlot + MAX_AHEAD_MS}
              onClick={() => setFrom(from + STEP_MS)}
            >
              Later ▶
            </button>
            <span className="muted guide-toolbar__day">
              {new Date(from).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </span>
          </div>

          {guide.status === 'refreshing' ? (
            <p className="banner" role="status">
              <Spinner small /> Downloading the TV guide…
            </p>
          ) : null}
          {guide.status === 'unavailable' ? (
            <p className="banner" role="status">
              Your provider has no full TV guide. Showing what is available per channel.
            </p>
          ) : null}
          {guide.error ? (
            <p className="error-text" role="alert">
              {errorText(guide.error)}
            </p>
          ) : null}

          {selected ? <ProgrammeDetails selection={selected} now={now} onClose={() => setSelected(null)} /> : null}

          {guide.loading && guide.rows.length === 0 ? (
            <Spinner />
          ) : (
            <GuideGrid rows={guide.rows} from={from} to={to} now={now} selected={selected} onSelect={setSelected} />
          )}

          {guide.rows.length < guide.totalChannels ? (
            <button
              type="button"
              className="button button--secondary guide__more"
              disabled={guide.loading}
              onClick={() => setPages(pages + 1)}
            >
              More channels ({guide.rows.length} of {guide.totalChannels})
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface GuideGridProps {
  rows: { channel: LiveChannel; programmes: EpgListing[] }[];
  from: number;
  to: number;
  now: number;
  selected: Selection | null;
  onSelect(selection: Selection): void;
}

function GuideGrid({ rows, from, to, now, selected, onSelect }: GuideGridProps) {
  const slots = useMemo(() => guideSlots(from, to), [from, to]);
  const nowAt = nowFraction(now, from, to);
  const pct = (fraction: number) => `${(fraction * 100).toFixed(4)}%`;

  return (
    <div className="guide" role="region" aria-label="TV guide">
      <div className="guide__row guide__row--header">
        <span className="guide__corner" aria-hidden="true" />
        <div className="guide__timeline" aria-hidden="true">
          {slots.map((slot) => (
            <span key={slot} className="guide__slot" style={{ left: pct((slot - from) / (to - from)) }}>
              {formatGuideTime(slot)}
            </span>
          ))}
        </div>
      </div>
      <div className="guide__body" style={nowAt == null ? undefined : ({ '--guide-now': nowAt } as CSSProperties)}>
        {nowAt == null ? null : <span className="guide__now" aria-hidden="true" />}
        {rows.map(({ channel, programmes }) => (
          <div key={channel.id} className="guide__row">
            <button
              type="button"
              className="guide__channel"
              onClick={() => play(channel, programmeAt(programmes, now))}
              aria-label={`Watch ${channel.name}`}
            >
              {channel.logoUrl ? <img src={channel.logoUrl} alt="" loading="lazy" /> : <span className="guide__logo" />}
              <span className="guide__channel-name">
                {channel.number != null ? <span className="muted">{channel.number} </span> : null}
                {channel.name}
              </span>
            </button>
            <div className="guide__timeline">
              {layoutGuideRow(programmes, from, to).map((cell) => {
                const style = { left: pct(cell.left), width: pct(cell.width) };
                if (!cell.programme) {
                  return (
                    <span key={`gap-${cell.startMs}`} className="guide__gap" style={style}>
                      {programmes.length ? '' : 'No guide information'}
                    </span>
                  );
                }
                const programme = cell.programme;
                const onNow = cell.startMs <= now && now < Date.parse(programme.end);
                const past = Date.parse(programme.end) <= now;
                const isSelected = selected?.channel.id === channel.id && selected.programme.start === programme.start;
                return (
                  <button
                    key={programme.start}
                    type="button"
                    style={style}
                    aria-pressed={isSelected}
                    className={`guide__programme${onNow ? ' guide__programme--now' : ''}${past ? ' guide__programme--past' : ''}`}
                    aria-label={`${programme.title}, ${formatProgrammeTime(programme)}, ${channel.name}`}
                    onClick={() => onSelect({ channel, programme })}
                  >
                    <span className="guide__title">
                      {cell.clippedStart ? '‹ ' : ''}
                      {programme.title}
                    </span>
                    <span className="guide__time">{formatProgrammeTime(programme)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgrammeDetails({ selection, now, onClose }: { selection: Selection; now: number; onClose(): void }) {
  const { channel, programme } = selection;
  const onNow = Date.parse(programme.start) <= now && now < Date.parse(programme.end);
  return (
    <section className="guide-details" aria-label="Programme details">
      <div>
        <h2 className="guide-details__title">{programme.title}</h2>
        <p className="muted">
          {channel.name} · {formatProgrammeTime(programme)}
          {onNow ? ' · On now' : ''}
        </p>
        {onNow ? (
          <div className="guide-details__bar" aria-hidden="true">
            <span style={{ width: `${Math.round(programmeProgress(programme, now) * 100)}%` }} />
          </div>
        ) : null}
        {programme.description ? <p>{programme.description}</p> : null}
      </div>
      <div className="guide-details__actions">
        <button type="button" className="button button--primary" onClick={() => play(channel, onNow ? programme : null)}>
          {onNow ? 'Watch live' : 'Watch channel'}
        </button>
        <button type="button" className="button button--ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </section>
  );
}
