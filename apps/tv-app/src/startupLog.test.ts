import { appLog } from '@iptv/shared';
import { nativeState } from '../test/tvMediaMock';
import { logStartup } from './startupLog';

describe('start-up log (D-113, #109)', () => {
  it('names the memory the app may use, and moves the last run’s native crash into the Log once', () => {
    nativeState.lastCrash = [
      '2026-09-29T11:39:12Z on thread mqt_native_modules',
      'java.lang.OutOfMemoryError: Failed to allocate a 107893264 byte allocation with 26038896 free bytes',
      '  at java.lang.StringFactory.newStringFromBytes(StringFactory.java:71)',
      '  at expo.modules.fetch.Response.bodyText(Response.kt:89)',
    ].join('\n');
    logStartup();
    const messages = appLog.entries().map((entry) => `${entry.level} ${entry.area}: ${entry.message}`);
    expect(messages).toContain(
      'info app: memory: Java heap 192 MB (20 MB used, standard 192 MB, large 512 MB), device RAM 1400 MB (500 MB free)',
    );
    const crash = messages.find((message) => message.startsWith('error crash:'))!;
    expect(crash).toContain(
      'the app stopped last time (out of memory): java.lang.OutOfMemoryError: Failed to allocate a 107893264 byte allocation',
    );
    expect(crash).toContain('at expo.modules.fetch.Response.bodyText(Response.kt:89)');

    const before = appLog.entries().length;
    logStartup();
    expect(appLog.entries().filter((entry) => entry.area === 'crash')).toHaveLength(1);
    expect(appLog.entries().length).toBe(before + 1);
  });
});
