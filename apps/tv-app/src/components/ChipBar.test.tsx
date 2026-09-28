import { fireEvent, render, screen } from '@testing-library/react-native';
import { Dimensions, Platform } from 'react-native';
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

  it('TV: "All", three categories, ‹ › to page through them, then "Show all" (D-094)', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    const picked: string[] = [];
    const many: ChipItem[] = ['all', ...Array.from({ length: 10 }, (_, i) => `c${i}`)].map((key) => ({
      key,
      label: key,
      active: key === 'all',
      testID: `chip-${key}`,
      onPress: () => picked.push(key),
    }));
    await render(<ChipBar label="Categories" testID="chips" chips={many} />);
    const tabs = () => screen.getAllByRole('tab').map((tab) => tab.props.testID as string);
    expect(tabs()).toEqual(['chip-all', 'chip-c0', 'chip-c1', 'chip-c2']);
    expect(screen.getByTestId('chips-all')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('chips-next'));
    expect(tabs()).toEqual(['chip-all', 'chip-c3', 'chip-c4', 'chip-c5']);
    await fireEvent.press(screen.getByTestId('chips-next'));
    await fireEvent.press(screen.getByTestId('chips-next'));
    expect(tabs()).toEqual(['chip-all', 'chip-c7', 'chip-c8', 'chip-c9']);
    await fireEvent.press(screen.getByTestId('chips-next'));
    expect(tabs()).toEqual(['chip-all', 'chip-c7', 'chip-c8', 'chip-c9']);
    await fireEvent.press(screen.getByTestId('chips-prev'));
    expect(tabs()).toEqual(['chip-all', 'chip-c4', 'chip-c5', 'chip-c6']);
    await fireEvent.press(screen.getByTestId('chip-c5'));
    expect(picked).toEqual(['c5']);
    jest.restoreAllMocks();
  });

  it('TV: opens with the chosen category in view', async () => {
    jest.spyOn(Platform, 'isTV', 'get').mockReturnValue(true);
    const many: ChipItem[] = ['all', ...Array.from({ length: 10 }, (_, i) => `c${i}`)].map((key) => ({
      key,
      label: key,
      active: key === 'c6',
      testID: `chip-${key}`,
      onPress: () => undefined,
    }));
    await render(<ChipBar label="Categories" testID="chips" chips={many} />);
    expect(screen.getAllByRole('tab').map((tab) => tab.props.testID)).toEqual(['chip-all', 'chip-c5', 'chip-c6', 'chip-c7']);
    jest.restoreAllMocks();
  });
});
