import { describe, expect, it } from 'vitest';
import { describeProbe, probeHint, probeMessage, probeStream } from './probe';

const URL_ = 'http://p.example:80/series/bob/s3cret/715092.mp4';
const answer = (body: string | Uint8Array, init: ResponseInit & { url?: string } = {}) =>
  (async (_url: string, options?: RequestInit) => {
    expect(new Headers(options?.headers).get('Range')).toBe('bytes=0-2047');
    const response = new Response(body as BodyInit, init);
    Object.defineProperty(response, 'url', { value: init.url ?? URL_ });
    return response;
  }) as unknown as typeof fetch;

describe('what the provider sent instead of a video (D-074)', () => {
  it('reads an error page as one line, masks the credentials and recognises "max connections"', async () => {
    const probe = await probeStream(URL_, {
      userAgent: 'VLC/3.0.21',
      fetch: answer('<html><body><h1>Max connections reached</h1>\n<p>user bob, pass s3cret</p></body></html>', {
        headers: { 'content-type': 'text/html' },
        url: 'http://cdn.example/x',
      }),
    });
    expect(probe.text).toBe('Max connections reached user ***, pass ***');
    expect(describeProbe(probe)).toBe('HTTP 200, text/html, 87 bytes from cdn.example: "Max connections reached user ***, pass ***"');
    expect(probeHint(probe)).toBe('connections');
    expect(probeMessage('connections')).toMatch(/connections of the account are in use/);
  });

  it('recognises a missing file, an empty answer and a refusal', async () => {
    expect(probeHint(await probeStream(URL_, { fetch: answer('File not found', { status: 404 }) }))).toBe('not-found');
    expect(probeHint(await probeStream(URL_, { fetch: answer('') }))).toBe('empty');
    expect(probeHint(await probeStream(URL_, { fetch: answer('nope', { status: 403 }) }))).toBe('refused');
    expect(probeHint(await probeStream(URL_, { fetch: answer('Your subscription has expired') }))).toBe('expired');
  });

  it('shows the first bytes of binary answers and does not read huge ones', async () => {
    const bytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    const probe = await probeStream(URL_, { fetch: answer(bytes, { headers: { 'content-type': 'video/mp4' } }) });
    expect(probe.hex).toBe('1a 45 df a3 00 01 02 03 04 05 06 07 08 09 0a 0b');
    expect(probeHint(probe)).toBeNull();
    const big = await probeStream(URL_, { fetch: answer('x', { headers: { 'content-length': '900000000' } }) });
    expect(big.text).toBeNull();
    expect(describeProbe(big)).toBe('HTTP 200, text/plain;charset=UTF-8, 900000000 bytes from p.example');
  });

  it('never throws: a failed request is described', async () => {
    const failing = (async () => {
      throw new Error('Network request failed');
    }) as unknown as typeof fetch;
    const probe = await probeStream(URL_, { fetch: failing });
    expect(describeProbe(probe)).toBe('no answer (Network request failed)');
    expect(probeHint(probe)).toBeNull();
  });
});
