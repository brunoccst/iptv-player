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
