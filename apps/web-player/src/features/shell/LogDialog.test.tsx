// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../browse/screenHost', () => ({}));
vi.mock('../../config', () => ({ appConfig: { appName: 'Player', appSlug: 'player' } }));
vi.mock('../../desktop', () => ({ desktop: null }));

describe('log dialog', () => {
  afterEach(cleanup);

  it('closes with the X at its top right (D-236)', async () => {
    const { LogDialog } = await import('./LogDialog');
    const onClose = vi.fn();
    render(<LogDialog onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
