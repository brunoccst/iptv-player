import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { App } from '../App';
import { setupApp } from '../../test/utils';

async function flush() {
  await act(async () => {
    for (let i = 0; i < 20; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('TV top nav', () => {
  it('keeps left/right focus in the nav row; up/down leave it', async () => {
    setupApp();
    await render(<App />);
    await flush();
    expect(screen.getByTestId('top-nav').props).toMatchObject({ trapFocusLeft: true, trapFocusRight: true });
    expect(screen.getByTestId('top-nav').props.trapFocusUp).toBeFalsy();
    expect(screen.getByTestId('top-nav').props.trapFocusDown).toBeFalsy();
  });

  it('TV: the D-pad focuses the search box, not its text field; OK starts typing', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    setupApp();
    await render(<App />);
    await flush();
    expect(screen.getByTestId('nav-search').props.focusable).toBe(false);
    await fireEvent.press(screen.getByTestId('nav-search-box'));
    expect(screen.getByTestId('nav-search').props.focusable).toBe(true);
    await fireEvent(screen.getByTestId('nav-search'), 'blur');
    expect(screen.getByTestId('nav-search').props.focusable).toBe(false);
    jest.restoreAllMocks();
  });
});
