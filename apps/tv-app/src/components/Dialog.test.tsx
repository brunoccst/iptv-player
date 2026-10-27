import { fireEvent, render, screen, within } from '@testing-library/react-native';
import * as ReactNative from 'react-native';
import { Text } from 'react-native';
import { Dialog } from '@iptv/screens/src/ui/Dialog';
import { DialogActions } from '@iptv/screens/src/ui/DialogActions';
import { FocusButton } from '@iptv/screens/src/ui/FocusButton';

function wide(width: number) {
  jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width, height: 540, scale: 1, fontScale: 1 });
}

function box(onSave: () => void) {
  return (
    <Dialog
      title="Languages"
      onClose={() => undefined}
      actions={
        <DialogActions onSave={onSave} onCancel={() => undefined} saveTestID="save" cancelTestID="cancel">
          <FocusButton label="Automatic" onPress={() => undefined} testID="extra" />
        </DialogActions>
      }
    >
      <Text>A long list</Text>
    </Dialog>
  );
}

describe('Dialog actions (D-233)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('stands Save, Cancel and extra buttons in a column on the right of the content', async () => {
    wide(960);
    const saved: string[] = [];
    await render(box(() => saved.push('save')));
    const side = screen.getByTestId('dialog-side');
    const order = within(side)
      .getAllByRole('button')
      .map((button) => button.props.testID as string);
    expect(order).toEqual(['save', 'cancel', 'extra']);
    expect(within(screen.getByTestId('dialog-content')).getByText('A long list')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('save'));
    expect(saved).toEqual(['save']);
  });

  it('keeps them under the content on a narrow window (a phone held upright)', async () => {
    wide(400);
    await render(box(() => undefined));
    expect(screen.queryByTestId('dialog-side')).toBeNull();
    expect(screen.getByTestId('save')).toBeTruthy();
  });
});
