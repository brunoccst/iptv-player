import { fireEvent, render, screen } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import { ChipBar, type ChipItem } from './ChipBar';

function chips(active: string, onPress: (key: string) => void): ChipItem[] {
  return ['all', 'a', 'b', 'c'].map((key) => ({
    key,
    label: key.toUpperCase(),
    active: key === active,
    testID: `chip-${key}`,
    onPress: () => onPress(key),
  }));
}

describe('ChipBar', () => {
  it('shows "Show all" only when the chips overflow the line', async () => {
    await render(<ChipBar label="Categories" testID="chips" chips={chips('all', () => undefined)} />);
    const line = screen.getByTestId('chips-line');
    await fireEvent(line, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 40 } } });
    await fireEvent(line, 'contentSizeChange', 300, 40);
    expect(screen.queryByTestId('chips-all')).toBeNull();

    await fireEvent(line, 'contentSizeChange', 900, 40);
    expect(screen.getByTestId('chips-all')).toBeTruthy();
  });

  it('expands to all chips, collapses with "Show less", and collapses after a pick', async () => {
    const picked: string[] = [];
    await render(<ChipBar label="Categories" testID="chips" chips={chips('all', (key) => picked.push(key))} />);
    const line = screen.getByTestId('chips-line');
    await fireEvent(line, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 40 } } });
    await fireEvent(line, 'contentSizeChange', 900, 40);

    await fireEvent.press(screen.getByTestId('chips-all'));
    expect(screen.queryByTestId('chips-line')).toBeNull();
    expect(screen.getByTestId('chips-less')).toHaveProp('accessibilityState', { expanded: true });
    // The chips scroll in their own box of at most half the screen, so "Show less" stays in view (D-091).
    expect(screen.getByTestId('chips-box')).toHaveStyle({ maxHeight: Math.round(Dimensions.get('window').height * 0.5) });

    await fireEvent.press(screen.getByTestId('chips-less'));
    expect(screen.getByTestId('chips-line')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('chips-all'));
    await fireEvent.press(screen.getByTestId('chip-c'));
    expect(picked).toEqual(['c']);
    expect(screen.getByTestId('chips-line')).toBeTruthy();
  });

  it('renders thousands of categories a page at a time, the chosen one included (D-093)', async () => {
    const many: ChipItem[] = Array.from({ length: 3000 }, (_, index) => ({
      key: String(index),
      label: `Category ${index}`,
      active: index === 1200,
      testID: `chip-${index}`,
      onPress: () => undefined,
    }));
    await render(<ChipBar label="Categories" testID="chips" chips={many} />);
    const line = screen.getByTestId('chips-line');
    // One page, with the chosen category right after the first chip.
    const tabs = () => screen.getAllByRole('tab').map((tab) => tab.props.testID as string);
    expect(tabs()).toHaveLength(40);
    expect(tabs().slice(0, 3)).toEqual(['chip-0', 'chip-1200', 'chip-1']);

    // Scrolling toward the end of the line adds the next page.
    const scrolled = (x: number) => ({
      nativeEvent: { contentOffset: { x, y: 0 }, layoutMeasurement: { width: 800, height: 40 }, contentSize: { width: 4000, height: 40 } },
    });
    await fireEvent.scroll(line, scrolled(100));
    expect(tabs()).toHaveLength(40);
    await fireEvent.scroll(line, scrolled(3000));
    expect(tabs()).toHaveLength(80);

    // Expanded, the box starts with one page and grows as it scrolls down.
    await fireEvent(line, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 40 } } });
    await fireEvent(line, 'contentSizeChange', 20_000, 40);
    await fireEvent.press(screen.getByTestId('chips-all'));
    const box = screen.getByTestId('chips-box');
    const before = screen.getAllByRole('tab').length;
    expect(before).toBe(150);
    await fireEvent.scroll(box, {
      nativeEvent: {
        contentOffset: { x: 0, y: 3900 },
        layoutMeasurement: { width: 800, height: 400 },
        contentSize: { width: 800, height: 4400 },
      },
    });
    expect(screen.getAllByRole('tab').length).toBe(300);
  });
});
