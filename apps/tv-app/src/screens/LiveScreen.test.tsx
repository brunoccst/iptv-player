import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { navStore } from '../appContext';
import { setupApp } from '../../test/utils';
import { LiveScreen } from './LiveScreen';

const NOW = Date.parse('2026-09-23T12:10:00Z');
const at = (minutes: number) => new Date(Date.parse('2026-09-23T12:00:00Z') + minutes * 60_000).toISOString();
const channel = (id: string, name: string) => ({ id, name, categoryId: '1', number: Number(id), logoUrl: null, epgChannelId: null, hasCatchup: false });

async function flush() {
  await act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });
}

describe('LiveScreen (guide)', () => {
  beforeEach(() => jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate'] }));
  afterEach(() => jest.useRealTimers());

  it('lays out the grid, describes the focused programme and plays the channel on select', async () => {
    const backend = setupApp();
    const requests: URL[] = [];
    backend.on('GET', '/api/catalog/live/categories', { body: [{ id: '1', name: 'News', kind: 'live' }] });
    backend.on('GET', '/api/epg', ({ url }) => {
      requests.push(url);
      return { body: {
        status: 'ready', updatedAt: at(0), from: url.searchParams.get('from'), to: at(120), totalChannels: 2,
        channels: [
          { channel: channel('1', 'News HD'), programmes: [
            { start: at(-30), end: at(30), title: 'Morning Briefing', description: 'Top stories.' },
            { start: at(30), end: at(90), title: 'World Report', description: null },
          ] },
          { channel: channel('2', 'Quiet'), programmes: [] },
        ],
      } };
    });

    await render(<LiveScreen />);
    await flush();
    await fireEvent(screen.getByTestId('guide'), 'layout', { nativeEvent: { layout: { width: 770, height: 300 } } });
    await flush();

    expect(requests[0]!.searchParams.get('from')).toBe('2026-09-23T12:00:00.000Z');
    expect(requests[0]!.searchParams.get('hours')).toBe('2');
    // Before focus, the info panel describes what is on now on the first channel.
    expect(screen.getByTestId('guide-info')).toHaveTextContent(/Morning Briefing.*On now.*Top stories\./);
    expect(screen.getByText('No guide information')).toBeTruthy();

    // 600 dp timeline for 2 h: the current show (clipped to 12:00-12:30) is 150 dp wide.
    const current = screen.getByTestId('guide-now-1');
    expect(current).toHaveStyle({ width: 150 });

    await fireEvent(screen.getByLabelText(/^World Report,/), 'focus');
    expect(screen.getByTestId('guide-info')).toHaveTextContent(/World Report/);
    expect(screen.getByTestId('guide-info')).not.toHaveTextContent(/On now/);

    await fireEvent.press(current);
    expect(navStore.getState().stack.at(-1)).toMatchObject({
      name: 'player', target: { kind: 'live', streamId: '1', title: 'News HD', subtitle: 'Morning Briefing' },
    });

    await fireEvent.press(screen.getByTestId('guide-later'));
    await flush();
    expect(requests.at(-1)!.searchParams.get('from')).toBe('2026-09-23T13:00:00.000Z');
  });

  it('says so while the guide downloads for the first time', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/catalog/live/categories', { body: [] });
    backend.on('GET', '/api/epg', { body: { status: 'refreshing', updatedAt: null, from: at(0), to: at(120), totalChannels: 0, channels: [] } });

    await render(<LiveScreen />);
    await flush();

    expect(screen.getByText('Downloading the TV guide…')).toBeTruthy();
  });
});
