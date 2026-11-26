import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { nativeState } from '../../test/tvMediaMock';
import { createGuardedRoot } from './guardedRoot';
import { StartFailedScreen } from './StartFailedScreen';

// A build with an update repository (local builds have none, and then the screen only offers Close).
jest.mock('../config', () => ({ updateRepo: 'o/r' }));

beforeEach(() => {
  nativeState.reset();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => (console.error as jest.Mock).mockRestore?.());

const Fine = () => <Text>the app</Text>;
const Broken = () => {
  throw new Error('boom while drawing');
};
const Screen = ({ error }: { error: unknown }) => <Text>failed: {(error as Error).message}</Text>;

describe('start guard (D-251)', () => {
  it('shows the app when it loads and draws', async () => {
    const Root = createGuardedRoot(
      () => Fine,
      () => Screen,
    );
    await render(<Root />);
    expect(screen.getByText('the app')).toBeTruthy();
  });

  it('shows the screen when loading the app throws', async () => {
    const Root = createGuardedRoot(
      () => {
        throw new Error('Cannot find module');
      },
      () => Screen,
    );
    await render(<Root />);
    expect(screen.getByText('failed: Cannot find module')).toBeTruthy();
  });

  it('shows the screen when the app throws while drawing', async () => {
    const Root = createGuardedRoot(
      () => Broken,
      () => Screen,
    );
    await render(<Root />);
    expect(screen.getByText('failed: boom while drawing')).toBeTruthy();
  });

  it('falls back to the plain error when even the screen cannot load', async () => {
    const Root = createGuardedRoot(
      () => {
        throw new Error('first failure');
      },
      () => {
        throw new Error('screen failure');
      },
    );
    await render(<Root />);
    expect(screen.getByText('first failure')).toBeTruthy();
  });
});

describe('The app could not start screen', () => {
  it('offers Update now for a newer release and starts the download', async () => {
    const body = 'TV app 9.9.9. Built from abc1234 (push), version 999, signed with the release key.';
    global.fetch = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            body,
            assets: [{ name: 'tv.apk', state: 'uploaded', browser_download_url: 'https://example.test/tv.apk', digest: null }],
          }),
        ),
    ) as unknown as typeof fetch;
    await render(<StartFailedScreen error={new Error('Cannot find module x')} />);
    expect(screen.getByText('The app could not start')).toBeTruthy();
    expect(screen.getByText(/Cannot find module x/)).toBeTruthy();
    const button = await screen.findByTestId('start-update');
    expect(String(screen.getByTestId('start-failed-status').props.children)).toContain('9.9.9');
    await act(async () => fireEvent.press(button));
    await waitFor(() => expect(nativeState.calls).toContain('update-install:/cache/updates/update.apk'));
  });
});
