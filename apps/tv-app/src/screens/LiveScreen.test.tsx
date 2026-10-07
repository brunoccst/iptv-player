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
jest.mock('../components/focusGrid', () => ({
  ...jest.requireActual('../components/focusGrid'),
  moveFocus: jest.fn(),
}));
const moveFocus = jest.requireMock<{ moveFocus: jest.Mock }>('../components/focusGrid').moveFocus;
const focusedTo = () => moveFocus.mock.calls.map(([view]: [{ props?: { testID?: string } } | undefined]) => view?.props?.testID);

const NOW = Date.parse('2026-09-23T12:10:00Z');
const at = (minutes: number) => new Date(Date.parse('2026-09-23T12:00:00Z') + minutes * 60_000).toISOString();
const channel = (id: string, name: string) => ({
  id,
  name,
  categoryId: '1',
  number: Number(id),
  logoUrl: null,
  epgChannelId: null,
  hasCatchup: false,
});

/** The guide page's width, and the height left for the guide under the toolbar (TV and wide screens). */
async function layoutGuide() {
  await fireEvent(screen.getByTestId('guide-page'), 'layout', { nativeEvent: { layout: { width: 920, height: 600 } } });
  await fireEvent(screen.getByTestId('guide-area'), 'layout', { nativeEvent: { layout: { width: 920, height: 400 } } });
}

async function flush() {
  await act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });
}

describe('LiveScreen (guide)', () => {
  beforeEach(() => jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate'] }));
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('lays out the grid, describes the focused programme and plays the channel on select (TV)', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    const backend = setupApp();
    navStore.getState().goSection('live');
    const requests: URL[] = [];
    backend.on('GET', '/api/catalog/live/categories', { body: [{ id: '1', name: 'News', kind: 'live' }] });
    backend.on('GET', '/api/epg', ({ url }) => {
      requests.push(url);
      return {
        body: {
          status: 'ready',
          updatedAt: at(0),
          from: url.searchParams.get('from'),
          to: at(120),
          totalChannels: 2,
          channels: [
            {
              channel: channel('1', 'News HD'),
              programmes: [
                { start: at(-30), end: at(30), title: 'Morning Briefing', description: 'Top stories.' },
                { start: at(30), end: at(90), title: 'World Report', description: null },
              ],
            },
            { channel: channel('2', 'Quiet'), programmes: [] },
          ],
        },
      };
    });

    await render(<LiveScreen />);
    await flush();
    await layoutGuide();
    await flush();

    expect(requests[0]!.searchParams.get('from')).toBe('2026-09-23T12:00:00.000Z');
    expect(requests[0]!.searchParams.get('hours')).toBe('3');
    // Before focus, the info panel describes what is on now on the first channel.
    expect(screen.getByTestId('guide-info')).toHaveTextContent(/Morning Briefing.*On now.*Top stories\./);
    expect(screen.getByText('No guide information')).toBeTruthy();

    // 720 dp timeline for 3 h (page minus the 200 dp channel column): the current show, clipped to 12:00-12:30,
    // is 120 dp wide less a 2 dp gap.
    const current = screen.getByTestId('guide-now-1');
    expect(current).toHaveStyle({ width: 118 });

    await fireEvent(screen.getByLabelText(/^World Report,/), 'focus');
    expect(screen.getByTestId('guide-info')).toHaveTextContent(/World Report/);
    expect(screen.getByTestId('guide-info')).not.toHaveTextContent(/On now/);

    await fireEvent.press(current);
    expect(navStore.getState().stack.at(-1)).toMatchObject({
      name: 'player',
      target: { kind: 'live', streamId: '1', title: 'News HD', subtitle: 'Morning Briefing' },
    });

    await fireEvent.press(screen.getByTestId('guide-later'));
    await flush();
    expect(requests.at(-1)!.searchParams.get('from')).toBe('2026-09-23T13:00:00.000Z');
  });

  it('on phones a tap selects the programme and "Watch live" plays it, like the web', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(false);
    const backend = setupApp();
    backend.on('GET', '/api/catalog/live/categories', { body: [] });
    backend.on('GET', '/api/epg', {
      body: {
        status: 'ready',
        updatedAt: at(0),
        from: at(0),
        to: at(180),
        totalChannels: 1,
        channels: [
          { channel: channel('1', 'News HD'), programmes: [{ start: at(-30), end: at(30), title: 'Morning Briefing', description: null }] },
        ],
      },
    });

    await render(<LiveScreen />);
    await flush();
    await layoutGuide();
    await flush();
    expect(screen.queryByTestId('guide-info')).toBeNull();

    await fireEvent.press(screen.getByTestId('guide-now-1'));
    expect(navStore.getState().stack.at(-1)).toMatchObject({ name: 'section' });
    expect(screen.getByTestId('guide-info')).toHaveTextContent(/Morning Briefing.*On now/);
    await fireEvent.press(screen.getByText('Watch live'));
    expect(navStore.getState().stack.at(-1)).toMatchObject({ name: 'player', target: { streamId: '1', subtitle: 'Morning Briefing' } });
  });

  it('keeps the chosen category after the player closes', async () => {
    const backend = setupApp();
    const requests: URL[] = [];
    backend.on('GET', '/api/catalog/live/categories', { body: [{ id: '7', name: 'AM | BR | BRAZIL', kind: 'live' }] });
    backend.on('GET', '/api/epg', ({ url }) => {
      requests.push(url);
      return { body: { status: 'ready', updatedAt: at(0), from: at(0), to: at(180), totalChannels: 0, channels: [] } };
    });

    const view = await render(<LiveScreen />);
    await flush();
    await fireEvent.press(screen.getByLabelText('AM | BR | BRAZIL'));
    await flush();
    expect(requests.at(-1)!.searchParams.get('categoryId')).toBe('7');

    // Opening the player unmounts the page; Back mounts it again.
    await view.rerender(<LiveScreen key="after-player" />);
    await flush();
    expect(screen.getByLabelText('AM | BR | BRAZIL').props.accessibilityState).toMatchObject({ selected: true });
    expect(requests.at(-1)!.searchParams.get('categoryId')).toBe('7');
  });

  it('says so while the guide downloads for the first time', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/catalog/live/categories', { body: [] });
    backend.on('GET', '/api/epg', {
      body: { status: 'refreshing', updatedAt: null, from: at(0), to: at(120), totalChannels: 0, channels: [] },
    });

    await render(<LiveScreen />);
    await flush();

    expect(screen.getByText('Downloading the TV guide…')).toBeTruthy();
  });

  it('TV: the page fits the screen; the guide scrolls on its own, keeps Down and sends Up to the nav (D-140)', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    const backend = setupApp();
    navStore.getState().goSection('live');
    const requests: URL[] = [];
    backend.on('GET', '/api/catalog/live/categories', { body: [{ id: '1', name: 'News', kind: 'live' }] });
    backend.on('GET', '/api/epg', ({ url }) => {
      requests.push(url);
      return {
        body: {
          status: 'ready',
          updatedAt: at(0),
          from: url.searchParams.get('from'),
          to: at(120),
          totalChannels: 2,
          // One channel per page: the first, then the second.
          channels: [
            url.searchParams.get('offset') && url.searchParams.get('offset') !== '0'
              ? { channel: channel('2', 'Sports'), programmes: [] }
              : { channel: channel('1', 'News HD'), programmes: [] },
          ],
        },
      };
    });
    await render(
      <>
        <TopNav />
        <LiveScreen />
      </>,
    );
    await flush();
    await layoutGuide();
    await flush();

    // The page itself does not scroll: the category list and the channels do, each on its own.
    expect(screen.getByTestId('live-screen').type).not.toBe('RCTScrollView');
    expect(screen.getByTestId('live-categories')).toBeTruthy();
    const channels = screen.getByTestId('guide-channels');
    expect(within(channels).getByLabelText('Watch News HD')).toBeTruthy();
    expect(within(channels).getByText('More channels (1 of 2)')).toBeTruthy();
    expect(screen.getByTestId('guide')).toHaveStyle({ height: 400 });

    // Down at the last channel stays in the guide instead of jumping to a category.
    expect(screen.getByTestId('guide-trap').props.trapFocusDown).toBe(true);

    // Up from Earlier/Now/Later goes to "Live TV" in the nav.
    expect(screen.getByTestId('guide-earlier').props.nextFocusUp).toBe('nav-live');
    expect(screen.getByTestId('guide-later').props.nextFocusUp).toBe('nav-live');

    // Scrolling the channels to the end loads the next ones.
    const before = requests.length;
    await fireEvent.scroll(channels, {
      nativeEvent: { layoutMeasurement: { height: 400 }, contentOffset: { y: 0 }, contentSize: { height: 450 } },
    });
    await flush();
    expect(requests.length).toBeGreaterThan(before);
  });

  it('TV: ↑/↓ move one category, the list centers instead of scrolling itself; Channel +/− page (issue #179)', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    moveFocus.mockClear();
    const backend = setupApp();
    navStore.getState().goSection('live');
    const categories = Array.from({ length: 20 }, (_, i) => ({ id: String(i + 1), name: `Category ${i + 1}`, kind: 'live' }));
    backend.on('GET', '/api/catalog/live/categories', { body: categories });
    backend.on('GET', '/api/epg', {
      body: { status: 'ready', updatedAt: at(0), from: at(0), to: at(180), totalChannels: 0, channels: [] },
    });
    await render(<LiveScreen />);
    await flush();

    // Android's scroll view does not scroll on ↑/↓ by itself; the focused category is centered instead.
    expect(screen.getByTestId('live-categories').props.scrollEnabled).toBe(false);
    // ↑/↓ go to the category straight above or below; ↓ stays on the last one.
    const item = (index: number) => screen.getByTestId(`live-category-${index}`);
    expect(item(3).props.nextFocusUp).toBe('live-category-2');
    expect(item(3).props.nextFocusDown).toBe('live-category-4');
    expect(item(20).props.nextFocusDown).toBe('live-category-20');

    // Channel −: a page down (a 300 dp list of 50 dp categories: 5 at a time); Channel +: a page up.
    await fireEvent(screen.getByTestId('live-categories'), 'layout', { nativeEvent: { layout: { height: 300 } } });
    await fireEvent(item(0), 'layout', { nativeEvent: { layout: { height: 50 } } });
    await fireEvent(item(3), 'focus');
    await act(async () => pressRemote('channelDown', 'up'));
    expect(focusedTo()).toEqual(['live-category-8']);
    // Never past either end.
    await fireEvent(item(18), 'focus');
    await act(async () => pressRemote('channelDown', 'up'));
    await fireEvent(item(2), 'focus');
    await act(async () => pressRemote('channelUp', 'up'));
    expect(focusedTo()).toEqual(['live-category-8', 'live-category-20', 'live-category-0']);

    // Nothing in the list focused: Channel +/− leave it alone.
    await fireEvent(item(2), 'blur');
    await act(async () => pressRemote('channelDown', 'up'));
    expect(moveFocus).toHaveBeenCalledTimes(3);
  });

  it('Channel +/− skip a screenful of categories, less one', () => {
    expect(categoryPage(300, 50)).toBe(5);
    expect(categoryPage(60, 50)).toBe(1);
    expect(categoryPage(0, 50)).toBe(5);
  });
});
