// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { FrameGrabber } from './frameGrabber';

/** jsdom has no media pipeline: drive readyState and events by hand. */
function fakeVideo() {
  const video = document.createElement('video');
  let readyState = 0;
  let currentTime = 0;
  Object.defineProperty(video, 'readyState', { get: () => readyState });
  Object.defineProperty(video, 'currentTime', { get: () => currentTime, set: (value: number) => (currentTime = value) });
  vi.spyOn(video, 'load').mockImplementation(() => {});
  return {
    video,
    setReadyState: (value: number) => (readyState = value),
    get currentTime() {
      return currentTime;
    },
  };
}

describe('FrameGrabber', () => {
  it('waits for metadata before seeking, then runs only the latest request', () => {
    const fake = fakeVideo();
    const create = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementationOnce(() => fake.video);
    const grabber = new FrameGrabber({ engine: 'file', url: 'http://media/a.mp4' } as never);
    vi.mocked(document.createElement).mockImplementation(create);
    const frames: number[] = [];
    grabber.onFrame((video) => frames.push(video.currentTime));

    grabber.request(5);
    grabber.request(12);
    expect(fake.currentTime).toBe(0);

    fake.setReadyState(HTMLMediaElement.HAVE_METADATA);
    fake.video.dispatchEvent(new Event('loadedmetadata'));
    expect(fake.currentTime).toBe(12);

    grabber.request(20);
    fake.video.dispatchEvent(new Event('seeked'));
    expect(frames).toEqual([12]);
    expect(fake.currentTime).toBe(20);
    fake.video.dispatchEvent(new Event('seeked'));
    expect(frames).toEqual([12, 20]);
    grabber.destroy();
  });
});
