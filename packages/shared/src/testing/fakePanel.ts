/** In-memory Xtream panel `fetch` for direct-mode tests. `offline()` makes every request fail like a dead network. */
export function createFakePanel() {
  const calls: string[] = [];
  let down = false;
  const nowSeconds = Math.floor(Date.UTC(2026, 0, 1, 20, 0) / 1000);

  const movies = [
    {
      stream_id: 101,
      name: 'EN - Big Test Movie (2020) [4K]',
      category_id: '11',
      rating: '8.1',
      container_extension: 'mkv',
      added: '1700000000',
      tmdb: '603',
    },
    { stream_id: 102, name: 'Big.Test.Movie.2020.1080p.WEB-DL', category_id: '10', container_extension: 'mp4' },
    { stream_id: 103, name: 'Another Film (2019) SUB ITA', category_id: '10', container_extension: 'mp4', added: '1800000000' },
  ];
  const series = [
    { series_id: 201, name: 'Test Series (2021)', category_id: '20', cover: 'http://panel/c.jpg', releaseDate: '2021-05-01' },
  ];
  const channels = [
    { stream_id: 1, name: 'News', num: 1, epg_channel_id: 'news' },
    { stream_id: 2, name: 'Broken guide', num: 2 },
    { stream_id: 3, name: 'Sport', num: 3 },
  ];
  const programme = (title: string, startOffset: number, minutes: number) => ({
    title: btoa(title),
    start_timestamp: String(nowSeconds + startOffset * 60),
    stop_timestamp: String(nowSeconds + (startOffset + minutes) * 60),
  });

  /** Full-guide programmes, minutes from now; `channel` is the guide id. */
  const guide = [
    { channel: 'NEWS', from: -30, to: 30, title: 'Evening News' },
    { channel: 'NEWS', from: 30, to: 90, title: 'Late News' },
    { channel: 'NEWS', from: -300, to: -240, title: 'Morning News' },
    { channel: 'NEWS', from: 60 * 30, to: 60 * 31, title: 'News in two days' },
    { channel: 'unknown', from: 0, to: 60, title: 'News on a channel the provider does not list' },
  ];

  let accountStatus = 'Active';
  let expDate: string | null = null;
  const answer = (params: URLSearchParams): unknown => {
    if (params.get('username') !== 'demo' || params.get('password') !== 'demo') return { user_info: { auth: 0 } };
    switch (params.get('action')) {
      case null:
        return {
          user_info: { auth: 1, status: accountStatus, exp_date: expDate, max_connections: '1', allowed_output_formats: ['m3u8', 'ts'] },
        };
      case 'get_vod_streams':
        return movies;
      case 'get_series':
        return series;
      case 'get_live_streams': {
        const categoryId = params.get('category_id');
        return categoryId ? channels.filter((channel) => (channel as { category_id?: string }).category_id === categoryId) : channels;
      }
      case 'get_vod_categories':
        return [{ category_id: '10', category_name: 'Movies' }];
      case 'get_vod_info':
        return { info: [], movie_data: movies.find((movie) => String(movie.stream_id) === params.get('vod_id')) ?? {} };
      case 'get_series_info':
        return params.get('series_id') === '201'
          ? {
              info: { name: 'Test Series (2021)', plot: 'A test.' },
              episodes: { '1': [{ id: '2011', episode_num: 1, title: 'Pilot', container_extension: 'mkv', season: 1 }] },
            }
          : [];
      case 'get_short_epg':
        if (params.get('stream_id') === '2') throw new Error('guide unavailable');
        return { epg_listings: [programme('Old show', -120, 60), programme('Evening News', 0, 30), programme('Late News', 30, 60)] };
      default:
        return [];
    }
  };

  /** The full guide (issue #119): channel ids in another case than the channel list, like real panels. */
  const xmltvTime = (seconds: number) => `${new Date(seconds * 1000).toISOString().replace(/[-:T]/g, '').slice(0, 14)} +0000`;
  const xmltv = () =>
    [
      '<?xml version="1.0" encoding="UTF-8"?><tv>',
      ...guide.map(
        (p) =>
          `<programme start="${xmltvTime(nowSeconds + p.from * 60)}" stop="${xmltvTime(nowSeconds + p.to * 60)}" channel="${p.channel}"><title>${p.title}</title></programme>`,
      ),
      '</tv>',
    ].join('\n');

  const fetch = (async (url: string) => {
    calls.push(url);
    if (down) throw new TypeError('Network request failed');
    if (new URL(url).pathname.endsWith('/xmltv.php')) return new Response(xmltv(), { status: 200 });
    const params = new URL(url).searchParams;
    try {
      return new Response(JSON.stringify(answer(params)), { status: 200 });
    } catch {
      return new Response('error', { status: 500 });
    }
  }) as unknown as typeof globalThis.fetch;

  return {
    fetch,
    calls,
    nowSeconds,
    /** The full guide's programmes; tests add or remove entries. */
    guide,
    /** The provider's movie list; tests add or remove entries to change what the next update finds. */
    movies,
    /** The provider's live channels. */
    channels: channels as { stream_id: number; name: string; num?: number; epg_channel_id?: string; category_id?: string }[],
    offline: () => {
      down = true;
    },
    /** Account as the provider reports it on the next login check (e.g. 'Expired', a new `exp_date`). */
    setAccount: (status: string, expiresAtSeconds: number | null = null) => {
      accountStatus = status;
      expDate = expiresAtSeconds === null ? null : String(expiresAtSeconds);
    },
  };
}
