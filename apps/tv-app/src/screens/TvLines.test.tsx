import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
// @ts-expect-error -- untyped: the React Native jest preset's shared native-method mocks.
import MockNativeMethods from '@react-native/jest-preset/jest/MockNativeMethods';
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

describe('TvLines (D-096)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('gives every line the first line’s height and centres the focused line from its place, like Home', async () => {
    // The block starts 500 px down the page.
    jest
      .spyOn(MockNativeMethods, 'measureLayout')
      .mockImplementation(((_to: unknown, done: (...n: number[]) => void) => done(0, 500, 900, 0)) as never);
    const centerAt = jest.fn();
    await render(
      <CenterPage.Provider value={{ centerAt, inner: () => ({}) }}>
        <TvLines lines={lines} renderLine={(line) => <Card title={line[0]!.title} />} />
      </CenterPage.Provider>,
    );
    await fireEvent(screen.getByTestId('grid-line-0'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 900, height: 400 } } });
    expect(screen.getByTestId('grid-line-3')).toHaveStyle({ height: 400 });
    expect(screen.getByTestId('grid-spacer-7')).toHaveStyle({ height: 400 });

    await fireEvent(within(screen.getByTestId('grid-line-3')).getByRole('button'), 'focus');
    expect(centerAt).toHaveBeenLastCalledWith(500 + 3 * 400, 400);
    await fireEvent(within(screen.getByTestId('grid-line-4')).getByRole('button'), 'focus');
    expect(centerAt).toHaveBeenLastCalledWith(500 + 4 * 400, 400);
  });
});
