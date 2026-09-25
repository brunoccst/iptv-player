import { fireEvent, render, screen } from '@testing-library/react-native';
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

    await fireEvent.press(screen.getByTestId('chips-less'));
    expect(screen.getByTestId('chips-line')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('chips-all'));
    await fireEvent.press(screen.getByTestId('chip-c'));
    expect(picked).toEqual(['c']);
    expect(screen.getByTestId('chips-line')).toBeTruthy();
  });
});
