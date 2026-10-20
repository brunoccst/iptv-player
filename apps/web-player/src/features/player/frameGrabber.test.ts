// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { ConvertedFrames, FrameGrabber } from './frameGrabber';

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

describe('ConvertedFrames (issue #270)', () => {
  it("asks the app's FFmpeg for one picture at a time, the latest request next", async () => {
    const answers: ((jpeg: Uint8Array | null) => void)[] = [];
    const frame = vi.fn(() => new Promise<Uint8Array | null>((resolve) => answers.push(resolve)));
    const decode = vi.fn(async (jpeg: Uint8Array) => ({ jpeg }) as unknown as CanvasImageSource);
    const frames = new ConvertedFrames({ url: 'http://r/movie.mkv', hdr: true }, frame, decode);
    const shown: unknown[] = [];
    frames.onFrame((image) => shown.push(image));
    frames.request(5);
    frames.request(10);
    frames.request(20);
    expect(frame).toHaveBeenCalledTimes(1);
    expect(frame).toHaveBeenLastCalledWith({ url: 'http://r/movie.mkv', at: 5, hdr: true });
    answers[0]!(new Uint8Array([0xff, 0xd8]));
    await vi.waitFor(() => expect(frame).toHaveBeenCalledTimes(2));
    expect(frame).toHaveBeenLastCalledWith({ url: 'http://r/movie.mkv', at: 20, hdr: true });
    expect(shown).toEqual([{ jpeg: new Uint8Array([0xff, 0xd8]) }]);
    // No picture (FFmpeg failed): nothing drawn; destroyed: later answers are dropped.
    answers[1]!(null);
    frames.request(30);
    await vi.waitFor(() => expect(frame).toHaveBeenCalledTimes(3));
    frames.destroy();
    answers[2]!(new Uint8Array([1]));
    await Promise.resolve();
    expect(shown).toHaveLength(1);
  });
});
