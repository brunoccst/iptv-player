import { TvMedia } from '../modules/tv-media';
import { installSecureRandom } from './secureRandom';

describe('installSecureRandom (issue #233)', () => {
  const original = globalThis.crypto;
  afterEach(() => Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true, writable: true }));

  it('fills crypto.getRandomValues from the native SecureRandom when the engine has none', () => {
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true });
    const randomKey = jest
      .spyOn(TvMedia, 'randomKey')
      .mockReturnValue(btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, i) => i))));
    installSecureRandom();
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(40));
    expect(Array.from(bytes.slice(30, 34))).toEqual([30, 31, 0, 1]);
    expect(randomKey).toHaveBeenCalledTimes(2);
    randomKey.mockRestore();
  });

  it('keeps an engine’s own Web Crypto', () => {
    const own = original.getRandomValues;
    installSecureRandom();
    expect(globalThis.crypto.getRandomValues).toBe(own);
  });
});
