import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { pressRemote } from '../../test/remoteMock';
import { nativeState } from '../../test/tvMediaMock';
import { RELEASE_SCREEN_AFTER_MS, SLEEP_AFTER_MS, SleepMode, sleepControl } from './SleepMode';

let time = 0;
const now = () => time;
async function pass(ms: number) {
  time += ms;
  await act(async () => jest.advanceTimersByTime(ms));
}

describe('TV sleep mode (D-068)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    time = Date.parse('2026-09-26T20:00:00Z');
    nativeState.reset();
    sleepControl.setState({ playing: false });
  });
  afterEach(() => jest.useRealTimers());

  it('keeps the screen on, sleeps after 10 idle minutes, and any button wakes it', async () => {
    await render(<SleepMode now={now} />);
    expect(nativeState.calls).toContain('keep-screen-on:true');

    await pass(SLEEP_AFTER_MS - 60_000);
    expect(screen.queryByTestId('sleep-screen')).toBeNull();
    // A key press restarts the idle time.
    await act(async () => pressRemote('down'));
    await pass(SLEEP_AFTER_MS - 60_000);
    expect(screen.queryByTestId('sleep-screen')).toBeNull();

    await pass(90_000);
    expect(screen.getByTestId('sleep-screen')).toBeTruthy();
    expect(screen.getByText('Press any button to continue')).toBeTruthy();
    await act(async () => pressRemote('right'));
    expect(screen.queryByTestId('sleep-screen')).toBeNull();

    // Select on the sleep screen wakes it too.
    await pass(SLEEP_AFTER_MS + 30_000);
    await fireEvent.press(screen.getByTestId('sleep-screen'));
    expect(screen.queryByTestId('sleep-screen')).toBeNull();
  });

  it('never sleeps while a video plays', async () => {
    await render(<SleepMode now={now} />);
    await act(async () => sleepControl.setState({ playing: true }));
    await pass(3 * SLEEP_AFTER_MS);
    expect(screen.queryByTestId('sleep-screen')).toBeNull();
    // Paused: the idle time starts again from the last moment it played.
    await act(async () => sleepControl.setState({ playing: false }));
    await pass(SLEEP_AFTER_MS + 30_000);
    expect(screen.getByTestId('sleep-screen')).toBeTruthy();
  });

  it('lets the screen turn off after 3 hours asleep; waking keeps it on again', async () => {
    await render(<SleepMode now={now} />);
    await pass(SLEEP_AFTER_MS + 30_000);
    nativeState.calls = [];
    await pass(RELEASE_SCREEN_AFTER_MS);
    expect(nativeState.calls).toContain('keep-screen-on:false');
    await act(async () => pressRemote('up'));
    expect(nativeState.calls.at(-1)).toBe('keep-screen-on:true');
  });
});
