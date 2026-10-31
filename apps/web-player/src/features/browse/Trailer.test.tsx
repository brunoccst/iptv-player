// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Trailer, trailerEvent } from '@iptv/screens/src/ui/Trailer.web';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** What the YouTube player in the frame posts to the page. */
const post = (frame: HTMLIFrameElement, data: unknown) =>
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', { data: JSON.stringify(data), origin: 'https://www.youtube-nocookie.com', source: frame.contentWindow }),
    );
  });

describe('hero trailer (issue #222)', () => {
  it('reads the YouTube player messages', () => {
    expect(trailerEvent('{"event":"onStateChange","info":1}')).toBe('playing');
    expect(trailerEvent({ event: 'infoDelivery', info: { playerState: 1 } })).toBe('playing');
    expect(trailerEvent('{"event":"onError","info":150}')).toBe('failed');
    expect(trailerEvent('{"event":"onStateChange","info":3}')).toBeNull();
    expect(trailerEvent('not json')).toBeNull();
  });

  it('loads out of sight after 3 s and fades in only once it plays', async () => {
    vi.useFakeTimers();
    const { container } = render(<Trailer youtubeId="abc" title="Big Movie" />);
    expect(container.querySelector('iframe')).toBeNull();
    await act(() => vi.advanceTimersByTime(3000));
    const frame = container.querySelector('iframe')!;
    expect(frame.src).toContain('enablejsapi=1');
    expect(frame.style.opacity).toBe('0');
    post(frame, { event: 'onStateChange', info: 1 });
    expect(frame.style.opacity).toBe('1');
  });

  it('a removed video, or one that never starts, leaves only the backdrop', async () => {
    vi.useFakeTimers();
    const removed = render(<Trailer youtubeId="gone" title="Old Movie" />);
    await act(() => vi.advanceTimersByTime(3000));
    post(removed.container.querySelector('iframe')!, { event: 'onError', info: 100 });
    expect(removed.container.querySelector('iframe')).toBeNull();

    const stuck = render(<Trailer youtubeId="slow" title="Slow Movie" />);
    await act(() => vi.advanceTimersByTime(3000));
    expect(stuck.container.querySelector('iframe')).not.toBeNull();
    await act(() => vi.advanceTimersByTime(15_000));
    expect(stuck.container.querySelector('iframe')).toBeNull();
  });
});
