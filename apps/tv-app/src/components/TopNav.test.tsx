import { act, render, screen } from '@testing-library/react-native';
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
});
