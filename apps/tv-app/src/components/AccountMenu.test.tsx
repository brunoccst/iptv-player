import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { App } from '../App';
import { navStore } from '../appContext';
import { pressBack, setupApp } from '../../test/utils';

async function flush() {
  await act(async () => {
    for (let i = 0; i < 30; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('account menu groups', () => {
  it('shows groups; a group replaces the list with its name, a back arrow and its items', async () => {
    setupApp();
    await render(<App />);
    await flush();
    await fireEvent.press(screen.getByTestId('nav-account'));
    for (const id of ['menu-group-profiles', 'menu-group-library', 'menu-group-app', 'menu-sign-out']) {
      expect(screen.getByTestId(id)).toBeTruthy();
    }
    expect(screen.queryByTestId('menu-pin')).toBeNull();

    await fireEvent.press(screen.getByTestId('menu-group-profiles'));
    expect(screen.getByLabelText('Back from Profiles')).toBeTruthy();
    expect(screen.getByTestId('menu-pin')).toBeTruthy();
    expect(screen.getByTestId('menu-language')).toBeTruthy();
    expect(screen.queryByTestId('menu-group-app')).toBeNull();
    expect(screen.queryByTestId('menu-sign-out')).toBeNull();

    // The back arrow returns to the main list…
    await fireEvent.press(screen.getByTestId('menu-back'));
    expect(screen.getByTestId('menu-group-app')).toBeTruthy();
    expect(screen.queryByTestId('menu-pin')).toBeNull();

    // …and so does the Back key; a second Back closes the menu.
    await fireEvent.press(screen.getByTestId('menu-group-app'));
    expect(screen.getByTestId('menu-about')).toBeTruthy();
    await act(async () => pressBack());
    expect(screen.getByTestId('menu-group-app')).toBeTruthy();
    await act(async () => pressBack());
    expect(navStore.getState().menuOpen).toBe(false);
    expect(screen.queryByTestId('account-menu')).toBeNull();
  });
});
