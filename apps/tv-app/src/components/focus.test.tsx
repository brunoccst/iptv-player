import { render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { FocusButton } from './FocusButton';
import { IconButton } from './IconButton';
import { createPageFocus, firstOnScreen, PageFocusContext, type PageView } from './pageFocus';

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

  it('TV: nothing behind the details panel asks for the focus, before or after it closes (D-069)', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    const page = (behind: boolean, cards: string[]) => (
      <PageFocusContext.Provider value={{ behind, register: () => () => undefined }}>
        <FocusButton label="Play" hasTVPreferredFocus onPress={() => undefined} testID="play" />
        {cards.map((id, index) => (
          <IconButton key={id} icon="play" label={id} testID={id} hasTVPreferredFocus={index === 0} onPress={() => undefined} />
        ))}
      </PageFocusContext.Provider>
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

  it('TV: closing the details puts the focus back on what opened them, or on the first view on screen (D-069)', async () => {
    const view = (x: number, y: number) =>
      ({
        requestTVFocus: jest.fn(),
        measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => callback(x, y, 100, 150),
      }) as unknown as PageView & { requestTVFocus: jest.Mock };
    const screenSize = { width: 960, height: 540 };
    const page = createPageFocus();
    const hero = view(40, 300);
    const offScreen = view(40, 700);
    const card = view(400, 380);
    const unregisterCard = page.register(card);
    page.register(offScreen);
    page.register(hero);

    page.focused({ target: card, nativeEvent: {} } as never);
    expect(await page.restore(screenSize)).toBe(card);
    expect(card.requestTVFocus).toHaveBeenCalledTimes(1);

    // The card went away (taken off My List): the first view on screen, top first, then left.
    unregisterCard();
    expect(await page.restore(screenSize)).toBe(hero);
    expect(hero.requestTVFocus).toHaveBeenCalledTimes(1);
    expect(offScreen.requestTVFocus).not.toHaveBeenCalled();

    expect(
      firstOnScreen(
        [
          { view: 'right', box: { x: 300, y: 102, width: 100, height: 150 } },
          { view: 'left', box: { x: 100, y: 100, width: 100, height: 150 } },
          { view: 'lower', box: { x: 0, y: 200, width: 100, height: 150 } },
          { view: 'above the screen', box: { x: 0, y: -200, width: 100, height: 150 } },
        ],
        screenSize,
      ),
    ).toBe('left');
  });
});
