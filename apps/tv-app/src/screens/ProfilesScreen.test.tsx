import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { stores } from '../appContext';
import { App } from '../App';
import { profile, setupApp } from '../../test/utils';

async function flush() {
  await act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });
}

describe('Profiles (TV)', () => {
  it('adds a profile from the profile picker, like the web', async () => {
    const backend = setupApp();
    backend.on('POST', '/api/profiles', ({ body }) => ({
      body: { id: 'p2', avatarKey: null, isKids: false, ...(body as object) },
    }));
    await render(<App />);
    await flush();
    await act(async () => stores.session.getState().selectProfile(null));

    expect(screen.getByText("Who's watching?")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Add Profile'));
    await fireEvent.changeText(screen.getByTestId('profile-name'), 'Kids');
    await fireEvent.press(screen.getByLabelText('Kids profile'));
    await fireEvent.press(screen.getByTestId('profile-save'));
    await flush();

    expect(backend.calls.find((c) => c.url.pathname === '/api/profiles' && c.method === 'POST')?.body).toMatchObject({
      name: 'Kids',
      isKids: true,
    });
    expect(stores.session.getState().profiles.map((p) => p.name)).toEqual([profile.name, 'Kids']);
  });
});

describe('Parental PIN (TV, D-054)', () => {
  const typePin = async (pin: string) => {
    for (const digit of pin) await fireEvent.press(screen.getByTestId(`pin-key-${digit}`));
    await flush();
  };

  it('asks for the PIN before opening a regular profile or managing profiles, only when one is set', async () => {
    setupApp();
    await render(<App />);
    await flush();
    await act(async () => stores.session.getState().selectProfile(null));

    // No PIN: nothing is locked.
    await fireEvent.press(screen.getByLabelText('Manage Profiles'));
    expect(screen.queryByTestId('pin-pad')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Done'));

    await act(async () => void (await stores.pin.getState().setPin('2468')));
    await fireEvent.press(screen.getByLabelText(profile.name));
    expect(screen.getByTestId('pin-pad')).toBeTruthy();
    await typePin('1111');
    expect(screen.getByText('Wrong PIN.')).toBeTruthy();
    expect(stores.session.getState().activeProfileId).toBeNull();
    await typePin('2468');
    expect(stores.session.getState().activeProfileId).toBe(profile.id);
  });

  it('sets a PIN from the account menu, typed twice', async () => {
    setupApp();
    await render(<App />);
    await flush();
    await act(async () => stores.session.getState().selectProfile(profile.id));
    await fireEvent.press(screen.getByTestId('nav-account'));
    await fireEvent.press(screen.getByTestId('menu-pin'));
    await typePin('1357');
    await typePin('1357');
    expect(stores.pin.getState().status).toBe('set');
    expect(screen.getByText(/PIN set/)).toBeTruthy();
  });
});
