import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import { nativeState } from '../../test/tvMediaMock';
import { App } from '../App';
import { navStore, stores } from '../appContext';
import { profile } from '../../test/utils';
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

  it('Kids profiles only switch profile: no settings, sync, backup, updates, log or sign-out', async () => {
    setupApp();
    await render(<App />);
    await flush();
    const kid = { id: 'kid', name: 'Mia', avatarKey: null, isKids: true };
    await act(async () => {
      stores.session.setState({ profiles: [profile, kid] });
      stores.session.getState().selectProfile('kid');
    });
    await flush();
    await fireEvent.press(screen.getByTestId('nav-account'));
    expect(screen.getByTestId('menu-profile-p1')).toBeTruthy();
    expect(screen.getByTestId('menu-switch-profile')).toBeTruthy();
    for (const id of ['menu-group-profiles', 'menu-group-library', 'menu-group-app', 'menu-sign-out']) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
    await fireEvent.press(screen.getByTestId('menu-switch-profile'));
    expect(stores.session.getState().activeProfileId).toBeNull();
  });

  it('App → Close the app asks first, then closes it like "Force stop"', async () => {
    setupApp();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await render(<App />);
    await flush();
    await fireEvent.press(screen.getByTestId('nav-account'));
    await fireEvent.press(screen.getByTestId('menu-group-app'));
    await fireEvent.press(screen.getByTestId('menu-close-app'));
    expect(nativeState.calls).not.toContain('close-app');
    const buttons = alert.mock.calls[0]![2] as AlertButton[];
    await act(async () => buttons.find((button) => button.text === 'Close the app')!.onPress!());
    expect(nativeState.calls).toContain('close-app');
    alert.mockRestore();
  });
});
