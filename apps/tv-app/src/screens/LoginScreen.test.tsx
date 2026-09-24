import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { createFakePanel } from '../../../../packages/shared/src/testing/fakePanel';
import { stores } from '../appContext';
import { App } from '../App';
import { connectionStore } from '../hooks';
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
  it('signs in directly with the provider by default, without any backend', async () => {
    setupApp({ signedIn: false });
    await SecureStore.deleteItemAsync('connection');
    connectionStore.setState({ mode: 'direct', serverUrl: '', loaded: true });
    const panel = createFakePanel();
    globalThis.fetch = panel.fetch;

    await render(<App />);
    await flush();
    expect(screen.queryByTestId('login-backend')).toBeNull();
    await fillLogin();
    await fireEvent.press(screen.getByTestId('login-submit'));
    await flush();

    expect(await screen.findByTestId('home-screen')).toBeTruthy();
    expect(stores.session.getState().account).toMatchObject({ serverUrl: 'http://panel.test:8080/', username: 'demo' });
    expect(panel.calls.every((url) => url.startsWith('http://panel.test:8080/player_api.php?'))).toBe(true);
    expect(JSON.parse((await SecureStore.getItemAsync('connection'))!)).toEqual({ mode: 'direct', serverUrl: '' });
  });

  it('goes through the backend when "My server" is chosen', async () => {
    const backend = setupApp({ signedIn: false });
    connectionStore.setState({ mode: 'direct', serverUrl: '', loaded: true });
    backend.on('POST', '/api/auth/login', { status: 401, body: { code: 'invalid_provider_credentials' } });

    await render(<App />);
    await flush();
    await fireEvent.press(screen.getByTestId('login-mode-server'));
    expect(screen.getByTestId('login-submit')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('login-backend'), 'http://home-pc:5080/');
    await fillLogin();
    await fireEvent.press(screen.getByTestId('login-submit'));
    await flush();

    expect(connectionStore.getState()).toMatchObject({ mode: 'server', serverUrl: 'http://home-pc:5080' });
    expect(backend.calls.find((call) => call.url.pathname === '/api/auth/login')?.url.origin).toBe('http://home-pc:5080');
  });
});
