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
});
