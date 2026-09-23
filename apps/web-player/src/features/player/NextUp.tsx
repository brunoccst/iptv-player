import { episodeLabel, type Episode } from '@iptv/shared';

interface NextUpProps {
  episode: Episode;
  secondsLeft: number;
  onPlayNow(): void;
  onDismiss(): void;
}

/** Countdown card shown during the last seconds of an episode. */
export function NextUp({ episode, secondsLeft, onPlayNow, onDismiss }: NextUpProps) {
  return (
    <div className="next-up" role="status" aria-live="polite">
      <p className="next-up__label">Next episode in {secondsLeft}</p>
      <p className="next-up__title">
        {episodeLabel(episode)} · {episode.title}
      </p>
      <div className="next-up__actions">
        <button type="button" className="button button--primary" onClick={onPlayNow}>Play Now</button>
        <button type="button" className="button button--secondary" onClick={onDismiss}>Cancel</button>
      </div>
    </div>
  );
}
