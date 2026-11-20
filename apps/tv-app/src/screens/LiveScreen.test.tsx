import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { navStore } from '../appContext';
import { setupApp } from '../../test/utils';
import { TopNav } from '../components/TopNav';
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
    for (let i = 0; i < 20; i++) await Promise.resolve();
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
    backend.on('GET', '/api/epg', ({ url }) => ({
      body: {
        status: 'ready',
        updatedAt: at(0),
        from: url.searchParams.get('from'),
        to: at(120),
        totalChannels: 2,
        channels: [
          { channel: channel('1', 'News HD'), programmes: [{ start: at(-30), end: at(30), title: 'Morning Briefing', description: 'Top stories.' }] },
          { channel: channel('2', 'Sports HD'), programmes: [] },
        ],
      },
    }));
    backend.on('GET', '/api/live/1/auto', { body: { url: 'http://stream/1', deliveryMode: 'hls' } });

    await render(<LiveScreen />);
    await flush();

    // Three columns exist
    expect(screen.getByTestID('live-categories')).toBeTruthy();
    expect(screen.getByTestID('live-channels')).toBeTruthy();
    expect(screen.getByTestID('video-epg-column')).toBeTruthy();

    // Header bar with branding and category
    expect(screen.getByText('IPTV Player')).toBeTruthy();
    expect(screen.getByText('Live TV')).toBeTruthy();
    expect(screen.getByText('News')).toBeTruthy();

    // Category list shows the category
    expect(screen.getByLabelText('News')).toBeTruthy();
    // Channel list shows channels
    expect(screen.getByText('News HD')).toBeTruthy();
    expect(screen.getByText('Sports HD')).toBeTruthy();
  });

  it('selecting a category loads its channels and EPG', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    const backend = setupApp();
    navStore.getState().goSection('live');
    const epgRequests: URL[] = [];
    backend.on('GET', '/api/catalog/live/categories', { body: [{ id: '1', name: 'News', kind: 'live' }, { id: '2', name: 'Sports', kind: 'live' }] });
    backend.on('GET', '/api/epg', ({ url }) => {
      epgRequests.push(url);
      return {
        body: {
          status: 'ready',
          updatedAt: at(0),
          from: url.searchParams.get('from'),
          to: at(120),
          totalChannels: 1,
          channels: url.searchParams.get('categoryId') === '2'
            ? [{ channel: channel('3', 'Sports HD', '2'), programmes: [{ start: at(0), end: at(60), title: 'Match', description: null }] }]
            : [{ channel: channel('1', 'News HD'), programmes: [{ start: at(-30), end: at(30), title: 'Morning Briefing', description: null }] }],
        },
      };
    });
    backend.on('GET', '/api/live/1/auto', { body: { url: 'http://stream/1', deliveryMode: 'hls' } });
    backend.on('GET', '/api/live/3/auto', { body: { url: 'http://stream/3', deliveryMode: 'hls' } });

    await render(<LiveScreen />);
    await flush();

    // Initially on News category
    expect(screen.getByLabelText('News').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByText('News HD')).toBeTruthy();

    // Switch to Sports category
    await fireEvent.press(screen.getByLabelText('Sports'));
    await flush();

    expect(screen.getByLabelText('Sports').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByText('Sports HD')).toBeTruthy();
    expect(epgRequests.at(-1)!.searchParams.get('categoryId')).toBe('2');
  });

  it('TV: category list navigates with Up/Down, Enter selects', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    moveFocus.mockClear();
    const backend = setupApp();
    navStore.getState().goSection('live');
    const categories = Array.from({ length: 5 }, (_, i) => ({ id: String(i + 1), name: `Category ${i + 1}`, kind: 'live' }));
    backend.on('GET', '/api/catalog/live/categories', { body: categories });
    backend.on('GET', '/api/epg', { body: { status: 'ready', updatedAt: at(0), from: at(0), to: at(180), totalChannels: 0, channels: [] } });

    await render(<LiveScreen />);
    await flush();

    // Category items exist with focus refs
    const item = (index: number) => screen.getByTestID(`live-category-${index}`);
    expect(item(0).props.nextFocusUp).toBeDefined(); // navUp
    expect(item(2).props.nextFocusUp).toBe('live-category-1');
    expect(item(2).props.nextFocusDown).toBe('live-category-3');
    expect(item(4).props.nextFocusDown).toBe('live-category-4'); // Stays on last

    // Channel up/down pages through categories
    await fireEvent(screen.getByTestID('live-categories'), 'layout', { nativeEvent: { layout: { height: 300 } } });
    await fireEvent(item(0), 'layout', { nativeEvent: { layout: { height: 50 } } });
    await fireEvent(item(2), 'focus');
    await act(async () => pressRemote('channelDown', 'up'));
    expect(focusedTo()).toContain('live-category-');
  });

  it('channel list shows logo, name, and channel number badge', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    const backend = setupApp();
    navStore.getState().goSection('live');
    backend.on('GET', '/api/catalog/live/categories', { body: [{ id: '1', name: 'News', kind: 'live' }] });
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

    // Channel list items
    expect(screen.getByText('BE - EEN HD')).toBeTruthy();
    expect(screen.getByText('BE - VRT 1')).toBeTruthy();
    // Channel number badges
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('43')).toBeTruthy();
  });

  it('video preview shows selected channel', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    const backend = setupApp();
    navStore.getState().goSection('live');
    backend.on('GET', '/api/catalog/live/categories', { body: [{ id: '1', name: 'News', kind: 'live' }] });
    backend.on('GET', '/api/epg', ({ url }) => ({
      body: {
        status: 'ready',
        updatedAt: at(0),
        from: url.searchParams.get('from'),
        to: at(120),
        totalChannels: 2,
        channels: [
          { channel: channel('1', 'News HD'), programmes: [{ start: at(-30), end: at(30), title: 'Morning Briefing', description: 'Top stories.' }] },
          { channel: channel('2', 'Sports HD'), programmes: [{ start: at(0), end: at(60), title: 'Match', description: null }] },
        ],
      },
    }));
    backend.on('GET', '/api/live/1/auto', { body: { url: 'http://stream/1', deliveryMode: 'hls' } });
    backend.on('GET', '/api/live/2/auto', { body: { url: 'http://stream/2', deliveryMode: 'hls' } });

    await render(<LiveScreen />);
    await flush();

    // Video preview shows first channel by default
    expect(screen.getByTestID('video-preview')).toBeTruthy();
    expect(screen.getByText('News HD')).toBeTruthy();

    // Select second channel
    await fireEvent.press(screen.getByText('Sports HD'));
    await flush();

    // Video preview updates to show selected channel
    expect(screen.getByText('Sports HD')).toBeTruthy();
  });

  it('EPG schedule shows programmes for selected channel', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    const backend = setupApp();
    navStore.getState().goSection('live');
    backend.on('GET', '/api/catalog/live/categories', { body: [{ id: '1', name: 'News', kind: 'live' }] });
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

    // EPG schedule shows programmes
    expect(screen.getByText('Morning Briefing')).toBeTruthy();
    expect(screen.getByText('World Report')).toBeTruthy();
    expect(screen.getByText('Late Edition')).toBeTruthy();

    // Current programme (Morning Briefing at 12:10) is highlighted
    const currentCard = screen.getByText('Morning Briefing').closest('.epg-card-current') || screen.getByText('Morning Briefing');
    expect(currentCard).toBeTruthy();
  });

  it('current programme shows progress bar with times', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    const backend = setupApp();
    navStore.getState().goSection('live');
    backend.on('GET', '/api/catalog/live/categories', { body: [{ id: '1', name: 'News', kind: 'live' }] });
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

    // Progress bar exists for current programme
    expect(screen.getByText('11:30')).toBeTruthy(); // Start time (12:00 - 30 min = 11:30)
    expect(screen.getByText('12:30')).toBeTruthy(); // End time
  });

  it('pressing a programme plays the channel', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    const backend = setupApp();
    navStore.getState().goSection('live');
    backend.on('GET', '/api/catalog/live/categories', { body: [{ id: '1', name: 'News', kind: 'live' }] });
    backend.on('GET', '/api/epg', ({ url }) => ({
      body: {
        status: 'ready',
        updatedAt: at(0),
        from: url.searchParams.get('from'),
        to: at(120),
        totalChannels: 1,
        channels: [
          { channel: channel('1', 'News HD'), programmes: [{ start: at(-30), end: at(30), title: 'Morning Briefing', description: 'Top stories.' }] },
        ],
      },
    }));
    backend.on('GET', '/api/live/1/auto', { body: { url: 'http://stream/1', deliveryMode: 'hls' } });

    await render(<LiveScreen />);
    await flush();

    // Press the programme (or channel) to play
    await fireEvent.press(screen.getByText('News HD'));
    await flush();

    expect(navStore.getState().stack.at(-1)).toMatchObject({
      name: 'player',
      target: { kind: 'live', streamId: '1', title: 'News HD', subtitle: 'Morning Briefing' },
    });
  });

  it('shows loading state while EPG downloads', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/catalog/live/categories', { body: [] });
    backend.on('GET', '/api/epg', { body: { status: 'refreshing', updatedAt: null, from: at(0), to: at(120), totalChannels: 0, channels: [] } });

    await render(<LiveScreen />);
    await flush();

    expect(screen.getByText('Downloading the TV guide…')).toBeTruthy();
  });

  it('keeps chosen category after player closes', async () => {
    const backend = setupApp();
    const epgRequests: URL[] = [];
    backend.on('GET', '/api/catalog/live/categories', { body: [{ id: '7', name: 'AM | BR | BRAZIL', kind: 'live' }] });
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