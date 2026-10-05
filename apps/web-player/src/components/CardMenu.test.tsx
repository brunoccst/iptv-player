// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PosterCard } from './PosterCard';
import { CardMenu } from './CardMenu';

describe('card menu (right-click, D-079)', () => {
  afterEach(cleanup);

  it('a right-click on a card opens its menu at the pointer; the keyboard opens it at the card', () => {
    const onMenu = vi.fn();
    render(<PosterCard title="Show" onSelect={() => undefined} onMenu={onMenu} />);
    const card = screen.getByRole('button', { name: 'Show' }).closest('article')!;
    const event = fireEvent.contextMenu(card, { clientX: 120, clientY: 80 });
    expect(event).toBe(false); // the browser's own menu is suppressed
    expect(onMenu).toHaveBeenLastCalledWith({ x: 120, y: 80 });
    fireEvent.contextMenu(card, { clientX: 0, clientY: 0 });
    expect(onMenu).toHaveBeenLastCalledWith({ x: 12, y: 12 });
  });

  it('a title on My List carries a bookmark on its cover (issue #157)', () => {
    const { rerender } = render(<PosterCard title="Movie" onSelect={() => undefined} />);
    expect(screen.queryByRole('img', { name: 'On My List' })).toBeNull();
    rerender(<PosterCard title="Movie" onList onSelect={() => undefined} />);
    expect(screen.getByRole('img', { name: 'On My List' }).closest('.card__art')).not.toBeNull();
  });

  it('cards without a menu keep the browser menu', () => {
    render(<PosterCard title="Movie" onSelect={() => undefined} />);
    const card = screen.getByRole('button', { name: 'Movie' }).closest('article')!;
    expect(fireEvent.contextMenu(card, { clientX: 10, clientY: 10 })).toBe(true);
  });

  it('lists the actions then Cancel; ↑/↓ move, an action runs and closes; Escape and outside clicks close', () => {
    const onClose = vi.fn();
    const remove = vi.fn();
    render(
      <CardMenu
        title="Show"
        subtitle="S1:E3"
        position={{ x: 10, y: 10 }}
        onClose={onClose}
        actions={[{ label: 'Remove from Continue Watching', onSelect: remove }]}
      />,
    );
    const items = screen.getAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual(['Remove from Continue Watching', 'Cancel']);
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(items[0]!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(items[1]!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[0]);

    fireEvent.click(items[0]!);
    expect(remove).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(3);
    expect(remove).toHaveBeenCalledOnce();
  });
});
