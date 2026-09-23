import type Hls from 'hls.js';
import type { VariantInfo } from '@iptv/shared';

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
  const subtitleOptions = hls ? subtitles.map((t) => t.name || t.lang || `Track ${t.id}`) : nativeText.map((t) => t.label || t.language);

  return (
    <div className="tracks" role="dialog" aria-label="Audio, subtitles and version">
      <div>
        <h3>Audio</h3>
        {audio.length === 0 ? <p className="muted">Default</p> : audio.map((track, index) => (
          <button key={track.id} type="button" className={`tracks__option${hls?.audioTrack === index ? ' tracks__option--active' : ''}`}
            onClick={() => { if (hls) hls.audioTrack = index; onChange(); }}>
            {track.name || track.lang || `Track ${index + 1}`}
          </button>
        ))}
      </div>
      <div>
        <h3>Subtitles</h3>
        <button type="button" className={`tracks__option${activeSubtitle < 0 ? ' tracks__option--active' : ''}`} onClick={() => setSubtitle(-1)}>
          Off
        </button>
        {subtitleOptions.map((name, index) => (
          <button key={`${name}-${index}`} type="button" className={`tracks__option${activeSubtitle === index ? ' tracks__option--active' : ''}`}
            onClick={() => setSubtitle(index)}>
            {name}
          </button>
        ))}
      </div>
      {variants.length > 1 ? (
        <div>
          <h3>Version / Stream Quality</h3>
          {variants.map((variant) => (
            <button key={variant.streamId} type="button"
              className={`tracks__option${variant.streamId === currentStreamId ? ' tracks__option--active' : ''}`} onClick={() => onVariant(variant)}>
              {variant.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
