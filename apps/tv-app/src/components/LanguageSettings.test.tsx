import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { App } from '../App';
import { stores } from '../appContext';
import { setupApp } from '../../test/utils';

async function flush() {
  await act(async () => {
    for (let i = 0; i < 30; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('account menu → Languages (D-063, D-067)', () => {
  it('filters the library by one or more languages for the active profile and remembers the choice', async () => {
    const backend = setupApp();
    backend.on('GET', '/api/library/movies', { body: { total: 0, items: [], sorts: ['title'] } });
    backend.on('GET', '/api/library/series', { body: { total: 0, items: [], sorts: ['title'] } });
    await render(<App />);
    await flush();
    const languages = () =>
      backend.calls.filter((call) => call.url.pathname.startsWith('/api/library/')).map((call) => call.url.searchParams.get('language'));
    expect(languages().every((language) => language === null)).toBe(true);

    await fireEvent.press(screen.getByTestId('nav-account'));
    await fireEvent.press(screen.getByTestId('menu-group-profiles'));
    await fireEvent.press(screen.getByTestId('menu-language'));
    expect(screen.getByText('Languages for Alex')).toBeTruthy();
    const requestsBefore = backend.calls.length;
    await fireEvent.press(screen.getByTestId('language-GER'));
    await fireEvent.press(screen.getByTestId('language-POR'));
    await fireEvent.press(screen.getByTestId('language-ENG'));
    await fireEvent.press(screen.getByTestId('language-POR'));
    expect(screen.getByText('✓ German')).toBeTruthy();
    // Toggling only ticks: nothing is saved or reloaded until the dialog closes (a reload per toggle stalled the TV).
    await flush();
    expect(backend.calls.length).toBe(requestsBefore);
    expect(stores.profilePrefs.getState().prefs.p1).toBeUndefined();
    await fireEvent.press(screen.getByTestId('language-close'));
    await flush();

    expect(stores.profilePrefs.getState().prefs.p1).toMatchObject({ languages: ['GER', 'ENG'] });
    expect(languages().at(-1)).toBe('GER,ENG');
    expect(screen.queryByTestId('language-settings')).toBeNull();

    // "All languages" clears the choice.
    await fireEvent.press(screen.getByTestId('nav-account'));
    await fireEvent.press(screen.getByTestId('menu-group-profiles'));
    await fireEvent.press(screen.getByTestId('menu-language'));
    await fireEvent.press(screen.getByTestId('language-all'));
    await fireEvent.press(screen.getByTestId('language-close'));
    await flush();
    expect(languages().at(-1)).toBeNull();
  });
});
