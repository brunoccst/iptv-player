import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, Platform, type AlertButton } from 'react-native';
import { nativeState } from '../../test/tvMediaMock';
import { App } from '../App';
import { appContext, navStore, stores } from '../appContext';
import { profile } from '../../test/utils';
import { pressBack, setupApp } from '../../test/utils';

async function flush() {
  await act(async () => {
    for (let i = 0; i < 30; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('account menu groups', () => {
  afterEach(() => jest.restoreAllMocks());

  it('TV: the D-pad stays in the open menu, in every direction (D-112)', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    setupApp();
    await render(<App />);
    await flush();
    await fireEvent.press(screen.getByTestId('nav-account'));
    const menu = screen.getByTestId('account-menu');
    for (const direction of ['Up', 'Down', 'Left', 'Right']) expect(menu).toHaveProp(`trapFocus${direction}`, true);
    await act(async () => navStore.getState().setMenuOpen(false));
  });

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

  it('Kids profiles only switch profile or close the app: no settings, sync, backup, updates, log or sign-out', async () => {
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
    expect(screen.getByTestId('menu-close-app')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('menu-switch-profile'));
    expect(stores.session.getState().activeProfileId).toBeNull();
  });

  it('Close the app is on the main menu: it asks first, then closes the app like "Force stop" (D-108)', async () => {
    setupApp();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await render(<App />);
    await flush();
    await fireEvent.press(screen.getByTestId('nav-account'));
    await fireEvent.press(screen.getByTestId('menu-close-app'));
    expect(nativeState.calls).not.toContain('close-app');
    const buttons = alert.mock.calls[0]![2] as AlertButton[];
    await act(async () => buttons.find((button) => button.text === 'Close the app')!.onPress!());
    expect(nativeState.calls).toContain('close-app');
    alert.mockRestore();
  });
});

describe('App → Automatic subtitles (D-111)', () => {
  it('saves the switch, the API key, the account and the languages in the order they were picked', async () => {
    setupApp();
    await render(<App />);
    await flush();
    await fireEvent.press(screen.getByTestId('nav-account'));
    await fireEvent.press(screen.getByTestId('menu-group-app'));
    await fireEvent.press(screen.getByTestId('menu-subtitles'));
    await fireEvent.press(screen.getByTestId('subtitle-settings-enabled'));
    await fireEvent.changeText(screen.getByTestId('subtitle-settings-key'), ' abc123 ');
    await fireEvent.changeText(screen.getByTestId('subtitle-settings-username'), 'ale');
    await fireEvent.changeText(screen.getByTestId('subtitle-settings-password'), 'secret');
    // English is picked by default; Portuguese (Brazil) goes before it once English is picked again.
    await fireEvent.press(screen.getByTestId('subtitle-language-en'));
    await fireEvent.press(screen.getByTestId('subtitle-language-pt-br'));
    await fireEvent.press(screen.getByTestId('subtitle-language-en'));
    expect(screen.getByTestId('subtitle-language-en')).toHaveTextContent('2. English');
    await fireEvent.press(screen.getByTestId('subtitle-settings-save'));
    await flush();
    expect(appContext.subtitles.settings.getState().settings).toEqual({
      enabled: true,
      apiKey: 'abc123',
      username: 'ale',
      password: 'secret',
      languages: ['pt-br', 'en'],
    });
    expect(screen.queryByTestId('subtitle-settings')).toBeNull();
  });
});

describe('Profiles → Categories shown (D-110)', () => {
  it('unchecked categories leave the category bar; the choice is saved for the profile', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/catalog/movies/categories', {
      body: [
        { id: '1', name: 'Drama' },
        { id: '2', name: 'VOD | HUGE LIST' },
      ],
    });
    await render(<App />);
    await flush();
    await fireEvent.press(screen.getByTestId('nav-account'));
    await fireEvent.press(screen.getByTestId('menu-group-profiles'));
    await fireEvent.press(screen.getByTestId('menu-hidden-categories'));
    await flush();
    expect(screen.getByTestId('hidden-category-Drama')).toHaveProp('accessibilityState', { checked: true });
    await fireEvent.press(screen.getByTestId('hidden-category-VOD | HUGE LIST'));
    expect(screen.getByTestId('hidden-category-VOD | HUGE LIST')).toHaveProp('accessibilityState', { checked: false });
    await fireEvent.press(screen.getByTestId('hidden-categories-save'));
    await flush();
    expect(stores.profilePrefs.getState().prefs[profile.id]?.hiddenCategories).toEqual({ movies: ['2'] });
    expect(screen.queryByTestId('hidden-categories')).toBeNull();

    await act(async () => navStore.getState().goSection('movies'));
    await flush();
    expect(screen.getAllByText('Drama').length).toBeGreaterThan(0);
    expect(screen.queryByText('VOD | HUGE LIST')).toBeNull();
  });

  it('"Select all" unchecks every category, then one can be picked alone, or checks them all again (issue #120)', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/catalog/movies/categories', {
      body: [
        { id: '1', name: 'Drama' },
        { id: '2', name: 'Comedy' },
        { id: '3', name: 'Horror' },
      ],
    });
    await render(<App />);
    await flush();
    await fireEvent.press(screen.getByTestId('nav-account'));
    await fireEvent.press(screen.getByTestId('menu-group-profiles'));
    await fireEvent.press(screen.getByTestId('menu-hidden-categories'));
    await flush();
    const checked = (name: string) =>
      (
        screen.getByTestId(name === 'all' ? 'hidden-categories-all' : `hidden-category-${name}`).props as {
          accessibilityState: { checked: boolean };
        }
      ).accessibilityState.checked;
    expect(checked('all')).toBe(true);

    await fireEvent.press(screen.getByTestId('hidden-categories-all'));
    expect(['all', 'Drama', 'Comedy', 'Horror'].map(checked)).toEqual([false, false, false, false]);
    await fireEvent.press(screen.getByTestId('hidden-category-Comedy'));
    expect(['all', 'Drama', 'Comedy', 'Horror'].map(checked)).toEqual([false, false, true, false]);
    await fireEvent.press(screen.getByTestId('hidden-categories-save'));
    await flush();
    expect(stores.profilePrefs.getState().prefs[profile.id]?.hiddenCategories).toEqual({ movies: ['1', '3'] });

    // Not all shown: "Select all" shows them all again.
    await fireEvent.press(screen.getByTestId('nav-account'));
    await fireEvent.press(screen.getByTestId('menu-group-profiles'));
    await fireEvent.press(screen.getByTestId('menu-hidden-categories'));
    await flush();
    await fireEvent.press(screen.getByTestId('hidden-categories-all'));
    expect(['all', 'Drama', 'Comedy', 'Horror'].map(checked)).toEqual([true, true, true, true]);
  });
});
