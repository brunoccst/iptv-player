import { useEffect, type RefObject } from 'react';

/**
 * Pauses the video when an audio output goes away (headphones unplugged, Bluetooth headset off), instead of carrying
 * on through the speakers, like the TV and phone apps (#83). The desktop app sees every output device; a browser
 * that hides them (no media permission) lists no ids, so nothing is ever "removed" and this does nothing there.
 */
export function usePauseOnAudioOutputLoss(videoRef: RefObject<HTMLVideoElement | null>): void {
  useEffect(() => {
    const devices = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;
    if (!devices?.enumerateDevices || !devices.addEventListener) return;
    let known = new Set<string>();
    let stopped = false;
    const outputs = async () =>
      new Set(
        (await devices.enumerateDevices())
          .filter((device) => device.kind === 'audiooutput' && device.deviceId && device.deviceId !== 'default')
          .map((device) => device.deviceId),
      );
    const onChange = async () => {
      const now = await outputs().catch(() => known);
      if (stopped) return;
      const lost = [...known].some((id) => !now.has(id));
      known = now;
      const video = videoRef.current;
      if (lost && video && !video.paused) video.pause();
    };
    void outputs()
      .then((now) => void (known = now))
      .catch(() => undefined);
    devices.addEventListener('devicechange', onChange);
    return () => {
      stopped = true;
      devices.removeEventListener('devicechange', onChange);
    };
  }, [videoRef]);
}
