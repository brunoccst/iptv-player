import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { App } from '../App';
import { nativeState } from '../../test/tvMediaMock';
import { setupApp } from '../../test/utils';

async function flush() {
  await act(async () => {
    for (let i = 0; i < 30; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('account menu → About', () => {
  it('shows the installed version and how the app is built and connected', async () => {
    setupApp();
    nativeState.versionCode = 57;
    await render(<App />);
    await flush();
    await fireEvent.press(screen.getByTestId('nav-account'));
    await fireEvent.press(screen.getByTestId('menu-group-app'));
    await fireEvent.press(screen.getByTestId('menu-about'));

    expect(within(screen.getByTestId('about-dialog')).getByText('Test TV')).toBeTruthy();
    expect(screen.getByTestId('about-version')).toHaveTextContent('57');
    // Local and test builds have no commit.
    expect(screen.getByTestId('about-built')).toHaveTextContent('a local build');
    expect(screen.getByTestId('about-connection')).toHaveTextContent(/My server|Directly/);
    await fireEvent.press(screen.getByTestId('about-close'));
    expect(screen.queryByTestId('about-dialog')).toBeNull();
  });
});
