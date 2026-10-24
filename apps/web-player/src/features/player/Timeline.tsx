import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { formatClock, t } from '@iptv/shared';
import { TimelineRail } from '@iptv/screens';
import '../browse/screenHost';
import type { FramePreview } from './frameGrabber';

interface TimelineProps {
  currentTime: number;
  duration: number;
  bufferedEnd: number;
  onSeek(time: number): void;
  /** Created lazily by the parent on first hover. */
  getPreview(): FramePreview | null;
}

const PREVIEW_WIDTH = 192;
const PREVIEW_HEIGHT = 108;

/** Seek bar: hover shows time + frame preview, click/drag seeks. The bar itself is the TV's (DECISIONS.md#d-218). */
export function Timeline({ currentTime, duration, bufferedEnd, onSeek, getPreview }: TimelineProps) {
  const bar = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [dragTime, setDragTime] = useState<number | null>(null);
  const valid = Number.isFinite(duration) && duration > 0;

  const timeAt = (clientX: number) => {
    const bounds = bar.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width)) * duration;
  };

  useEffect(() => {
    const preview = hover !== null ? getPreview() : null;
    if (!preview || hover === null) return;
    preview.onFrame((image) => {
      const context = canvas.current?.getContext('2d');
      try {
        context?.drawImage(image, 0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
      } catch {
        // Cross-origin frames without CORS headers taint the canvas; the time label still shows.
      }
    });
    preview.request(hover);
  }, [hover, getPreview]);

  if (!valid) return null;

  const onPointerMove = (event: PointerEvent) => {
    const time = timeAt(event.clientX);
    setHover(time);
    if (dragTime !== null) setDragTime(time);
  };
  const onPointerDown = (event: PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragTime(timeAt(event.clientX));
  };
  const onPointerUp = (event: PointerEvent) => {
    if (dragTime === null) return;
    onSeek(timeAt(event.clientX));
    setDragTime(null);
  };

  const shown = dragTime ?? currentTime;

  return (
    <div
      ref={bar}
      className="timeline"
      role="slider"
      tabIndex={0}
      aria-label={t('Seek')}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(shown)}
      aria-valuetext={t('{position} of {duration}', { position: formatClock(shown), duration: formatClock(duration) })}
      onPointerMove={onPointerMove}
      onPointerLeave={() => dragTime === null && setHover(null)}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <TimelineRail
        played={shown / duration}
        buffered={bufferedEnd / duration}
        hover={hover !== null ? hover / duration : null}
        state={dragTime !== null ? 'dragging' : hover !== null ? 'hover' : 'idle'}
        label={hover !== null ? formatClock(hover) : null}
        at={hover !== null ? hover / duration : undefined}
        frame={hover !== null ? <canvas ref={canvas} width={PREVIEW_WIDTH} height={PREVIEW_HEIGHT} className="timeline__frame" /> : null}
        frameWidth={PREVIEW_WIDTH}
      />
    </div>
  );
}
