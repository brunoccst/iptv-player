// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScreenHostProvider, type ScreenHost } from '@iptv/screens';
import { RegroupButton } from '@iptv/screens/src/ui/RegroupButton';

const regroup = { available: true, merged: false, splitOff: true, busy: false, error: null, split: vi.fn(), merge: vi.fn(), undo: vi.fn() };
const host = {
  hooks: {
    useRegroup: () => regroup,
    useMergeCandidates: (_section: string, query: string) =>
      query.length < 2
        ? null
        : [{ id: 'm2', title: 'Big Movie Typo', year: 2020, posterUrl: null, rating: null, bestQuality: null, variantCount: 2 }],
  },
  details: { replace: vi.fn() },
} as unknown as ScreenHost;

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

describe('split or merge titles by hand on the desktop (issue #243)', () => {
  afterEach(cleanup);

  it('splits off the chosen version, merges a title found by name, or puts a split-off title back', () => {
    render(
      <ScreenHostProvider value={host}>
        <RegroupButton section="movies" master={master} variant={master.variants[1]!} />
      </ScreenHostProvider>,
    );
    fireEvent.click(screen.getByTestId('details-regroup'));
    fireEvent.click(screen.getByRole('button', { name: 'Split off this version (CAM)' }));
    expect(regroup.split).toHaveBeenCalledWith('b');

    fireEvent.click(screen.getByTestId('details-regroup'));
    fireEvent.click(screen.getByRole('button', { name: 'Put back with its title' }));
    expect(regroup.undo).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('details-regroup'));
    fireEvent.click(screen.getByRole('button', { name: 'Merge with another title…' }));
    expect(screen.getByRole('dialog', { name: 'Merge with another title' })).toBeTruthy();
    expect(screen.getByLabelText('Title to merge')).toHaveProperty('value', 'Big Movie');
    fireEvent.click(screen.getByRole('button', { name: /Big Movie Typo \(2020\)/ }));
    expect(regroup.merge).toHaveBeenCalledWith('m2');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes only the picker on Escape, not the details under it', () => {
    const detailsEscape = vi.fn();
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && detailsEscape();
    window.addEventListener('keydown', onKey);
    render(
      <ScreenHostProvider value={host}>
        <RegroupButton section="movies" master={master} variant={master.variants[1]!} />
      </ScreenHostProvider>,
    );
    fireEvent.click(screen.getByTestId('details-regroup'));
    fireEvent.click(screen.getByRole('button', { name: 'Merge with another title…' }));
    act(() => {
      screen.getByLabelText('Title to merge').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(screen.queryByRole('dialog', { name: 'Merge with another title' })).toBeNull();
    expect(detailsEscape).not.toHaveBeenCalled();
    window.removeEventListener('keydown', onKey);
  });
});
