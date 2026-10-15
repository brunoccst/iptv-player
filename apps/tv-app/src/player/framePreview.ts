import { useCallback, useEffect, useRef, useState } from 'react';
import { TvMedia } from '../../modules/tv-media';

/** Width of the decoded frames, in px. */
const FRAME_WIDTH = 320;

export interface PreviewFrame {
  /** Seconds the frame was asked for (the picture is the nearest key frame). */
  time: number;
  /** JPEG data URI. */
  image: string;
}

/**
 * Progress bar preview frames (D-180): `request` asks for the frame at a time; while one is decoding, only the latest
 * request waits, so a fast run of presses or a drag never queues up. `uri` null: no previews (a download, HLS, live, or
 * no connection to spare). `stop` lets go of the stream's second connection.
 */
export function useFramePreview(uri: string | null) {
  const [frame, setFrame] = useState<PreviewFrame | null>(null);
  const state = useRef({ uri, busy: false, pending: null as number | null, round: 0 });
  state.current.uri = uri;

  const stop = useCallback(() => {
    state.current.pending = null;
    // A frame still decoding belongs to the preview that ended.
    state.current.round++;
    setFrame(null);
    TvMedia.releasePreview();
  }, []);

  useEffect(() => {
    setFrame(null);
    if (!uri) return;
    const current = state.current;
    return () => {
      current.pending = null;
      TvMedia.releasePreview();
    };
  }, [uri]);

  const next = useCallback(() => {
    const current = state.current;
    const time = current.pending;
    const asked = current.uri;
    const round = current.round;
    if (time === null || !asked) return;
    current.pending = null;
    current.busy = true;
    void TvMedia.previewFrame(asked, Math.round(time * 1000), FRAME_WIDTH)
      .then((image) => {
        if (image && state.current.uri === asked && state.current.round === round) setFrame({ time, image });
      })
      .catch(() => undefined)
      .finally(() => {
        current.busy = false;
        next();
      });
  }, []);

  const request = useCallback(
    (time: number) => {
      if (!state.current.uri) return;
      state.current.pending = time;
      if (!state.current.busy) next();
    },
    [next],
  );

  return { frame: uri ? frame : null, request, stop };
}
