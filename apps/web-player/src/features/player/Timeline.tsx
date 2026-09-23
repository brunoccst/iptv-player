import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { formatClock } from '@iptv/shared';
import type { FrameGrabber } from './frameGrabber';

interface TimelineProps {
  currentTime: number;
  duration: number;
  bufferedEnd: number;
  onSeek(time: number): void;
  /** Created lazily by the parent on first hover. */
  getPreview(): FrameGrabber | null;
}

const PREVIEW_WIDTH = 192;
const PREVIEW_HEIGHT = 108;

/** Seek bar: hover shows time + frame preview, click/drag seeks. */
export function Timeline({ currentTime, duration, bufferedEnd, onSeek, getPreview }: TimelineProps) {
  const rail = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [dragTime, setDragTime] = useState<number | null>(null);
  const valid = Number.isFinite(duration) && duration > 0;

  const timeAt = (clientX: number) => {
    const bounds = rail.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width)) * duration;
  };

  useEffect(() => {
    const preview = hover !== null ? getPreview() : null;
    if (!preview || hover === null) return;
    preview.onFrame((video) => {
      const context = canvas.current?.getContext('2d');
      try {
        context?.drawImage(video, 0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
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
  const percent = (value: number) => `${(Math.min(value, duration) / duration) * 100}%`;

  return (
    <div className="timeline" role="slider" tabIndex={0} aria-label="Seek" aria-valuemin={0} aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(shown)} aria-valuetext={`${formatClock(shown)} of ${formatClock(duration)}`}
      onPointerMove={onPointerMove} onPointerLeave={() => dragTime === null && setHover(null)} onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}>
      <div className="timeline__rail" ref={rail}>
        <div className="timeline__buffered" style={{ width: percent(bufferedEnd) }} />
        {hover !== null ? <div className="timeline__hover-fill" style={{ width: percent(hover) }} /> : null}
        <div className="timeline__played" style={{ width: percent(shown) }} />
        <div className="timeline__thumb" style={{ left: percent(shown) }} />
      </div>
      {hover !== null ? (
        <div className="timeline__preview" style={{ left: percent(hover) }} data-testid="timeline-preview">
          <canvas ref={canvas} width={PREVIEW_WIDTH} height={PREVIEW_HEIGHT} />
          <span>{formatClock(hover)}</span>
        </div>
      ) : null}
    </div>
  );
}
