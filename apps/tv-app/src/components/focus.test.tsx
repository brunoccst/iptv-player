import { render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { FocusButton } from './FocusButton';
import { IconButton } from './IconButton';
import { BehindPanel } from './focus';

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

  it('TV: nothing behind the details panel asks for the focus, before or after it closes (D-170)', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    const page = (behind: boolean, cards: string[]) => (
      <BehindPanel.Provider value={behind}>
        <FocusButton label="Play" hasTVPreferredFocus onPress={() => undefined} testID="play" />
        {cards.map((id, index) => (
          <IconButton key={id} icon="play" label={id} testID={id} hasTVPreferredFocus={index === 0} onPress={() => undefined} />
        ))}
      </BehindPanel.Provider>
    );
    const preferred = (testID: string) => screen.getByTestId(testID).props.hasTVPreferredFocus;
    const view = await render(page(false, ['a', 'b']));
    expect([preferred('play'), preferred('a'), preferred('b')]).toEqual([true, true, false]);

    // The panel opens; My List gets a new first title, then loses "a".
    await view.rerender(page(true, ['a', 'b']));
    await view.rerender(page(true, ['new', 'a', 'b']));
    expect([preferred('play'), preferred('new'), preferred('a')]).toEqual([true, false, true]);
    await view.rerender(page(true, ['new', 'b']));
    expect(preferred('new')).toBe(false);
    // Closed: still nothing new asks (the focus does not jump), until a value changes again.
    await view.rerender(page(false, ['new', 'b']));
    expect([preferred('play'), preferred('new'), preferred('b')]).toEqual([true, false, false]);
    await view.rerender(page(false, ['b', 'new']));
    expect([preferred('b'), preferred('new')]).toEqual([true, false]);
  });
});
