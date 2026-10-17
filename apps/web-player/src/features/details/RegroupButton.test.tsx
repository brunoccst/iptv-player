// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.stubEnv('APP_NAME', 'Test App');
vi.stubEnv('APP_SLUG', 'test-app');

const regroup = { available: true, merged: false, splitOff: true, busy: false, error: null, split: vi.fn(), merge: vi.fn(), undo: vi.fn() };
vi.mock('../../hooks/stores', () => ({
  useRegroup: () => regroup,
  useMergeCandidates: (_section: string, query: string) =>
    query.length < 2
      ? null
      : [{ id: 'm2', title: 'Big Movie Typo', year: 2020, posterUrl: null, rating: null, bestQuality: null, variantCount: 2 }],
}));

const { RegroupButton } = await import('./RegroupButton');

const variant = (streamId: string, label: string) => ({
  streamId,
  label,
  quality: null,
  source: null,
  audioLanguages: [],
  audioTag: null,
  isHdr: false,
  containerExtension: 'mp4',
  categoryId: null,
  rawTitle: label,
  subtitleLanguages: [],
});
const master = {
  id: 'm1',
  title: 'Big Movie',
  year: 2020,
  posterUrl: null,
  rating: null,
  bestQuality: null,
  variants: [variant('a', '4K'), variant('b', 'CAM')],
  regrouping: { merged: false, splitOff: true },
};

describe('split or merge titles by hand (issue #243)', () => {
  afterEach(cleanup);

  it('splits off the chosen version, merges a title found by name, or puts a split-off title back', () => {
    render(<RegroupButton section="movies" master={master} variant={master.variants[1]!} />);
    fireEvent.click(screen.getByTestId('details-regroup'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Split off this version (CAM)' }));
    expect(regroup.split).toHaveBeenCalledWith('b');

    fireEvent.click(screen.getByTestId('details-regroup'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Put back with its title' }));
    expect(regroup.undo).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('details-regroup'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Merge with another title…' }));
    const dialog = screen.getByRole('dialog', { name: 'Merge with another title' });
    expect(screen.getByLabelText('Title to merge')).toHaveProperty('value', 'Big Movie');
    fireEvent.click(screen.getByRole('button', { name: /Big Movie Typo \(2020\)/ }));
    expect(regroup.merge).toHaveBeenCalledWith('m2');
    expect(dialog.isConnected).toBe(false);
  });
});
