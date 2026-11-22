import { fireEvent, render, screen, within } from '@testing-library/react-native';
import * as ReactNative from 'react-native';
import { Text } from 'react-native';
import { Dialog } from '@iptv/screens/src/ui/Dialog';
import { DialogActions } from '@iptv/screens/src/ui/DialogActions';
import { FocusButton } from '@iptv/screens/src/ui/FocusButton';
import { Chip } from '@iptv/screens/src/ui/ChipBar';
import { CheckRow } from '@iptv/screens/src/ui/CheckRow';
import { Field } from '@iptv/screens/src/ui/Field';
import { FocusRow } from '@iptv/screens/src/ui/FocusRow';
import { forwardRef, useImperativeHandle, type ComponentProps } from 'react';

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

describe('Dialog tabs and the Save column on TV (D-247)', () => {
  // The destinations each focus guide was given, by testID.
  let destinations: Record<string, unknown[][]>;
  beforeEach(() => {
    destinations = {};
    jest.spyOn(ReactNative.Platform, 'isTV', 'get').mockReturnValue(true);
    const Guide = forwardRef<unknown, ComponentProps<typeof ReactNative.View>>(function Guide(props, ref) {
      useImperativeHandle(ref, () => ({
        setDestinations: (list: unknown[]) => (destinations[props.testID ?? '?'] ??= []).push(list),
      }));
      return <ReactNative.View {...props} />;
    });
    jest.spyOn(ReactNative as { TVFocusGuideView: unknown }, 'TVFocusGuideView', 'get').mockReturnValue(Guide);
    wide(960);
  });
  afterEach(() => jest.restoreAllMocks());

  function tabs() {
    return (
      <Dialog
        title="Categories shown"
        onClose={() => undefined}
        actions={<DialogActions onSave={() => undefined} onCancel={() => undefined} saveTestID="save" />}
      >
        <FocusRow testID="tabs">
          <Chip label="Movies" active onPress={() => undefined} testID="tab-movies" />
          <Chip label="Live TV" active={false} onPress={() => undefined} testID="tab-live" />
        </FocusRow>
        <Field label="Filter categories" value="" onChange={() => undefined} testID="filter" compact />
        <CheckRow label="News" checked onPress={() => undefined} testID="row-news" />
      </Dialog>
    );
  }

  it('Right from the last tab may leave the row for Save; Left still stops at the first tab', async () => {
    await render(tabs());
    expect(screen.getByTestId('tabs').props).toMatchObject({ trapFocusLeft: true, trapFocusRight: false });
  });

  it('a row elsewhere still keeps Right at its end', async () => {
    await render(
      <FocusRow testID="line">
        <Chip label="Movies" active onPress={() => undefined} />
      </FocusRow>,
    );
    expect(screen.getByTestId('line').props).toMatchObject({ trapFocusLeft: true, trapFocusRight: true });
  });

  it('Left from Save goes back to the tab last focused, also after the filter; after a list row, to that row', async () => {
    await render(tabs());
    const sent = () => destinations['dialog-content'] ?? [];
    await fireEvent(screen.getByTestId('tab-live'), 'focus');
    expect(sent()).toHaveLength(1);
    const [live] = sent();
    expect(live).toHaveLength(1);
    expect(live?.[0]).toBeTruthy();
    // The filter under the tabs keeps the tab as the way back.
    await fireEvent(screen.getByTestId('filter'), 'focus');
    expect(sent()).toHaveLength(1);
    // A list row: Left from Save returns to the row the D-pad left (D-233), so no destination.
    await fireEvent(screen.getByTestId('row-news'), 'focus');
    expect(sent()[1]).toEqual([]);
    await fireEvent(screen.getByTestId('tab-movies'), 'focus');
    const movies = sent()[2];
    expect(movies).toHaveLength(1);
    expect(movies?.[0]).not.toBe(live?.[0]);
  });

  it('the buttons in the column change nothing', async () => {
    await render(tabs());
    await fireEvent(screen.getByTestId('save'), 'focus');
    expect(destinations['dialog-content']).toBeUndefined();
  });
});
