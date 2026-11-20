import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Select } from './Select';

const options = [
  { value: '1', label: 'Season 1' },
  { value: '2', label: 'Season 2' },
];

describe('Select', () => {
  it.each([false, true])('shows the chosen value (compact: %s)', async (compact) => {
    await render(<Select compact={compact} label="Season" value="2" options={options} onChange={() => undefined} testID="season" />);
    const text = screen.getByText('Season 2');
    const style = StyleSheet.flatten(text.props.style) as Record<string, unknown>;
    if (compact) {
      // `flex` gives the text a zero basis, which Android TV did not undo: the box showed only its chevron.
      expect(style.flex).toBeUndefined();
      expect(style.flexBasis).toBeUndefined();
      expect(style.flexGrow).toBeUndefined();
    } else {
      expect(style.flex).toBe(1);
    }
  });
});
