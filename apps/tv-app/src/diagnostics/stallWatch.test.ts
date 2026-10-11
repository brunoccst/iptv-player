import { AppState } from 'react-native';
import { appLog } from '@iptv/shared';
import { startStallWatch } from './stallWatch';

describe('startStallWatch', () => {
  afterEach(() => jest.useRealTimers());

  it('logs a busy JavaScript thread, not a regular tick', () => {
    jest.useFakeTimers();
    let time = 0;
    const warn = jest.spyOn(appLog, 'warn').mockImplementation(() => undefined);
    const stop = startStallWatch(() => time);
    time += 1000;
    jest.advanceTimersByTime(1000);
    expect(warn).not.toHaveBeenCalled();
    // The next tick ran 4.5 s late: something held the thread.
    time += 5500;
    jest.advanceTimersByTime(1000);
    expect(warn).toHaveBeenCalledWith('app', expect.stringContaining('busy for 4.5 s'));
    stop();
    warn.mockRestore();
  });

  it('does not count the time the app spent in the background (D-172)', () => {
    jest.useFakeTimers();
    let time = 0;
    let onChange: (() => void) | undefined;
    const listen = jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      onChange = handler as () => void;
      return { remove: () => undefined } as ReturnType<typeof AppState.addEventListener>;
    });
    const warn = jest.spyOn(appLog, 'warn').mockImplementation(() => undefined);
    const stop = startStallWatch(() => time);
    // 30 s on another input: no ticks meanwhile; coming back resets the clock before the next tick.
    time += 30_000;
    onChange?.();
    time += 1000;
    jest.advanceTimersByTime(1000);
    expect(warn).not.toHaveBeenCalled();
    stop();
    warn.mockRestore();
    listen.mockRestore();
  });
});
