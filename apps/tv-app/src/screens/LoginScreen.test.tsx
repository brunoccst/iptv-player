import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { i18nStore, setUiLanguage } from '@iptv/shared';
import { createFakePanel } from '../../../../packages/shared/src/testing/fakePanel';
import { appContext, stores } from '../appContext';
import { App } from '../App';
import { setupApp } from '../../test/utils';

async function flush() {
  await act(async () => {
    for (let i = 0; i < 40; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function fillLogin() {
  await fireEvent.changeText(screen.getByTestId('login-server'), 'panel.test:8080');
  await fireEvent.changeText(screen.getByTestId('login-username'), 'demo');
  await fireEvent.changeText(screen.getByTestId('login-password'), 'demo');
}

describe('LoginScreen (TV)', () => {
  afterEach(() => setUiLanguage('en'));

  it('signs in directly with the provider', async () => {
    setupApp({ signedIn: false });
    appContext.replaceApi(null);
    const panel = createFakePanel();
    globalThis.fetch = panel.fetch;

    await render(<App />);
    await flush();
    // No server choice or address (D-088).
    expect(screen.queryByTestId('login-backend')).toBeNull();
    expect(screen.queryByTestId('login-mode-server')).toBeNull();
    await fillLogin();
    await fireEvent.press(screen.getByTestId('login-submit'));
    await flush();

    expect(await screen.findByTestId('home-screen')).toBeTruthy();
    expect(stores.session.getState().account).toMatchObject({ serverUrl: 'http://panel.test:8080/', username: 'demo' });
    expect(panel.calls.every((url) => url.startsWith('http://panel.test:8080/player_api.php?'))).toBe(true);
  });

  it('Enter on the password field signs in', async () => {
    setupApp({ signedIn: false });
    appContext.replaceApi(null);
    globalThis.fetch = createFakePanel().fetch;

    await render(<App />);
    await flush();
    await fillLogin();
    await fireEvent(screen.getByTestId('login-password'), 'submitEditing');
    await flush();
    expect(await screen.findByTestId('home-screen')).toBeTruthy();
  });

  it('the app language (D-084): chosen on the sign-in page, then per profile from the account menu', async () => {
    setupApp({ signedIn: false });
    appContext.replaceApi(null);
    globalThis.fetch = createFakePanel().fetch;

    await render(<App />);
    await flush();
    await fireEvent.press(screen.getByTestId('login-language'));
    await fireEvent.press(screen.getByLabelText('Deutsch'));
    await flush();
    expect(i18nStore.getState().language).toBe('de');
    expect(screen.getAllByText('Anmelden').length).toBeGreaterThan(0);

    await fillLogin();
    await fireEvent.press(screen.getByTestId('login-submit'));
    await flush();
    expect(await screen.findByText('Startseite')).toBeTruthy();

    // Account menu → App → App language (also named in English, to be found in any language).
    await fireEvent.press(screen.getByTestId('nav-account'));
    await fireEvent.press(screen.getByTestId('menu-group-app'));
    expect(screen.getByText('App-Sprache · App language')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('menu-app-language'));
    await fireEvent.press(screen.getByTestId('app-language-pt-BR'));
    await flush();
    expect(await screen.findByText('Início')).toBeTruthy();
    const profileId = stores.session.getState().activeProfileId!;
    expect(stores.profilePrefs.getState().prefs[profileId]?.appLanguage).toBe('pt-BR');
  });
});
