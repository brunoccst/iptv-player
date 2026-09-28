import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { CenterPage } from '../components/CenterScroll';
import { useRowFocus } from '../components/FocusRow';
import { TvLines } from './titles';

function Card({ title }: { title: string }) {
  const rowFocus = useRowFocus();
  return (
    <Pressable accessibilityRole="button" onFocus={() => rowFocus?.()}>
      <Text>{title}</Text>
    </Pressable>
  );
}

const lines = Array.from({ length: 30 }, (_, i) => [{ id: `m${i}`, title: `Movie ${i}` }]) as never;
const layout = (y: number, height: number) => ({ nativeEvent: { layout: { x: 0, y, width: 900, height } } });

describe('TvLines (D-096, D-098)', () => {
  it('gives every line the first line’s height and centres the focused line from its place in the page, like Home', async () => {
    const centerAt = jest.fn();
    // The search results sit in a section 1000 px down the page.
    const parentY = { current: 1000 };
    await render(
      <CenterPage.Provider value={{ centerAt }}>
        <TvLines lines={lines} renderLine={(line) => <Card title={line[0]!.title} />} parentY={parentY} />
      </CenterPage.Provider>,
    );
    // The block starts 500 px into its section.
    await fireEvent(screen.getByTestId('grid-lines'), 'layout', layout(500, 12000));
    await fireEvent(screen.getByTestId('grid-line-0'), 'layout', layout(0, 400));
    expect(screen.getByTestId('grid-line-3')).toHaveStyle({ height: 400 });
    expect(screen.getByTestId('grid-spacer-7')).toHaveStyle({ height: 400 });

    // Each move scrolls once, on the same key press.
    await fireEvent(within(screen.getByTestId('grid-line-3')).getByRole('button'), 'focus');
    expect(centerAt).toHaveBeenCalledTimes(1);
    expect(centerAt).toHaveBeenLastCalledWith(1000 + 500 + 3 * 400, 400);
    await fireEvent(within(screen.getByTestId('grid-line-4')).getByRole('button'), 'focus');
    expect(centerAt).toHaveBeenCalledTimes(2);
    expect(centerAt).toHaveBeenLastCalledWith(1000 + 500 + 4 * 400, 400);
  });
});
