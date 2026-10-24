// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScreenHostProvider, type ScreenHost } from '@iptv/screens';

const play = vi.fn();
const dismiss = vi.fn();
const reminder = { title: 'Evening News', start: 0, channel: { id: 'c1', name: 'News One' } };
const due = { reminder, dismiss, target: { kind: 'live', streamId: 'c1' } };
vi.mock('../../appContext', () => ({ uiStore: { getState: () => ({ play }) } }));
vi.mock('../../hooks/stores', () => ({ useDueReminder: () => due }));
vi.mock('../browse/screenHost', () => ({}));

const host = { hooks: { useDueReminder: () => due } } as unknown as ScreenHost;

describe('guide reminder (issue #239, D-214)', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const show = async () => {
    const { Reminder } = await import('./Reminder');
    render(
      <ScreenHostProvider value={host}>
        <Reminder />
      </ScreenHostProvider>,
    );
    return screen.getByRole('dialog', { name: 'Reminder' });
  };

  it('shows the programme and channel; Watch dismisses it and plays the channel', async () => {
    const dialog = await show();
    expect(dialog.textContent).toContain('Starting now: Evening News');
    expect(dialog.textContent).toContain('News One');
    fireEvent.click(screen.getByRole('button', { name: 'Watch' }));
    expect(dismiss).toHaveBeenCalled();
    expect(play).toHaveBeenCalledWith(due.target);
  });

  it('Dismiss and Escape only dismiss it', async () => {
    await show();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(dismiss).toHaveBeenCalledTimes(2);
    expect(play).not.toHaveBeenCalled();
  });
});
