import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { FocusRow, RowFocus } from './FocusRow';
import { PosterCard } from './PosterCard';
import { Row } from './Row';

describe('focus rows (TV)', () => {
  beforeEach(() => jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true));
  afterEach(() => jest.restoreAllMocks());

  it('Left/Right stay in a row of cards, the "See all" card included; Up/Down leave it', async () => {
    await render(
      <Row
        title="Drama"
        items={['a', 'b']}
        keyOf={(id) => id}
        render={(id) => <PosterCard title={id} onPress={() => undefined} />}
        more={{ onPress: () => undefined }}
        testID="row"
      />,
    );
    const guide = screen.getByTestId('row-more').parent;
    let node = guide;
    // The first ancestor that traps (the list's own scroll view reports `false`).
    while (node && node.props.trapFocusRight !== true) node = node.parent;
    expect(node?.props).toMatchObject({ trapFocusLeft: true, trapFocusRight: true });
    expect(node?.props.trapFocusUp).toBeFalsy();
    // TV: the row's scroll view leaves the arrow keys to the focus search (holding Right reaches "See all", D-075).
    let scroll = screen.getByTestId('row-more').parent;
    while (scroll && scroll.props.scrollEnabled === undefined) scroll = scroll.parent;
    expect(scroll?.props.scrollEnabled).toBe(false);
  });

  it('a focused card asks the page to centre its row', async () => {
    const center = jest.fn();
    await render(
      <RowFocus.Provider value={center}>
        <FocusRow>
          <PosterCard title="Heat" onPress={() => undefined} />
        </FocusRow>
      </RowFocus.Provider>,
    );
    await fireEvent(screen.getByTestId('card-Heat'), 'focus');
    expect(center).toHaveBeenCalledTimes(1);
  });
});
