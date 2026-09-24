/** In-memory Xtream panel `fetch` for direct-mode tests. `offline()` makes every request fail like a dead network. */
export function createFakePanel() {
  const calls: string[] = [];
  let down = false;
  const nowSeconds = Math.floor(Date.UTC(2026, 0, 1, 20, 0) / 1000);

  const movies = [
    { stream_id: 101, name: 'EN - Big Test Movie (2020) [4K]', category_id: '11', rating: '8.1', container_extension: 'mkv' },
    { stream_id: 102, name: 'Big.Test.Movie.2020.1080p.WEB-DL', category_id: '10', container_extension: 'mp4' },
    { stream_id: 103, name: 'Another Film (2019)', category_id: '10', container_extension: 'mp4' },
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

  const answer = (params: URLSearchParams): unknown => {
    if (params.get('username') !== 'demo' || params.get('password') !== 'demo') return { user_info: { auth: 0 } };
    switch (params.get('action')) {
      case null:
        return { user_info: { auth: 1, status: 'Active', max_connections: '1', allowed_output_formats: ['m3u8', 'ts'] } };
      case 'get_vod_streams':
        return movies;
      case 'get_series':
        return series;
      case 'get_live_streams':
        return channels;
      case 'get_vod_categories':
        return [{ category_id: '10', category_name: 'Movies' }];
      case 'get_vod_info':
        return { info: [], movie_data: movies.find((movie) => String(movie.stream_id) === params.get('vod_id')) ?? {} };
      case 'get_short_epg':
        if (params.get('stream_id') === '2') throw new Error('guide unavailable');
        return { epg_listings: [programme('Old show', -120, 60), programme('Evening News', 0, 30), programme('Late News', 30, 60)] };
      default:
        return [];
    }
  };

  const fetch = (async (url: string) => {
    calls.push(url);
    if (down) throw new TypeError('Network request failed');
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
    offline: () => {
      down = true;
    },
  };
}
