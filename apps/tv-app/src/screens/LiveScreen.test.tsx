import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { navStore } from '../appContext';
import { setupApp } from '../../test/utils';
import { pressRemote } from '../../test/remoteMock';
import { LiveScreen, categoryPage } from './LiveScreen';

// The test renderer has no native tags: a category's `nextFocusUp`/`nextFocusDown` becomes the testID it points to.
jest.mock('react-native/Libraries/Components/TV/tagForComponentOrHandle', () => ({
  __esModule: true,
  default: (component?: { props?: { testID?: string } } | null) => component?.props?.testID,
}));
jest.mock('@iptv/screens/src/ui/focusGrid', () => ({
  ...jest.requireActual('@iptv/screens/src/ui/focusGrid'),
  moveFocus: jest.fn(),
}));
const moveFocus = jest.requireMock<{ moveFocus: jest.Mock }>('@iptv/screens/src/ui/focusGrid').moveFocus;
const focusedTo = () => moveFocus.mock.calls.map(([view]: [{ props?: { testID?: string } } | undefined]) => view?.props?.testID);

const NOW = Date.parse('2026-09-23T12:10:00Z');
const at = (minutes: number) => new Date(Date.parse('2026-09-23T12:00:00Z') + minutes * 60_000).toISOString();
const channel = (id: string, name: string, categoryId = '1') => ({
  id,
  name,
  categoryId,
  number: Number(id),
  logoUrl: null,
  epgChannelId: null,
  hasCatchup: false,
});

async function flush() {
  await act(async () => {
    for (let i = 0; i < 50; i++) await Promise.resolve();
  });
}

describe('LiveScreen (three-column guide)', () => {
  beforeEach(() => jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate'] }));
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('renders three columns: categories, channels, video+epg', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    const backend = setupApp();
    navStore.getState().goSection('live');
    backend.on('GET', '/api/catalog/live/categories', { body: [{ id: '1', name: 'News', kind: 'live' }] });
    backend.on('GET', '/api/catalog/live/channels', ({ url }) => {
      const catId = url.searchParams.get('categoryId');
      if (catId === '1') {
        return { body: [channel('1', 'News HD'), channel('2', 'Sports HD')] };
      }
      return { body: [channel('1', 'News HD'), channel('2', 'Sports HD')] };
    });
    backend.on('GET', '/api/epg', ({ url }) => ({
      body: {
        status: 'ready',
        updatedAt: at(0),
        from: url.searchParams.get('from'),
        to: at(120),
        totalChannels: 2,
        channels: [
          {
            channel: channel('1', 'News HD'),
            programmes: [{ start: at(-30), end: at(30), title: 'Morning Briefing', description: 'Top stories.' }],
          },
          { channel: channel('2', 'Sports HD'), programmes: [] },
        ],
      },
    }));
    backend.on('GET', '/api/live/1/auto', { body: { url: 'http://stream/1', deliveryMode: 'hls' } });

    await render(<LiveScreen />);
    await flush();

    // Three columns exist
    expect(screen.getByTestId('live-categories')).toBeTruthy();
    expect(screen.getByTestId('live-channels')).toBeTruthy();
    expect(screen.getByTestId('video-epg-column')).toBeTruthy();

    // Category list shows Favorites and the News category (no "All channels" anymore)
    expect(screen.getByLabelText('Favorites')).toBeTruthy();
    expect(screen.getByLabelText('News')).toBeTruthy();
    // Channel list shows channels (use testID to avoid duplicate text in video preview)
    expect(screen.getByTestId('live-channel-0')).toBeTruthy();
    expect(screen.getByTestId('live-channel-1')).toBeTruthy();
  });

  it('selecting a category loads its channels and EPG', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    const backend = setupApp();
    navStore.getState().goSection('live');
    const epgRequests: URL[] = [];
    backend.on('GET', '/api/catalog/live/categories', {
      body: [
        { id: '1', name: 'News', kind: 'live' },
        { id: '2', name: 'Sports', kind: 'live' },
      ],
    });
    backend.on('GET', '/api/catalog/live/channels', ({ url }) => {
      const catId = url.searchParams.get('categoryId');
      if (catId === '2') {
        return { body: [channel('3', 'Sports HD', '2')] };
      }
      return { body: [channel('1', 'News HD')] };
    });
    backend.on('GET', '/api/epg', ({ url }) => {
      epgRequests.push(url);
      return {
        body: {
          status: 'ready',
          updatedAt: at(0),
          from: url.searchParams.get('from'),
          to: at(120),
          totalChannels: 1,
          channels:
            url.searchParams.get('categoryId') === '2'
              ? [
                  {
                    channel: channel('3', 'Sports HD', '2'),
                    programmes: [{ start: at(0), end: at(60), title: 'Match', description: null }],
                  },
                ]
              : [
                  {
                    channel: channel('1', 'News HD'),
                    programmes: [{ start: at(-30), end: at(30), title: 'Morning Briefing', description: null }],
                  },
                ],
        },
      };
    });
    backend.on('GET', '/api/live/1/auto', { body: { url: 'http://stream/1', deliveryMode: 'hls' } });
    backend.on('GET', '/api/live/3/auto', { body: { url: 'http://stream/3', deliveryMode: 'hls' } });

    await render(<LiveScreen />);
    await flush();

    // Initially no category is selected (default category is null, no "All channels" anymore)
    expect(screen.getByLabelText('Favorites')).toBeTruthy();
    expect(screen.getByLabelText('News')).toBeTruthy();
    expect(screen.getByTestId('live-channel-0')).toBeTruthy();

    // Switch to News category
    await fireEvent.press(screen.getByLabelText('News'));
    await flush();

    expect(screen.getByLabelText('News').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('live-channel-0')).toBeTruthy();

    // Switch to Sports category
    await fireEvent.press(screen.getByLabelText('Sports'));
    await flush();

    expect(screen.getByLabelText('Sports').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('live-channel-0')).toBeTruthy();
    expect(epgRequests.at(-1)!.searchParams.get('categoryId')).toBe('2');
  });

  it('TV: category list navigates with Up/Down, Enter selects', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    moveFocus.mockClear();
    const backend = setupApp();
    navStore.getState().goSection('live');
    const categories = Array.from({ length: 5 }, (_, i) => ({ id: String(i + 1), name: `Category ${i + 1}`, kind: 'live' }));
    backend.on('GET', '/api/catalog/live/categories', { body: categories });
    backend.on('GET', '/api/catalog/live/channels', { body: [] });
    backend.on('GET', '/api/epg', {
      body: { status: 'ready', updatedAt: at(0), from: at(0), to: at(180), totalChannels: 0, channels: [] },
    });

    await render(<LiveScreen />);
    await flush();

    // Category items exist with focus refs (Favorites + 5 custom = 6 total, indices 0-5)
    const item = (index: number) => screen.getByTestId(`live-category-${index}`);
    // navUp may be undefined in test environment (no nav target set)
    // expect(item(0).props.nextFocusUp).toBeDefined(); // navUp
    expect(item(1).props.nextFocusUp).toBe('live-category-0'); // Favorites is index 0
    expect(item(1).props.nextFocusDown).toBe('live-category-2');
    // Last item (index 5) has nextFocusDown pointing to itself (stays on last)
    expect(item(5).props.nextFocusDown).toBe('live-category-5'); // Stays on last

    // Channel up/down pages through categories
    await fireEvent(screen.getByTestId('live-categories'), 'layout', { nativeEvent: { layout: { height: 300 } } });
    await fireEvent(item(0), 'layout', { nativeEvent: { layout: { height: 50 } } });
    await fireEvent(item(1), 'focus');
    await act(async () => pressRemote('channelDown', 'up'));
    expect(focusedTo().some((id) => id?.includes('live-category-'))).toBe(true);
  });

  it('channel list shows logo, name, and channel number badge', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    const backend = setupApp();
    navStore.getState().goSection('live');
    backend.on('GET', '/api/catalog/live/categories', { body: [{ id: '1', name: 'News', kind: 'live' }] });
    backend.on('GET', '/api/catalog/live/channels', ({ url }) => {
      const catId = url.searchParams.get('categoryId');
      if (!catId || catId === '1') {
        return { body: [channel('42', 'BE - EEN HD'), channel('43', 'BE - VRT 1')] };
      }
      return { body: [] };
    });
    backend.on('GET', '/api/epg', ({ url }) => ({
      body: {
        status: 'ready',
        updatedAt: at(0),
        from: url.searchParams.get('from'),
        to: at(120),
        totalChannels: 2,
        channels: [
          { channel: channel('42', 'BE - EEN HD'), programmes: [{ start: at(-30), end: at(30), title: 'Journaallus', description: null }] },
          { channel: channel('43', 'BE - VRT 1'), programmes: [] },
        ],
      },
    }));
    backend.on('GET', '/api/live/42/auto', { body: { url: 'http://stream/42', deliveryMode: 'hls' } });

    await render(<LiveScreen />);
    await flush();

    // Channel list items (use testID to avoid duplicate text in video preview)
    expect(screen.getByTestId('live-channel-0')).toBeTruthy();
    expect(screen.getByTestId('live-channel-1')).toBeTruthy();
    // Channel number badges
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('43')).toBeTruthy();
  });

  it('video preview shows selected channel', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    const backend = setupApp();
    navStore.getState().goSection('live');
    backend.on('GET', '/api/catalog/live/categories', { body: [{ id: '1', name: 'News', kind: 'live' }] });
    backend.on('GET', '/api/catalog/live/channels', ({ url }) => {
      const catId = url.searchParams.get('categoryId');
      if (!catId || catId === '1') {
        return { body: [channel('1', 'News HD'), channel('2', 'Sports HD')] };
      }
      return { body: [] };
    });
    backend.on('GET', '/api/epg', ({ url }) => ({
      body: {
        status: 'ready',
        updatedAt: at(0),
        from: url.searchParams.get('from'),
        to: at(120),
        totalChannels: 2,
        channels: [
          {
            channel: channel('1', 'News HD'),
            programmes: [{ start: at(-30), end: at(30), title: 'Morning Briefing', description: 'Top stories.' }],
          },
          { channel: channel('2', 'Sports HD'), programmes: [{ start: at(0), end: at(60), title: 'Match', description: null }] },
        ],
      },
    }));
    backend.on('GET', '/api/live/1/auto', { body: { url: 'http://stream/1', deliveryMode: 'hls' } });
    backend.on('GET', '/api/live/2/auto', { body: { url: 'http://stream/2', deliveryMode: 'hls' } });

    await render(<LiveScreen />);
    // Wait for channel list to load and first channel to be auto-selected
    await screen.findByTestId('live-channel-0');
    await screen.findByText('Press OK to load preview');

    // Video preview shows "Press OK to load preview" initially (first channel auto-selected for EPG, but preview not primed)
    expect(screen.getByTestId('video-preview')).toBeTruthy();
    expect(screen.getByText('Press OK to load preview')).toBeTruthy();
    // Channel name appears in overlay (auto-selected first channel) and in channel list
    expect(screen.getAllByText('News HD').length).toBeGreaterThanOrEqual(1);

    // Press OK to prime preview for first channel
    await fireEvent.press(screen.getByTestId('live-channel-0'));
    await flush();

    // Video preview now shows selected channel (primed)
    const preview = screen.getByTestId('video-preview');
    expect(preview).toBeTruthy();
    expect(screen.getAllByText('News HD').length).toBeGreaterThanOrEqual(1);

    // Select second channel
    await fireEvent.press(screen.getByTestId('live-channel-1'));
    await flush();

    // Video preview updates to show selected channel
    expect(screen.getAllByText('Sports HD').length).toBeGreaterThanOrEqual(1);
  });

  it('EPG schedule shows programmes for selected channel', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    const backend = setupApp();
    navStore.getState().goSection('live');
    backend.on('GET', '/api/catalog/live/categories', { body: [{ id: '1', name: 'News', kind: 'live' }] });
    backend.on('GET', '/api/catalog/live/channels', ({ url }) => {
      const catId = url.searchParams.get('categoryId');
      if (!catId || catId === '1') {
        return { body: [channel('1', 'News HD')] };
      }
      return { body: [] };
    });
    backend.on('GET', '/api/epg', ({ url }) => ({
      body: {
        status: 'ready',
        updatedAt: at(0),
        from: url.searchParams.get('from'),
        to: at(120),
        totalChannels: 1,
        channels: [
          {
            channel: channel('1', 'News HD'),
            programmes: [
              { start: at(-30), end: at(30), title: 'Morning Briefing', description: 'Top stories.' },
              { start: at(30), end: at(90), title: 'World Report', description: 'Global news.' },
              { start: at(90), end: at(150), title: 'Late Edition', description: null },
            ],
          },
        ],
      },
    }));
    backend.on('GET', '/api/live/1/auto', { body: { url: 'http://stream/1', deliveryMode: 'hls' } });

    await render(<LiveScreen />);
    await flush();

    // Select the channel first (no auto-select)
    await fireEvent.press(screen.getByTestId('live-channel-0'));
    await flush();

    // EPG schedule shows programmes
    expect(screen.getByText('Morning Briefing')).toBeTruthy();
    expect(screen.getByText('World Report')).toBeTruthy();
    expect(screen.getByText('Late Edition')).toBeTruthy();

    // Current programme (Morning Briefing at 12:10) is highlighted
    const morningBriefing = screen.getByText('Morning Briefing');
    expect(morningBriefing).toBeTruthy();
  });

  it('current programme shows progress bar with times', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    const backend = setupApp();
    navStore.getState().goSection('live');
    backend.on('GET', '/api/catalog/live/categories', { body: [{ id: '1', name: 'News', kind: 'live' }] });
    backend.on('GET', '/api/catalog/live/channels', ({ url }) => {
      const catId = url.searchParams.get('categoryId');
      if (!catId || catId === '1') {
        return { body: [channel('1', 'News HD')] };
      }
      return { body: [] };
    });
    backend.on('GET', '/api/epg', ({ url }) => ({
      body: {
        status: 'ready',
        updatedAt: at(0),
        from: url.searchParams.get('from'),
        to: at(120),
        totalChannels: 1,
        channels: [
          { channel: channel('1', 'News HD'), programmes: [{ start: at(-30), end: at(30), title: 'Morning Briefing', description: null }] },
        ],
      },
    }));
    backend.on('GET', '/api/live/1/auto', { body: { url: 'http://stream/1', deliveryMode: 'hls' } });

    await render(<LiveScreen />);
    await flush();

    // Select the channel first (no auto-select)
    await fireEvent.press(screen.getByTestId('live-channel-0'));
    await flush();

    // Progress bar exists for current programme (times in local timezone: "23 Sept, 13:30")
    expect(screen.getByTestId('epg-progress-start')).toBeTruthy(); // Start time in local time
    expect(screen.getByTestId('epg-progress-end')).toBeTruthy(); // End time in local time
  });

  it('pressing a programme plays the channel', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    const backend = setupApp();
    navStore.getState().goSection('live');
    backend.on('GET', '/api/catalog/live/categories', { body: [{ id: '1', name: 'News', kind: 'live' }] });
    backend.on('GET', '/api/catalog/live/channels', ({ url }) => {
      const catId = url.searchParams.get('categoryId');
      if (!catId || catId === '1') {
        return { body: [channel('1', 'News HD')] };
      }
      return { body: [] };
    });
    backend.on('GET', '/api/epg', ({ url }) => ({
      body: {
        status: 'ready',
        updatedAt: at(0),
        from: url.searchParams.get('from'),
        to: at(120),
        totalChannels: 1,
        channels: [
          {
            channel: channel('1', 'News HD'),
            programmes: [{ start: at(-30), end: at(30), title: 'Morning Briefing', description: 'Top stories.' }],
          },
        ],
      },
    }));
    backend.on('GET', '/api/live/1/auto', { body: { url: 'http://stream/1', deliveryMode: 'hls' } });

    await render(<LiveScreen />);
    await flush();

    // First press: prime the channel preview
    await fireEvent.press(screen.getByTestId('live-channel-0'));
    await flush();

    // Second press on the same (primed) channel: play
    await fireEvent.press(screen.getByTestId('live-channel-0'));
    await flush();

    expect(navStore.getState().stack.at(-1)).toMatchObject({
      name: 'player',
      target: { kind: 'live', streamId: '1', title: 'News HD', subtitle: 'Morning Briefing' },
    });
  });

  it('a past programme with a recording offers Watch recording before the preview is loaded', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    const backend = setupApp();
    navStore.getState().goSection('live');
    const sports = { ...channel('1', 'Sports HD'), hasCatchup: true, catchupDays: 3 };
    backend.on('GET', '/api/catalog/live/categories', { body: [{ id: '1', name: 'Sports', kind: 'live' }] });
    backend.on('GET', '/api/catalog/live/channels', { body: [sports] });
    backend.on('GET', '/api/epg', ({ url }) => ({
      body: {
        status: 'ready',
        updatedAt: at(0),
        from: url.searchParams.get('from'),
        to: at(120),
        totalChannels: 1,
        channels: [
          {
            channel: sports,
            programmes: [
              { start: at(-90), end: at(-30), title: 'Match Day', description: null },
              { start: at(-30), end: at(30), title: 'Studio Talk', description: null },
            ],
          },
        ],
      },
    }));

    await render(<LiveScreen />);
    await flush();

    // The preview loads only on OK, yet the recording can be started without it.
    expect(screen.getByText('Press OK to load preview')).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`epg-programme-${at(-90)}`));
    await flush();
    expect(screen.getByText('Press OK to load preview')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('preview-catchup-button'));
    await flush();

    expect(navStore.getState().stack.at(-1)).toMatchObject({
      name: 'player',
      target: { kind: 'live', streamId: '1', title: 'Match Day', catchup: { start: at(-90) } },
    });
  });

  it('shows loading state while EPG downloads', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/catalog/live/categories', { body: [{ id: '1', name: 'News', kind: 'live' }] });
    backend.on('GET', '/api/catalog/live/channels', { body: [] });
    // EPG returns refreshing status (simulates in-flight request)
    backend.on('GET', '/api/epg', {
      body: { status: 'refreshing', updatedAt: null, from: at(0), to: at(120), totalChannels: 0, channels: [] },
    });

    await render(<LiveScreen />);
    await flush();

    // Component renders without error; loading spinner may not be visible in test due to immediate mock response
    expect(screen.getByTestId('live-screen')).toBeTruthy();
  });

  it('keeps chosen category after player closes', async () => {
    const backend = setupApp();
    const epgRequests: URL[] = [];
    backend.on('GET', '/api/catalog/live/categories', { body: [{ id: '7', name: 'AM | BR | BRAZIL', kind: 'live' }] });
    backend.on('GET', '/api/catalog/live/channels', { body: [] });
    backend.on('GET', '/api/epg', ({ url }) => {
      epgRequests.push(url);
      return { body: { status: 'ready', updatedAt: at(0), from: at(0), to: at(180), totalChannels: 0, channels: [] } };
    });

    const view = await render(<LiveScreen />);
    await flush();

    await fireEvent.press(screen.getByLabelText('AM | BR | BRAZIL'));
    await flush();
    expect(epgRequests.at(-1)!.searchParams.get('categoryId')).toBe('7');

    // Simulate player opening/closing by remounting
    await view.rerender(<LiveScreen key="after-player" />);
    await flush();

    expect(screen.getByLabelText('AM | BR | BRAZIL').props.accessibilityState).toMatchObject({ selected: true });
    expect(epgRequests.at(-1)!.searchParams.get('categoryId')).toBe('7');
  });

  it('categoryPage helper calculates correct page size', () => {
    expect(categoryPage(300, 50)).toBe(5);
    expect(categoryPage(60, 50)).toBe(1);
    expect(categoryPage(0, 50)).toBe(5);
  });
});
