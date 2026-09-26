import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { App } from '../App';
import { stores } from '../appContext';
import { setupApp } from '../../test/utils';

async function flush() {
  await act(async () => {
    for (let i = 0; i < 30; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('account menu → Language (D-063)', () => {
  it('filters the library for the active profile and remembers the choice', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/library/movies', { body: { total: 0, items: [], sorts: ['title'] } });
    backend.on('GET', '/api/library/series', { body: { total: 0, items: [], sorts: ['title'] } });
    await render(<App />);
    await flush();
    const languages = () =>
      backend.calls.filter((call) => call.url.pathname.startsWith('/api/library/')).map((call) => call.url.searchParams.get('language'));
    expect(languages().every((language) => language === null)).toBe(true);

    await fireEvent.press(screen.getByTestId('nav-account'));
    await fireEvent.press(screen.getByTestId('menu-language'));
    await fireEvent.press(screen.getByTestId('language-GER'));
    await flush();

    expect(stores.profilePrefs.getState().prefs.p1).toEqual({ language: 'GER' });
    expect(languages().at(-1)).toBe('GER');
    expect(screen.queryByTestId('language-settings')).toBeNull();
  });
});
