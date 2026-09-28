// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePauseOnAudioOutputLoss } from './audioOutput';

function fakeDevices(initial: string[]) {
  let ids = initial;
  const target = new EventTarget();
  const devices = {
    enumerateDevices: vi.fn(async () => ids.map((deviceId) => ({ deviceId, kind: 'audiooutput' }) as MediaDeviceInfo)),
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
  };
  Object.defineProperty(navigator, 'mediaDevices', { value: devices, configurable: true });
  return {
    set(next: string[]) {
      ids = next;
      target.dispatchEvent(new Event('devicechange'));
    },
  };
}

function playingVideo() {
  const video = { paused: false, pause: vi.fn(() => void (video.paused = true)) };
  return { current: video as unknown as HTMLVideoElement, video };
}

describe('usePauseOnAudioOutputLoss (#83)', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'mediaDevices');
  });

  it('pauses when the headphones go away, not when a device is added', async () => {
    const devices = fakeDevices(['default', 'speakers', 'headphones']);
    const { current, video } = playingVideo();
    renderHook(() => usePauseOnAudioOutputLoss({ current }));
    await waitFor(() => expect(navigator.mediaDevices.enumerateDevices).toHaveBeenCalled());
    await Promise.resolve();

    devices.set(['default', 'speakers', 'headphones', 'hdmi']);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(video.pause).not.toHaveBeenCalled();

    devices.set(['default', 'speakers', 'hdmi']);
    await waitFor(() => expect(video.pause).toHaveBeenCalledTimes(1));
  });

  it('does nothing when the browser hides the devices (empty ids)', async () => {
    const devices = fakeDevices(['', '']);
    const { current, video } = playingVideo();
    renderHook(() => usePauseOnAudioOutputLoss({ current }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    devices.set(['']);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(video.pause).not.toHaveBeenCalled();
  });
});
