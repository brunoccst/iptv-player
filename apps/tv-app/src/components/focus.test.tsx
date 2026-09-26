import { render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { FocusButton } from './FocusButton';

describe('preferred focus', () => {
  afterEach(() => jest.restoreAllMocks());

  it('phones: buttons never ask for focus (it took focus from the search field when the keyboard opened)', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(false);
    await render(<FocusButton label="Play" hasTVPreferredFocus onPress={() => undefined} testID="play" />);
    expect(screen.getByTestId('play').props.hasTVPreferredFocus).toBeUndefined();
  });

  it('TV: the remote starts on the preferred button', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    await render(<FocusButton label="Play" hasTVPreferredFocus onPress={() => undefined} testID="play" />);
    expect(screen.getByTestId('play').props.hasTVPreferredFocus).toBe(true);
  });
});
