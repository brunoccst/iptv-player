import type Hls from 'hls.js';
import type { VariantInfo } from '@iptv/shared';
import { t } from '@iptv/shared';

interface TracksMenuProps {
  hls: Hls | null;
  video: HTMLVideoElement | null;
  variants: VariantInfo[];
  currentStreamId: string;
  onVariant(variant: VariantInfo): void;
  onChange(): void;
}

/** Audio, subtitles and "Version / Stream Quality" choices. */
export function TracksMenu({ hls, video, variants, currentStreamId, onVariant, onChange }: TracksMenuProps) {
  const audio = hls?.audioTracks ?? [];
  const subtitles = hls?.subtitleTracks ?? [];
  const nativeText = video && !hls ? Array.from(video.textTracks) : [];

  const setSubtitle = (index: number) => {
    if (hls) {
      hls.subtitleDisplay = index >= 0;
      hls.subtitleTrack = index;
    } else {
      nativeText.forEach((track, i) => (track.mode = i === index ? 'showing' : 'disabled'));
    }
    onChange();
  };

  const activeSubtitle = hls ? hls.subtitleTrack : nativeText.findIndex((track) => track.mode === 'showing');
  const subtitleOptions = hls
    ? subtitles.map((track) => track.name || track.lang || t('Track {number}', { number: track.id }))
    : nativeText.map((track) => track.label || track.language);

  return (
    <div className="tracks" role="dialog" aria-label={t('Audio, subtitles and version')}>
      <div>
        <h3>{t('Audio')}</h3>
        {audio.length === 0 ? (
          <p className="muted">{t('Default')}</p>
        ) : (
          audio.map((track, index) => (
            <button
              key={track.id}
              type="button"
              className={`tracks__option${hls?.audioTrack === index ? ' tracks__option--active' : ''}`}
              onClick={() => {
                if (hls) hls.audioTrack = index;
                onChange();
              }}
            >
              {track.name || track.lang || t('Track {number}', { number: index + 1 })}
            </button>
          ))
        )}
      </div>
      <div>
        <h3>{t('Subtitles')}</h3>
        <button
          type="button"
          className={`tracks__option${activeSubtitle < 0 ? ' tracks__option--active' : ''}`}
          onClick={() => setSubtitle(-1)}
        >
          {t('Off')}
        </button>
        {subtitleOptions.map((name, index) => (
          <button
            key={`${name}-${index}`}
            type="button"
            className={`tracks__option${activeSubtitle === index ? ' tracks__option--active' : ''}`}
            onClick={() => setSubtitle(index)}
          >
            {name}
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
