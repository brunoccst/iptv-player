import type Hls from 'hls.js';
import type { SubtitleChoice, TrackChoice, VariantInfo } from '@iptv/shared';
import { t, trackLabel } from '@iptv/shared';
import { activeSubtitle, audioTracks, choiceOf, showSubtitle, subtitleTracks } from './tracks';

interface TracksMenuProps {
  hls: Hls | null;
  video: HTMLVideoElement | null;
  variants: VariantInfo[];
  currentStreamId: string;
  onVariant(variant: VariantInfo): void;
  /** Picks kept as what every movie and series starts with (D-087). */
  onSubtitle(choice: SubtitleChoice): void;
  onAudio(choice: TrackChoice): void;
  onChange(): void;
}

/** Audio, subtitles and "Version / Stream Quality" choices. */
export function TracksMenu({ hls, video, variants, currentStreamId, onVariant, onSubtitle, onAudio, onChange }: TracksMenuProps) {
  const audio = audioTracks(hls);
  const subtitleOptions = subtitleTracks(hls, video);
  const current = activeSubtitle(hls, video);

  const setSubtitle = (index: number) => {
    showSubtitle(hls, video, index);
    onSubtitle(choiceOf(subtitleOptions, index));
    onChange();
  };

  return (
    <div className="tracks" role="dialog" aria-label={t('Audio, subtitles and version')}>
      <div>
        <h3>{t('Audio')}</h3>
        {audio.length === 0 ? (
          <p className="muted">{t('Default')}</p>
        ) : (
          audio.map((track, index) => (
            <button
              key={`${track.label}-${index}`}
              type="button"
              className={`tracks__option${hls?.audioTrack === index ? ' tracks__option--active' : ''}`}
              onClick={() => {
                if (hls) hls.audioTrack = index;
                onAudio(track);
                onChange();
              }}
            >
              {trackLabel(track)}
            </button>
          ))
        )}
      </div>
      <div>
        <h3>{t('Subtitles')}</h3>
        <button type="button" className={`tracks__option${current < 0 ? ' tracks__option--active' : ''}`} onClick={() => setSubtitle(-1)}>
          {t('Off')}
        </button>
        {subtitleOptions.map((track, index) => (
          <button
            key={`${track.label}-${index}`}
            type="button"
            className={`tracks__option${current === index ? ' tracks__option--active' : ''}`}
            onClick={() => setSubtitle(index)}
          >
            {trackLabel(track)}
          </button>
        ))}
      </div>
      {variants.length > 1 ? (
        <div>
          <h3>{t('Version / Stream Quality')}</h3>
          {variants.map((variant) => (
            <button
              key={variant.streamId}
              type="button"
              className={`tracks__option${variant.streamId === currentStreamId ? ' tracks__option--active' : ''}`}
              onClick={() => onVariant(variant)}
            >
              {variant.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
