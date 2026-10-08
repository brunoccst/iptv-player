// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { DetailsLayout, SPLIT_QUERY, SplitLayout } from './DetailsLayout';

const parts = {
  backdrop: 'http://img/backdrop.jpg',
  title: 'Big Test Movie',
  watched: true,
  actions: <button type="button">Play</button>,
  main: <p>A plot.</p>,
  side: <p>Cast: Someone</p>,
};

describe('details in two columns on wide landscape windows (D-158, D-164)', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('movie: title, buttons and plot on the left; cast and the other facts on the right', () => {
    render(
      <SplitLayout.Provider value>
        <DetailsLayout {...parts} />
      </SplitLayout.Provider>,
    );
    const left = screen.getByTestId('details-left');
    const right = screen.getByTestId('details-right');
    expect(left.textContent).toContain('Big Test Movie');
    expect(left.querySelector('[data-testid="watched-tag"]')).not.toBeNull();
    expect(left.textContent).toContain('Play');
    expect(left.textContent).toContain('A plot.');
    expect(left.textContent).not.toContain('Cast:');
    expect(right.textContent).toContain('Cast: Someone');
    expect(document.querySelector('.details__hero')).toBeNull();
  });

  it('series: the episodes on the right; cast and genres stay on the left', () => {
    render(
      <SplitLayout.Provider value>
        <DetailsLayout {...parts} list={<section aria-label="Episodes">S1:E1</section>} />
      </SplitLayout.Provider>,
    );
    expect(screen.getByTestId('details-right').textContent).toBe('S1:E1');
    expect(screen.getByTestId('details-left').textContent).toContain('Cast: Someone');
  });

  it('narrow or portrait windows keep the panel: backdrop with the title and buttons, then the rest', () => {
    render(<DetailsLayout {...parts} list={<section aria-label="Episodes">S1:E1</section>} />);
    expect(screen.queryByTestId('details-left')).toBeNull();
    expect(document.querySelector('.details__hero')?.textContent).toContain('Play');
    expect(document.querySelector('.details__body')?.textContent).toContain('Cast: Someone');
  });

  it('follows the window: the layout switches when the query starts or stops matching', () => {
    let matches = false;
    const listeners = new Set<() => void>();
    const matchMedia = vi.fn((query: string) => ({
      get matches() {
        return matches;
      },
      media: query,
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    }));
    vi.stubGlobal('matchMedia', matchMedia);
    function Probe() {
      return <span>{useMediaQuery(SPLIT_QUERY) ? 'split' : 'panel'}</span>;
    }
    render(<Probe />);
    expect(screen.getByText('panel')).toBeTruthy();
    expect(matchMedia).toHaveBeenCalledWith('(orientation: landscape) and (min-width: 700px)');
    act(() => {
      matches = true;
      listeners.forEach((listener) => listener());
    });
    expect(screen.getByText('split')).toBeTruthy();
  });
});
