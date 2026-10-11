import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Platform, Pressable } from 'react-native';
import { pressRemote } from '../../test/remoteMock';
import { moveFocus } from './focusGrid';
import { useKeepFocusAfterPress } from './keepFocus';

jest.mock('./focusGrid', () => ({ moveFocus: jest.fn() }));

function Button() {
  const keep = useKeepFocusAfterPress();
  return <Pressable testID="button" ref={keep.focusRef} onPress={keep.pressed} onBlur={keep.onBlur} />;
}

async function blur() {
  await act(async () => {
    await fireEvent(screen.getByTestId('button'), 'blur');
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('useKeepFocusAfterPress (D-170)', () => {
  beforeEach(() => {
    jest.mocked(moveFocus).mockClear();
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
  });
  afterEach(() => jest.restoreAllMocks());

  it('puts the focus back after a press until an arrow key moves on', async () => {
    await render(<Button />);
    await blur();
    expect(moveFocus).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('button'));
    await blur();
    expect(moveFocus).toHaveBeenCalledTimes(1);
    // OK itself does not end it; a later steal is undone too.
    await act(async () => pressRemote('select', 'up'));
    await blur();
    expect(moveFocus).toHaveBeenCalledTimes(2);

    await act(async () => pressRemote('right', 'down'));
    await blur();
    expect(moveFocus).toHaveBeenCalledTimes(2);
  });

  it('does nothing on phones', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(false);
    await render(<Button />);
    await fireEvent.press(screen.getByTestId('button'));
    await blur();
    expect(moveFocus).not.toHaveBeenCalled();
  });
});
