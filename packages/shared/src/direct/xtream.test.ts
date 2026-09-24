import { describe, expect, it } from 'vitest';
import { decodeMaybeBase64 } from './base64Text';
import { createXtreamClient, normalizeServerUrl } from './xtream';

const credentials = { serverUrl: 'http://panel.test:8080/', username: 'u s', password: 'p&w' };

/** Fake fetch: answers by `action` query parameter and records requested URLs. */
function panel(responses: Record<string, unknown>, status = 200) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    const action = new URL(url).searchParams.get('action') ?? 'login';
    return new Response(JSON.stringify(responses[action] ?? null), { status });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}

describe('normalizeServerUrl', () => {
  it.each([
    ['panel.test:8080', 'http://panel.test:8080/'],
    ['https://panel.test/sub/player_api.php', 'https://panel.test/sub/'],
    ['http://panel.test/get.php?username=a', 'http://panel.test/'],
    ['  http://panel.test//  ', 'http://panel.test/'],
  ])('%s → %s', (input, expected) => expect(normalizeServerUrl(input)).toBe(expected));

  it('rejects empty and non-http addresses', () => {
    expect(() => normalizeServerUrl(' ')).toThrow('required');
    expect(() => normalizeServerUrl('ftp://panel.test')).toThrow('http(s)');
  });
});

describe('createXtreamClient', () => {
  it('validates the account and sends credentials plus the User-Agent', async () => {
    const { fetch, calls } = panel({
      login: {
        user_info: { auth: 1, status: 'Active', exp_date: '1893456000', max_connections: '2', allowed_output_formats: ['m3u8', 'ts'] },
      },
    });
    const account = await createXtreamClient(credentials, { fetch, userAgent: 'VLC/3' }).validate();
    expect(account).toEqual({
      status: 'Active',
      expiresAt: '2030-01-01T00:00:00.000Z',
      maxConnections: 2,
      allowedOutputFormats: ['m3u8', 'ts'],
    });
    expect(calls[0]!.url).toBe('http://panel.test:8080/player_api.php?username=u%20s&password=p%26w');
    expect(calls[0]!.headers['User-Agent']).toBe('VLC/3');
  });

  it('maps rejected logins, inactive accounts and outages to the backend error codes', async () => {
    await expect(createXtreamClient(credentials, panel({ login: { user_info: { auth: 0 } } })).validate()).rejects.toMatchObject({
      code: 'invalid_provider_credentials',
    });
    await expect(
      createXtreamClient(credentials, panel({ login: { user_info: { auth: '1', status: 'Expired' } } })).validate(),
    ).rejects.toThrow("'Expired'");
    await expect(createXtreamClient(credentials, panel({}, 503)).movies()).rejects.toMatchObject({ code: 'provider_unavailable' });
    await expect(createXtreamClient(credentials, panel({}, 403)).movies()).rejects.toMatchObject({ code: 'provider_credentials_rejected' });
    const offline = (async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof globalThis.fetch;
    await expect(createXtreamClient(credentials, { fetch: offline }).movies()).rejects.toMatchObject({ code: 'provider_unavailable' });
  });

  it('reads mixed string/number fields and skips items without ids', async () => {
    const { fetch, calls } = panel({
      get_vod_streams: [
        { stream_id: 7, name: ' Film ', category_id: 3, stream_icon: '', rating: '7.5', added: '1700000000', container_extension: 'mkv' },
        { name: 'no id' },
      ],
      get_live_streams: [{ stream_id: '9', name: 'News', num: '4', epg_channel_id: 'news.uk', tv_archive: 1 }],
      get_vod_categories: [{ category_id: 1, category_name: 'Action' }, { category_name: 'broken' }],
    });
    const client = createXtreamClient(credentials, { fetch });
    expect(await client.movies('3')).toEqual([
      {
        id: '7',
        name: 'Film',
        categoryId: '3',
        posterUrl: null,
        rating: 7.5,
        addedAt: '2023-11-14T22:13:20.000Z',
        containerExtension: 'mkv',
      },
    ]);
    expect(calls[0]!.url).toContain('action=get_vod_streams&category_id=3');
    expect(await client.liveChannels()).toEqual([
      { id: '9', name: 'News', categoryId: null, number: 4, logoUrl: null, epgChannelId: 'news.uk', hasCatchup: true },
    ]);
    expect(await client.categories('movie')).toEqual([{ id: '1', name: 'Action', kind: 'movie' }]);
  });

  it('reads movie details, tolerating `info: []`', async () => {
    const withInfo = panel({
      get_vod_info: {
        info: {
          movie_image: 'http://img/p.jpg',
          rating: 8,
          plot: 'Plot',
          actors: 'A, B',
          backdrop_path: 'http://img/b.jpg',
          duration_secs: '5400',
        },
        movie_data: { stream_id: '7', name: 'Film', container_extension: 'mp4' },
      },
    });
    const details = await createXtreamClient(credentials, withInfo).movie('7');
    expect(details).toMatchObject({ plot: 'Plot', cast: 'A, B', durationSeconds: 5400, backdropUrls: ['http://img/b.jpg'] });
    expect(details!.summary).toMatchObject({ id: '7', posterUrl: 'http://img/p.jpg', rating: 8 });

    const emptyInfo = panel({ get_vod_info: { info: [], movie_data: { stream_id: '7', name: 'Film' } } });
    expect(await createXtreamClient(credentials, emptyInfo).movie('7')).toMatchObject({ plot: null, backdropUrls: [] });
    expect(await createXtreamClient(credentials, panel({ get_vod_info: { movie_data: {} } })).movie('7')).toBeNull();
  });

  it.each([
    [
      'object',
      {
        '2': [{ id: 'e3', season: 2, episode_num: 1, title: 'S2E1' }],
        '1': [
          { id: 'e2', season: '1', episode_num: '2' },
          { id: 'e1', season: 1, episode_num: 1, info: { movie_image: 'still' } },
        ],
      },
    ],
    [
      'array',
      [
        [
          { id: 'e2', season: '1', episode_num: '2' },
          { id: 'e1', season: 1, episode_num: 1, info: { movie_image: 'still' } },
        ],
        [{ id: 'e3', season: 2, episode_num: 1, title: 'S2E1' }],
      ],
    ],
  ])('reads series episodes given as an %s, sorted and grouped by season', async (_shape, episodes) => {
    const { fetch } = panel({
      get_series_info: {
        info: { name: 'Show', cover: 'c.jpg', backdrop_path: ['b1', ' '] },
        seasons: [
          { season_number: 1, name: 'First', cover_big: 'big1' },
          { season_number: 3, name: 'Empty' },
        ],
        episodes,
      },
    });
    const details = await createXtreamClient(credentials, { fetch }).seriesDetails('55');
    expect(details!.summary).toMatchObject({ id: '55', name: 'Show', posterUrl: 'c.jpg' });
    expect(details!.backdropUrls).toEqual(['b1']);
    expect(
      details!.seasons.map((season) => [season.number, season.name, season.coverUrl, season.episodes.map((episode) => episode.id)]),
    ).toEqual([
      [1, 'First', 'big1', ['e1', 'e2']],
      [2, 'Season 2', null, ['e3']],
    ]);
    expect(details!.seasons[0]!.episodes[0]!.stillUrl).toBe('still');
  });

  it('decodes base64 short-EPG titles and drops broken programmes', async () => {
    const { fetch } = panel({
      get_short_epg: {
        epg_listings: [
          { title: 'TmV3cyBhdCBTaXg=', description: 'VG9kYXk=', start_timestamp: '1700000000', stop_timestamp: '1700001800' },
          { title: 'Plain title!', start_timestamp: '1700001800', stop_timestamp: '1700003600' },
          { title: 'eA==', start_timestamp: '1700003600', stop_timestamp: '1700003600' },
        ],
      },
    });
    expect(await createXtreamClient(credentials, { fetch }).shortEpg('9', 4)).toEqual([
      { title: 'News at Six', description: 'Today', start: '2023-11-14T22:13:20.000Z', end: '2023-11-14T22:43:20.000Z' },
      { title: 'Plain title!', description: null, start: '2023-11-14T22:43:20.000Z', end: '2023-11-14T23:13:20.000Z' },
    ]);
  });

  it('builds direct playback URLs with escaped credentials and a live format the account allows', () => {
    const client = createXtreamClient(credentials);
    expect(client.playbackUrl('movie', '7', '.MKV', null)).toEqual({
      url: 'http://panel.test:8080/movie/u%20s/p%26w/7.mkv',
      container: 'mkv',
      isLive: false,
    });
    expect(client.playbackUrl('episode', 'e1', 'bad/ext', null).url).toBe('http://panel.test:8080/series/u%20s/p%26w/e1.mp4');
    const tsOnly = { status: 'Active', expiresAt: null, maxConnections: 1, allowedOutputFormats: ['ts'] };
    expect(client.playbackUrl('live', '9', null, tsOnly)).toMatchObject({ container: 'ts', isLive: true });
    expect(client.playbackUrl('live', '9', null, null).container).toBe('m3u8');
  });
});

describe('provider replies', () => {
  const reply = (body: string, status = 200) => (async () => new Response(body, { status })) as unknown as typeof globalThis.fetch;

  it('accepts JSON with a byte-order mark or padding', async () => {
    const body = '\uFEFF  {"user_info":{"auth":1,"status":"Active"}}\n';
    expect(await createXtreamClient(credentials, { fetch: reply(body) }).validate()).toMatchObject({ status: 'Active' });
  });

  it('explains what went wrong', async () => {
    await expect(createXtreamClient(credentials, { fetch: reply('<html>Blocked by firewall</html>') }).validate()).rejects.toThrow(
      `panel.test:8080 sent a reply that is not JSON for 'login': "<html>Blocked by firewall</html>".`,
    );
    await expect(createXtreamClient(credentials, { fetch: reply('', 512) }).validate()).rejects.toThrow(
      'panel.test:8080 answered HTTP 512',
    );
    const hang = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) =>
        init?.signal?.addEventListener('abort', () => reject(new Error('Aborted'))),
      )) as unknown as typeof globalThis.fetch;
    await expect(createXtreamClient(credentials, { fetch: hang, timeoutMs: 10 }).validate()).rejects.toThrow(
      'No answer from panel.test:8080 after 0 s.',
    );
  });
});

describe('decodeMaybeBase64', () => {
  it.each([
    ['TmV3cw==', 'News'],
    ['News', 'News'],
    ['Q2Fmw6k=', 'Café'],
    ['/w==', '/w=='],
    ['AAEC', 'AAEC'],
  ])('%s → %s', (input, expected) => expect(decodeMaybeBase64(input)).toBe(expected));
});
